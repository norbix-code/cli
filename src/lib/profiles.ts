import {chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {join} from 'node:path'

/**
 * Profile storage — one INI file, AWS-style but simpler:
 *
 *   ~/.norbix/config          (mode 600, secrets + settings together)
 *   ---------------------------------------------------------------
 *   [default]                 # no host = hub.norbix.ai
 *   project_id = 5f1a...
 *
 *   [finlo]
 *   host = cloud.finlo.space    # the Hub tells the CLI every other address
 *   project_id = 64ff...
 *
 *   [finlo-ci]
 *   host = hub.finlo.space
 *   api_key = nbsu_...
 *   project_id = 64ff...
 *
 * This is the only config file the CLI writes. The old
 * ~/.config/norbix/config.json (camelCase keys) is still read as a last
 * fallback, never written. `api_url` / `hub_url` are still read for one
 * release (deprecated: `host` replaces them).
 *
 * Browser sign-in sessions live in ~/.norbix/sessions/<hub-host>.json, one
 * per Hub — separate on purpose: sessions rotate and are machine-managed,
 * the config file is edited by people. `cloud.x` and `hub.x` lead to the
 * same Hub, so they share one sign-in.
 */

export const NORBIX_DIR = join(homedir(), '.norbix')
export const PROFILES_PATH = join(NORBIX_DIR, 'config')
export const SESSIONS_DIR = join(NORBIX_DIR, 'sessions')
/** The one session file of CLI 1.18 and older; moved into SESSIONS_DIR on first read. */
export const LEGACY_SESSION_PATH = join(NORBIX_DIR, 'session.json')

export const DEFAULT_API_URL = 'https://api.norbix.ai'
export const DEFAULT_HUB_URL = 'https://hub.norbix.ai'

export interface Profile {
  /** The Norbix host this profile talks to (`cloud.finlo.space`); none = hub.norbix.ai. */
  host?: string
  api_key?: string
  project_id?: string
  account_id?: string
  env?: string
  region?: string
  /** Deprecated — `host` replaces it. Still read for one release. */
  api_url?: string
  /** Deprecated — `host` replaces it. Still read for one release. */
  hub_url?: string
  /** Hub version path (`v3`). Normally discovered from the Hub's /echo; set it only to override. */
  hub_version?: string
  files_integration_id?: string
}

export const PROFILE_KEYS: Array<keyof Profile> = [
  'host',
  'api_key',
  'project_id',
  'account_id',
  'env',
  'region',
  'api_url',
  'hub_url',
  'hub_version',
  'files_integration_id',
]

/**
 * The one spelling in the file is snake_case (`project_id`). Commands also
 * take the camelCase name (`projectId`) — the spelling of the old
 * ~/.config/norbix/config.json and of the environment variables' docs.
 */
const KEY_ALIASES: Record<string, keyof Profile> = {
  apiKey: 'api_key',
  projectId: 'project_id',
  accountId: 'account_id',
  apiUrl: 'api_url',
  hubUrl: 'hub_url',
  hubVersion: 'hub_version',
  filesIntegrationId: 'files_integration_id',
}

/** The profile key for `name` in either spelling, or undefined when unknown. */
export function profileKey(name: string): keyof Profile | undefined {
  if ((PROFILE_KEYS as string[]).includes(name)) return name as keyof Profile
  return KEY_ALIASES[name]
}

// ---------- tiny INI reader/writer (no dependency) ----------

export function parseIni(text: string): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {}
  let section = 'default'
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#') || line.startsWith(';')) continue
    const sec = line.match(/^\[(.+)\]$/)
    if (sec) {
      section = sec[1].trim()
      out[section] ??= {}
      continue
    }

    const eq = line.indexOf('=')
    if (eq > 0) {
      out[section] ??= {}
      out[section][line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
    }
  }

  return out
}

export function stringifyIni(data: Record<string, Record<string, string>>): string {
  const parts: string[] = []
  for (const [section, values] of Object.entries(data)) {
    parts.push(`[${section}]`)
    for (const [k, v] of Object.entries(values)) {
      if (v !== undefined && v !== '') parts.push(`${k} = ${v}`)
    }

    parts.push('')
  }

  return parts.join('\n')
}

// ---------- profiles ----------

export function readProfiles(): Record<string, Profile> {
  try {
    return parseIni(readFileSync(PROFILES_PATH, 'utf8')) as Record<string, Profile>
  } catch {
    return {}
  }
}

export function writeProfile(name: string, profile: Profile): void {
  mkdirSync(NORBIX_DIR, {recursive: true})
  const all = readProfiles() as Record<string, Record<string, string>>
  const clean = Object.fromEntries(
    Object.entries(profile).filter(([, v]) => v !== undefined && v !== ''),
  ) as Record<string, string>
  all[name] = clean
  writeFileSync(PROFILES_PATH, stringifyIni(all), {mode: 0o600})
  try {
    chmodSync(PROFILES_PATH, 0o600) // enforce even when the file pre-existed
  } catch {
    /* windows: no-op */
  }
}

export function deleteProfile(name: string): boolean {
  const all = readProfiles() as Record<string, Record<string, string>>
  if (!(name in all)) return false
  delete all[name]
  mkdirSync(NORBIX_DIR, {recursive: true})
  writeFileSync(PROFILES_PATH, stringifyIni(all), {mode: 0o600})
  return true
}

// ---------- sessions (from `norbix login`), one per Hub ----------

export interface Session {
  bearerToken: string
  refreshToken?: string
  /** When the access token expires (ISO time) — from `expiresIn` of the sign-in or the refresh. */
  expiresAt?: string
  /** The OAuth client the refresh token belongs to (`norbix-cli`); a refresh needs it. */
  clientId?: string
  /** `browser` (device sign-in, an AI service user) or `password` (the person, CLI 1.16 and older). */
  method?: 'browser' | 'password'
  /** The Hub version path the session was made with (`v3`), reused for refresh and revoke. */
  hubVersion?: string
  /**
   * The Hub that issued the token (base URL, no version) — refresh and
   * revoke go there, even with no network discovery.
   */
  hubUrl?: string
  apiUrl?: string
  /** The host the sign-in was started with (`cloud.finlo.space`). */
  host?: string
  projectId?: string
  accountId?: string
  env?: string
  region?: string
  userId?: string
  userName?: string
  displayName?: string
  savedAt?: string
}

export function sessionPath(hubKey: string): string {
  return join(SESSIONS_DIR, `${hubKey}.json`)
}

export function pendingPath(hubKey: string): string {
  return join(SESSIONS_DIR, `${hubKey}.pending.json`)
}

/** The file-name key of a URL's host: `hub.finlo.space`, `localhost_5001`. */
export function hostKey(url: string): string {
  const {hostname, port} = new URL(url)
  const name = hostname.toLowerCase().replace(/^\[|\]$/g, '').replaceAll(':', '_')
  return port ? `${name}_${port}` : name
}

/**
 * Move ~/.norbix/session.json (CLI 1.18 and older) to
 * ~/.norbix/sessions/<hub-host>.json. Its Hub is the one it stored, or
 * hub.norbix.ai. A session already in the new place is never overwritten.
 */
export function migrateLegacySession(): string | undefined {
  if (!existsSync(LEGACY_SESSION_PATH)) return undefined
  let legacy: Session | undefined
  try {
    legacy = JSON.parse(readFileSync(LEGACY_SESSION_PATH, 'utf8')) as Session
  } catch {
    legacy = undefined
  }

  if (!legacy?.bearerToken) {
    unlinkSync(LEGACY_SESSION_PATH)
    return undefined
  }

  const hubUrl = legacy.hubUrl ?? 'https://hub.norbix.ai'
  let key: string
  try {
    key = hostKey(hubUrl)
  } catch {
    return undefined
  }

  if (!existsSync(sessionPath(key))) writeSession(key, {...legacy, hubUrl})
  unlinkSync(LEGACY_SESSION_PATH)
  return key
}

export function readSession(hubKey: string): Session | undefined {
  migrateLegacySession()
  try {
    const s = JSON.parse(readFileSync(sessionPath(hubKey), 'utf8')) as Session
    return s.bearerToken ? s : undefined
  } catch {
    return undefined
  }
}

/** Every stored sign-in, by Hub key. */
export function listSessions(): Array<{hubKey: string; session: Session}> {
  migrateLegacySession()
  let names: string[]
  try {
    names = readdirSync(SESSIONS_DIR)
  } catch {
    return []
  }

  return names
    .filter((n) => n.endsWith('.json') && !n.endsWith('.pending.json'))
    .map((n) => n.slice(0, -'.json'.length))
    .sort()
    .flatMap((hubKey) => {
      const session = readSession(hubKey)
      return session ? [{hubKey, session}] : []
    })
}

/** Write a file in one step (temporary file, then rename), mode 600. */
function writeSecretJson(path: string, data: object): void {
  mkdirSync(SESSIONS_DIR, {recursive: true, mode: 0o700})
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))
  const tmp = `${path}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify(clean, null, 2) + '\n', {mode: 0o600})
  renameSync(tmp, path)
}

/**
 * Write the session in one step: a temporary file next to it, then a rename.
 * A refresh rotates the refresh token, so a half-written file would lose the
 * only token that can get a new one.
 */
export function writeSession(hubKey: string, session: Session): void {
  writeSecretJson(sessionPath(hubKey), session)
}

export function clearSession(hubKey: string): void {
  if (existsSync(sessionPath(hubKey))) unlinkSync(sessionPath(hubKey))
}

/** A device sign-in started by `login --no-browser --json`, waiting for `login --wait`. */
export interface PendingSignIn {
  deviceCode: string
  userCode: string
  verificationUri: string
  verificationUriComplete?: string
  /** ISO time the code runs out. */
  expiresAt: string
  /** Seconds between polls (grows on `slow_down`). */
  interval: number
  host: string
  hubUrl: string
  hubVersion: string
  apiUrl?: string
  projectId?: string
  accountId?: string
  env?: string
  region?: string
  startedAt: string
}

export function readPending(hubKey: string): PendingSignIn | undefined {
  try {
    const p = JSON.parse(readFileSync(pendingPath(hubKey), 'utf8')) as PendingSignIn
    return p.deviceCode ? p : undefined
  } catch {
    return undefined
  }
}

export function writePending(hubKey: string, pending: PendingSignIn): void {
  writeSecretJson(pendingPath(hubKey), pending)
}

/** The Hub keys with a sign-in waiting for `login --wait`. */
export function listPendingKeys(): string[] {
  try {
    return readdirSync(SESSIONS_DIR)
      .filter((n) => n.endsWith('.pending.json'))
      .map((n) => n.slice(0, -'.pending.json'.length))
      .sort()
  } catch {
    return []
  }
}

export function clearPending(hubKey: string): void {
  if (existsSync(pendingPath(hubKey))) unlinkSync(pendingPath(hubKey))
}

/** Decode a JWT `exp` claim (ms). Returns undefined when not decodable. */
export function jwtExpiryMs(token: string): number | undefined {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    return typeof payload.exp === 'number' ? payload.exp * 1000 : undefined
  } catch {
    return undefined
  }
}

/** When the session's access token expires (ms): the stored expiry, else the JWT `exp`. */
export function sessionExpiryMs(session: Session): number | undefined {
  const stored = session.expiresAt ? Date.parse(session.expiresAt) : Number.NaN
  return Number.isNaN(stored) ? jwtExpiryMs(session.bearerToken) : stored
}

/** True when the session can get a new access token by itself (browser sign-in). */
export function isSessionRefreshable(session: Session | undefined): session is Session {
  return Boolean(session?.refreshToken && session.clientId)
}

/** A session's access token is valid when it is not (provably) expired. */
export function isSessionValid(session: Session | undefined, now = Date.now()): session is Session {
  if (!session?.bearerToken) return false
  const exp = sessionExpiryMs(session)
  return exp === undefined || exp > now + 30_000
}

/** A session can be used when its token is valid, or when it can refresh the token. */
export function isSessionUsable(session: Session | undefined, now = Date.now()): session is Session {
  return isSessionValid(session, now) || isSessionRefreshable(session)
}
