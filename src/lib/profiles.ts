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
 * Browser sign-in sessions live in ~/.norbix/sessions/, one file per Hub
 * AND project: `<hub-host>@<project-id>.json` for a sign-in made for a
 * project (the Hub pins its token to that project), `<hub-host>.json` for
 * one made with no project. Separate from the config on purpose: sessions
 * rotate and are machine-managed, the config file is edited by people.
 * `cloud.x` and `hub.x` lead to the same Hub, so they share sign-ins.
 * CLI 1.47 and older wrote every sign-in to `<hub-host>.json`; that file is
 * still read for its own project (see `findSession`), never moved or deleted.
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
  /**
   * The login's credential version at sign-in (gateway N-29), when the sign-in
   * answer carried it (`meta.credentialVersion`). It changes only with the
   * password: a mismatch means the password changed since this sign-in.
   */
  credentialVersion?: string
  savedAt?: string
}

/** Between the Hub key and the project id in a session file name. */
const PROJECT_SEPARATOR = '@'

/**
 * The file-name key of a sign-in: `hub.finlo.space@64ff…` for a project,
 * `hub.finlo.space` for a sign-in made with no project.
 */
export function sessionKey(hubKey: string, projectId?: string): string {
  return projectId ? `${hubKey}${PROJECT_SEPARATOR}${projectId}` : hubKey
}

/** The Hub key and the project of a session key (see `sessionKey`). */
export function parseSessionKey(key: string): {hubKey: string; projectId?: string} {
  const at = key.indexOf(PROJECT_SEPARATOR)
  return at < 0 ? {hubKey: key} : {hubKey: key.slice(0, at), projectId: key.slice(at + 1) || undefined}
}

export function sessionPath(key: string): string {
  return join(SESSIONS_DIR, `${key}.json`)
}

export function pendingPath(key: string): string {
  return join(SESSIONS_DIR, `${key}.pending.json`)
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

export function readSession(key: string): Session | undefined {
  migrateLegacySession()
  try {
    const s = JSON.parse(readFileSync(sessionPath(key), 'utf8')) as Session
    return s.bearerToken ? s : undefined
  } catch {
    return undefined
  }
}

/** One stored sign-in: its file key, the Hub, the project the file is for (none = made with no project). */
export interface StoredSession {
  key: string
  hubKey: string
  projectId?: string
  session: Session
}

/** Every stored sign-in, sorted by file key. */
export function listSessions(): StoredSession[] {
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
    .flatMap((key) => {
      const session = readSession(key)
      return session ? [{key, ...parseSessionKey(key), session}] : []
    })
}

/** The stored sign-ins of one Hub. */
export function hubSessions(hubKey: string): StoredSession[] {
  return listSessions().filter((s) => s.hubKey === hubKey)
}

/**
 * The sign-in a command on this Hub uses, without judging whether it is
 * still valid:
 *
 * - for a project: `<hub>@<project>.json`; else `<hub>.json` when that
 *   sign-in was made with no project or for this very project (CLI 1.47
 *   and older wrote every sign-in there). A sign-in made for ANOTHER
 *   project is never used — the Hub pinned its token to that project.
 * - for no project: `<hub>.json`; else the Hub's only project sign-in.
 *   With several project sign-ins and no project named there is no answer:
 *   the caller lists them (`hubSessions`).
 */
export function findSession(hubKey: string, projectId?: string): StoredSession | undefined {
  if (projectId) {
    const key = sessionKey(hubKey, projectId)
    const own = readSession(key)
    if (own) return {key, hubKey, projectId, session: own}
    const hub = readSession(hubKey)
    return hub && (!hub.projectId || hub.projectId === projectId) ? {key: hubKey, hubKey, session: hub} : undefined
  }

  const hub = readSession(hubKey)
  if (hub) return {key: hubKey, hubKey, session: hub}
  const mine = hubSessions(hubKey).filter((s) => s.projectId)
  return mine.length === 1 ? mine[0] : undefined
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
export function writeSession(key: string, session: Session): void {
  writeSecretJson(sessionPath(key), session)
}

export function clearSession(key: string): void {
  if (existsSync(sessionPath(key))) unlinkSync(sessionPath(key))
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

export function readPending(key: string): PendingSignIn | undefined {
  try {
    const p = JSON.parse(readFileSync(pendingPath(key), 'utf8')) as PendingSignIn
    return p.deviceCode ? p : undefined
  } catch {
    return undefined
  }
}

export function writePending(key: string, pending: PendingSignIn): void {
  writeSecretJson(pendingPath(key), pending)
}

/** The session keys (Hub, or Hub@project) with a sign-in waiting for `login --wait`. */
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

export function clearPending(key: string): void {
  if (existsSync(pendingPath(key))) unlinkSync(pendingPath(key))
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
