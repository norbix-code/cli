import {chmodSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'

import {CliError, usageError} from './cli-error.js'
import {EXIT} from './exit-codes.js'
import {cleanVersion, splitVersionedUrl} from './hub-version.js'
import {NORBIX_DIR, hostKey} from './profiles.js'

export {hostKey} from './profiles.js'

/**
 * Hosts and discovery. The CLI only needs to find the Hub; the Hub decides
 * every other address.
 *
 *   host (--host, NORBIX_HOST, profile `host`; default hub.norbix.ai)
 *     │  GET https://<host>/.well-known/norbix.json → {"hubUrl": "https://hub.x/v3"}
 *     │  (404, not JSON, no hubUrl → <host> itself is the Hub)
 *     ▼
 *   GET <hubUrl>/echo → hubUrl, apiUrl, hubVersion, apiVersion, regions,
 *                       agent.deviceAuthorizationUrl / deviceTokenUrl
 *
 * The answer is cached per Hub in ~/.norbix/hosts/<hub-host>.json for 24 h;
 * ~/.norbix/hosts/aliases.json remembers which Hub a host led to, so
 * `cloud.x` and `hub.x` share one cache file and one sign-in.
 *
 * No oclif import.
 */

export const DEFAULT_HOST = 'hub.norbix.ai'
export const HOSTS_DIR = join(NORBIX_DIR, 'hosts')
const ALIASES_PATH = join(HOSTS_DIR, 'aliases.json')

/** How long a discovery answer is used before it is fetched again. */
export const HOST_TTL_MS = 24 * 60 * 60 * 1000
/** A built-in answer for hub.norbix.ai (discovery failed) is retried sooner. */
const FALLBACK_TTL_MS = 60 * 60 * 1000
const DISCOVERY_TIMEOUT_MS = 8000
/** The version segment that asks /echo when the Hub's own version is not known yet. */
const PROBE_VERSION = 'v3'

export interface HubRegion {
  code: string
  apiUrl?: string
  hubUrl?: string
}

/** What discovery learned about one Hub. URLs without a trailing slash. */
export interface HostInfo {
  /** The Hub as /echo reports it, with its version: `https://hub.finlo.space/v3`. */
  hubUrl: string
  /** The Api as /echo reports it, with its version: `https://api.finlo.space/v3`. */
  apiUrl: string
  hubVersion?: string
  apiVersion?: string
  regions: HubRegion[]
  deviceAuthorizationUrl?: string
  deviceTokenUrl?: string
  /** ISO time of the fetch. */
  fetchedAt: string
  /** `discovered` from the Hub, or `built-in` when hub.norbix.ai could not be reached. */
  source: 'discovered' | 'built-in'
}

/** The built-in answer for the default host, used only when it cannot be reached. */
export function builtInDefault(now = Date.now()): HostInfo {
  return {
    hubUrl: 'https://hub.norbix.ai',
    apiUrl: 'https://api.norbix.ai',
    regions: [],
    fetchedAt: new Date(now).toISOString(),
    source: 'built-in',
  }
}

// ---------- host names ----------

/**
 * The only hosts plain http is allowed for: this computer (localhost,
 * 127.0.0.1, ::1, *.localhost) and *.test — a name reserved for testing
 * (RFC 6761) that never exists on the internet; local Norbix stacks use it
 * (`http://<item>.norbix.test:5001`).
 */
export function isLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
  return h === 'localhost' || h.endsWith('.localhost') || h === '127.0.0.1' || h === '::1' || h.endsWith('.test')
}

/**
 * A host as people type it — `cloud.finlo.space`, `https://hub.x/v3`,
 * `localhost:5001` — as an origin: `https://cloud.finlo.space`,
 * `http://localhost:5001`. https by default; http only for this computer and *.test names.
 */
export function normalizeHost(input: string): string {
  const raw = input.trim().replace(/\/+$/, '')
  if (!raw) throw usageError('The host is empty.', 'Pass a host such as hub.norbix.ai or cloud.example.com.', 'norbix login --help')
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
  let url: URL
  try {
    url = new URL(hasScheme ? raw : `https://${raw}`)
  } catch {
    throw usageError(`"${input}" is not a host name.`, 'Pass a host such as hub.norbix.ai or cloud.example.com.', 'norbix login --help')
  }

  if (!hasScheme && isLocalHost(url.hostname)) url = new URL(`http://${raw}`)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw usageError(`"${input}" must be an https address.`, 'Pass a host such as hub.norbix.ai.', 'norbix login --help')
  }

  if (url.protocol === 'http:' && !isLocalHost(url.hostname)) {
    throw usageError(
      `Plain http is only allowed for localhost and *.test names, not for ${url.host}.`,
      `Use https://${url.host} (or just ${url.host}).`,
      'norbix login --help',
    )
  }

  return url.origin
}

/**
 * The host as it is written into a profile or a hint: without its scheme
 * when the scheme is the default one (`cloud.example.com`,
 * `localhost:5001`), else the whole origin (`https://localhost:8443`).
 */
export function storedHost(input: string): string {
  const origin = normalizeHost(input)
  const bare = origin.replace(/^https?:\/\//, '')
  return normalizeHost(bare) === origin ? bare : origin
}

/** True when `origin` is the default host, hub.norbix.ai. */
export function isDefaultHost(origin: string): boolean {
  return origin === normalizeHost(DEFAULT_HOST)
}

// ---------- cache ----------

interface Alias {
  hub: string
  fetchedAt: string
}

function readJson<T>(path: string): T | undefined {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch {
    return undefined
  }
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(HOSTS_DIR, {recursive: true})
  const tmp = `${path}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', {mode: 0o600})
  renameSync(tmp, path)
  try {
    chmodSync(path, 0o600)
  } catch {
    /* windows: no-op */
  }
}

function readAliases(): Record<string, Alias> {
  return readJson<Record<string, Alias>>(ALIASES_PATH) ?? {}
}

export function hostCachePath(hubKey: string): string {
  return join(HOSTS_DIR, `${hubKey}.json`)
}

/** The cached answer for a host, however old, with its Hub key. */
export function cachedHost(origin: string): {hubKey: string; info: HostInfo} | undefined {
  const hubKey = readAliases()[hostKey(origin)]?.hub ?? hostKey(origin)
  const info = readJson<HostInfo>(hostCachePath(hubKey))
  return info?.hubUrl && info.apiUrl ? {hubKey, info: {...info, regions: info.regions ?? []}} : undefined
}

function isFresh(info: HostInfo, now: number): boolean {
  const age = now - Date.parse(info.fetchedAt)
  const ttl = info.source === 'built-in' ? FALLBACK_TTL_MS : HOST_TTL_MS
  return age >= 0 && age < ttl
}

function saveHost(origin: string, info: HostInfo): string {
  const hubKey = hostKey(info.hubUrl)
  writeJson(hostCachePath(hubKey), info)
  const aliases = readAliases()
  aliases[hostKey(origin)] = {hub: hubKey, fetchedAt: info.fetchedAt}
  writeJson(ALIASES_PATH, aliases)
  return hubKey
}

/** Forget what a host led to — the next command discovers it again. */
export function forgetHost(origin: string): void {
  const cached = cachedHost(origin)
  if (cached) rmSync(hostCachePath(cached.hubKey), {force: true})
  const aliases = readAliases()
  if (aliases[hostKey(origin)]) {
    delete aliases[hostKey(origin)]
    writeJson(ALIASES_PATH, aliases)
  }
}

// ---------- discovery ----------

export interface DiscoveryDeps {
  fetch?: typeof fetch
  now?: () => number
}

function networkError(origin: string, url: string, error: unknown): CliError {
  return new CliError({
    exit: EXIT.NETWORK,
    code: 'NORBIX_NETWORK_ERROR',
    message: `Could not reach ${new URL(origin).host}: ${error instanceof Error ? error.message : String(error)}`,
    hint: 'Check the host (--host, NORBIX_HOST or `host` in the profile) and the network.',
    url,
  })
}

function notAHub(origin: string, url: string, detail: string): CliError {
  const host = new URL(origin).host
  // A dashboard of an installation older than /.well-known/norbix.json: its Hub is usually hub.<domain>.
  const hub = /^(cloud|app|dashboard)\./.test(host) ? host.replace(/^[^.]+\./, 'hub.') : undefined
  return new CliError({
    exit: EXIT.USAGE,
    code: 'NOT_A_HUB',
    message: `${host} is not a Norbix Hub (${detail}).`,
    hint: hub
      ? `If ${host} is your Norbix dashboard, its installation may be older than discovery: pass the Hub instead, e.g. --host ${hub}.`
      : 'Pass the address of your Norbix dashboard or Hub with --host, e.g. --host cloud.example.com.',
    docs: 'norbix login --help',
    url,
  })
}

async function getJson(fetchFn: typeof fetch, url: string): Promise<{status: number; body?: Record<string, unknown>}> {
  const res = await fetchFn(url, {headers: {Accept: 'application/json'}, signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS)})
  let body: Record<string, unknown> | undefined
  try {
    const parsed = JSON.parse(await res.text()) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed as Record<string, unknown>
  } catch {
    body = undefined // an HTML page (a dashboard's own 404) is not an answer
  }

  return {status: res.status, body}
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().replace(/\/+$/, '') : undefined
}

/** An address the Hub returned: http(s) only, plain http only for this computer and *.test names. */
function safeUrl(value: unknown): string | undefined {
  const s = str(value)
  if (!s) return undefined
  try {
    const url = new URL(s)
    if (url.protocol === 'https:') return s
    if (url.protocol === 'http:' && isLocalHost(url.hostname)) return s
  } catch {
    /* not a URL */
  }

  return undefined
}

/**
 * Ask a host where its Hub is and what the Hub serves. Network errors throw
 * (exit 7); a host that answers but is no Norbix Hub throws exit 2.
 */
export async function discover(origin: string, deps: DiscoveryDeps = {}): Promise<HostInfo> {
  const fetchFn = deps.fetch ?? fetch
  const now = deps.now ?? Date.now

  const wellKnown = `${origin}/.well-known/norbix.json`
  let hubUrl: string | undefined
  try {
    const res = await getJson(fetchFn, wellKnown)
    if (res.status >= 200 && res.status < 300) hubUrl = safeUrl(res.body?.hubUrl)
  } catch (error) {
    throw networkError(origin, wellKnown, error)
  }

  // No (usable) well-known file: the host itself is the Hub.
  const {base, version} = splitVersionedUrl(hubUrl ?? origin)
  const echoUrl = `${base}/${version ?? PROBE_VERSION}/echo`
  let echo: {status: number; body?: Record<string, unknown>}
  try {
    echo = await getJson(fetchFn, echoUrl)
  } catch (error) {
    throw networkError(origin, echoUrl, error)
  }

  if (echo.status < 200 || echo.status >= 300) throw notAHub(origin, echoUrl, `/echo answered HTTP ${echo.status}`)
  const body = echo.body
  if (!body || (!('hubUrl' in body) && !('hubVersion' in body))) throw notAHub(origin, echoUrl, '/echo did not answer like a Hub')

  const hubVersion = cleanVersion(str(body.hubVersion)) ?? version
  const echoHub = safeUrl(body.hubUrl)
  const resolvedHub = echoHub ?? (hubVersion ? `${base}/${hubVersion}` : base)
  const apiVersion = cleanVersion(str(body.apiVersion))
  const agent = (body.agent ?? {}) as Record<string, unknown>
  const regions = Array.isArray(body.regions)
    ? (body.regions as Array<Record<string, unknown>>)
        .map((r) => ({code: str(r?.code) ?? '', apiUrl: safeUrl(r?.apiUrl), hubUrl: safeUrl(r?.hubUrl)}))
        .filter((r) => r.code)
    : []

  return {
    hubUrl: resolvedHub,
    // A Hub that does not name its Api (older than the field) serves both.
    apiUrl: safeUrl(body.apiUrl) ?? base,
    hubVersion: hubVersion ?? splitVersionedUrl(resolvedHub).version,
    apiVersion: apiVersion ?? splitVersionedUrl(safeUrl(body.apiUrl) ?? '').version,
    regions,
    deviceAuthorizationUrl: safeUrl(agent.deviceAuthorizationUrl),
    deviceTokenUrl: safeUrl(agent.deviceTokenUrl),
    fetchedAt: new Date(now()).toISOString(),
    source: 'discovered',
  }
}

/**
 * The Hub behind a host: from the cache while it is fresh, else discovered
 * and cached. When the host cannot be reached, an old cached answer is
 * used; for hub.norbix.ai the built-in addresses are.
 */
export async function resolveHost(
  origin: string,
  opts: DiscoveryDeps & {refresh?: boolean} = {},
): Promise<{hubKey: string; info: HostInfo; from: 'cache' | 'network' | 'stale cache' | 'built-in'}> {
  const now = opts.now ?? Date.now
  const cached = cachedHost(origin)
  if (cached && !opts.refresh && isFresh(cached.info, now())) return {...cached, from: 'cache'}

  try {
    const info = await discover(origin, opts)
    return {hubKey: saveHost(origin, info), info, from: 'network'}
  } catch (error) {
    const offline = error instanceof CliError && error.exit === EXIT.NETWORK
    if (offline && cached) return {...cached, from: 'stale cache'}
    if (offline && isDefaultHost(origin)) {
      const info = builtInDefault(now())
      return {hubKey: saveHost(origin, info), info, from: 'built-in'}
    }

    throw error
  }
}

/** The Api and Hub base URLs for a region the Hub lists, else undefined. */
export function regionalEndpoints(info: HostInfo, region: string | undefined): {apiUrl?: string; hubUrl?: string} | undefined {
  if (!region) return undefined
  const r = info.regions.find((x) => x.code === region)
  return r ? {apiUrl: r.apiUrl, hubUrl: r.hubUrl} : undefined
}

// ---------- a project's primary region ----------

/** A project's primary region rarely changes: it is asked again after a week. */
const PROJECT_REGION_TTL_MS = 7 * 24 * 60 * 60 * 1000

type ProjectRegions = Record<string, {region: string; fetchedAt: string}>

function projectRegionsPath(hubKey: string): string {
  return join(HOSTS_DIR, `${hubKey}.regions.json`)
}

/** The cached primary region of a project on this Hub, while it is fresh. */
export function cachedProjectRegion(hubKey: string, projectId: string, now = Date.now()): string | undefined {
  const entry = readJson<ProjectRegions>(projectRegionsPath(hubKey))?.[projectId]
  if (!entry?.region) return undefined
  const age = now - Date.parse(entry.fetchedAt)
  return age >= 0 && age < PROJECT_REGION_TTL_MS ? entry.region : undefined
}

export function saveProjectRegion(hubKey: string, projectId: string, region: string, now = Date.now()): void {
  const all = readJson<ProjectRegions>(projectRegionsPath(hubKey)) ?? {}
  all[projectId] = {region, fetchedAt: new Date(now).toISOString()}
  writeJson(projectRegionsPath(hubKey), all)
}

/**
 * Ask the Hub for a project's primary region:
 *   GET {hub}/{v}/account/projects/{projectId} → item.primaryRegion.id
 * Needs `project:read` on the project's settings. Undefined on any failure —
 * the caller then asks for --region, as before.
 */
export async function fetchProjectRegion(
  hub: {base: string; version: string},
  projectId: string,
  auth: {apiKey?: string; bearerToken?: string; accountId?: string},
  fetchFn: typeof fetch = fetch,
): Promise<string | undefined> {
  const token = auth.bearerToken ?? auth.apiKey
  if (!token) return undefined
  const headers: Record<string, string> = {Accept: 'application/json', Authorization: `Bearer ${token}`}
  if (auth.accountId) headers['norbix-account-id'] = auth.accountId
  try {
    const res = await fetchFn(`${hub.base}/${hub.version}/account/projects/${encodeURIComponent(projectId)}`, {
      headers,
      signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
    })
    if (!res.ok) return undefined
    const body = (await res.json()) as {item?: {primaryRegion?: {id?: unknown}}}
    const id = body.item?.primaryRegion?.id
    return typeof id === 'string' && /^[a-z0-9-]+$/.test(id) ? id : undefined
  } catch {
    return undefined
  }
}
