import {spawn} from 'node:child_process'
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'

/**
 * "A newer CLI exists" (N4 of the Happy Tummy findings).
 *
 * Never blocks and never fails a command:
 *   - the notice is read from a cache (~/.norbix/update-check.json) only;
 *   - when the cache is older than a day, a detached child process
 *     (`node update-check.js`, `unref`ed) asks the npm registry, with a 3 s
 *     timeout, and writes the cache — the notice shows from the next run on;
 *   - every error is swallowed.
 * The notice is one line on stderr, so `--json` stdout stays one document.
 * It shows at most once a day, and always on `login`, `ai init` and
 * `whoami` (where people look at their setup).
 *
 * Off with NORBIX_NO_UPDATE_CHECK=1 (or NO_UPDATE_NOTIFIER, or in CI), and for
 * a development build (version 0.x: the release stamps the real version).
 */

export const PACKAGE = '@norbix.ai/cli'
export const REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE.replace('/', '%2f')}/latest`
export const CHECK_EVERY_MS = 24 * 60 * 60 * 1000
const COMMANDS_THAT_ALWAYS_SHOW = new Set(['login', 'ai:init', 'whoami'])

export interface UpdateCache {
  /** When the registry was last asked (ISO). */
  checkedAt?: string
  /** The latest version it named. */
  latest?: string
  /** When the notice was last shown (ISO). */
  notifiedAt?: string
}

export function cachePath(home: string = homedir()): string {
  return join(home, '.norbix', 'update-check.json')
}

export function readCache(path: string = cachePath()): UpdateCache {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    return typeof parsed === 'object' && parsed !== null ? (parsed as UpdateCache) : {}
  } catch {
    return {}
  }
}

export function writeCache(cache: UpdateCache, path: string = cachePath()): void {
  try {
    mkdirSync(join(path, '..'), {recursive: true})
    writeFileSync(path, JSON.stringify(cache, null, 2) + '\n')
  } catch {
    /* a read-only HOME must not break a command */
  }
}

function truthy(value: string | undefined): boolean {
  return value !== undefined && value !== '' && value !== '0' && value.toLowerCase() !== 'false'
}

/** True when no check may run: the kill switches, CI, or a development build. */
export function updateCheckDisabled(version: string, env: NodeJS.ProcessEnv = process.env): boolean {
  if (truthy(env.NORBIX_NO_UPDATE_CHECK) || truthy(env.NO_UPDATE_NOTIFIER) || truthy(env.CI)) return true
  return !/^[1-9]\d*\.\d+\.\d+/.test(version)
}

/** `a` is a newer release than `b` (x.y.z; a pre-release tag never counts as newer). */
export function isNewer(a: string | undefined, b: string): boolean {
  if (!a || a.includes('-')) return false
  const parse = (v: string) => v.replace(/^v/, '').split(/[-+]/)[0].split('.').map((n) => Number.parseInt(n, 10) || 0)
  const [x, y] = [parse(a), parse(b)]
  for (let i = 0; i < 3; i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0)
  }

  return false
}

export function noticeText(current: string, latest: string): string {
  return `A newer Norbix CLI is available: ${current} → ${latest}. Update: npm install -g ${PACKAGE}@latest  (turn this notice off: NORBIX_NO_UPDATE_CHECK=1)`
}

/**
 * Decide what this run does: the notice to print (or none) and whether the
 * cache is stale. Pure — the hook does the printing and the spawning.
 */
export function planUpdateCheck(opts: {
  version: string
  commandId?: string
  cache: UpdateCache
  now: number
  env?: NodeJS.ProcessEnv
}): {notice?: string; refresh: boolean; cache: UpdateCache} {
  const {version, cache, now} = opts
  if (updateCheckDisabled(version, opts.env)) return {refresh: false, cache}
  const checked = Date.parse(cache.checkedAt ?? '')
  const refresh = !(now - checked < CHECK_EVERY_MS)
  if (!isNewer(cache.latest, version)) return {refresh, cache}
  const notified = Date.parse(cache.notifiedAt ?? '')
  const always = opts.commandId !== undefined && COMMANDS_THAT_ALWAYS_SHOW.has(opts.commandId)
  if (!always && now - notified < CHECK_EVERY_MS) return {refresh, cache}
  return {notice: noticeText(version, cache.latest!), refresh, cache: {...cache, notifiedAt: new Date(now).toISOString()}}
}

/** Ask the registry for the latest version; undefined on any failure. */
export async function fetchLatest(fetchFn: typeof fetch = fetch, timeoutMs = 3000): Promise<string | undefined> {
  try {
    const res = await fetchFn(REGISTRY_URL, {signal: AbortSignal.timeout(timeoutMs), headers: {accept: 'application/json'}})
    if (!res.ok) return undefined
    const body = (await res.json()) as {version?: unknown}
    return typeof body.version === 'string' && /^\d+\.\d+\.\d+/.test(body.version) ? body.version : undefined
  } catch {
    return undefined
  }
}

/** The child process's job: ask the registry, write the cache. */
export async function refreshCache(path: string = cachePath(), fetchFn: typeof fetch = fetch, now = Date.now()): Promise<void> {
  const latest = await fetchLatest(fetchFn)
  const cache = readCache(path)
  writeCache({...cache, checkedAt: new Date(now).toISOString(), ...(latest ? {latest} : {})}, path)
}

/** Start the refresh in a detached child that outlives nothing: the command never waits for it. */
export function spawnRefresh(): void {
  try {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--refresh'], {
      detached: true,
      stdio: 'ignore',
      env: {...process.env, NORBIX_UPDATE_CHECK_CHILD: '1'},
    })
    child.on('error', () => {})
    child.unref()
  } catch {
    /* no child, no notice — never an error */
  }
}

// `node update-check.js --refresh`: the detached child.
if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2] === '--refresh') {
  await refreshCache()
}
