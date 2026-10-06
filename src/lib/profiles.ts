import {chmodSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {join} from 'node:path'

/**
 * Profile storage — one INI file, AWS-style but simpler:
 *
 *   ~/.norbix/config          (mode 600, secrets + settings together)
 *   ---------------------------------------------------------------
 *   [default]
 *   api_key = nbk_live_...
 *   project_id = 5f1a...
 *
 *   [fitskin-prod]
 *   api_key = nbk_live_...
 *   project_id = 64ff...
 *   account_id = ...
 *   env = TEST
 *   api_url = https://api.norbix.ai
 *   hub_url = https://hub.norbix.ai
 *
 * Browser/password login sessions live in ~/.norbix/session.json —
 * separate on purpose: sessions rotate and are machine-managed, the
 * config file is edited by people.
 */

export const NORBIX_DIR = join(homedir(), '.norbix')
export const PROFILES_PATH = join(NORBIX_DIR, 'config')
export const SESSION_PATH = join(NORBIX_DIR, 'session.json')

export const DEFAULT_API_URL = 'https://api.norbix.ai'
export const DEFAULT_HUB_URL = 'https://hub.norbix.ai'

export interface Profile {
  api_key?: string
  project_id?: string
  account_id?: string
  env?: string
  region?: string
  api_url?: string
  hub_url?: string
  /** Hub version path (`v3`). Normally discovered from the Hub's /echo; set it only to override. */
  hub_version?: string
  files_integration_id?: string
}

export const PROFILE_KEYS: Array<keyof Profile> = [
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

// ---------- session (from `norbix login`) ----------

export interface Session {
  bearerToken: string
  refreshToken?: string
  /** When the access token expires (ISO time) — from `expiresIn` of the sign-in or the refresh. */
  expiresAt?: string
  /** The OAuth client the refresh token belongs to (`norbix-cli`); a refresh needs it. */
  clientId?: string
  /** `browser` (device sign-in, an AI service user) or `password` (the person). */
  method?: 'browser' | 'password'
  /** The Hub version path the session was made with (`v3`), reused for refresh and revoke. */
  hubVersion?: string
  /**
   * The Hub / API the browser sign-in was made against, when not norbix.ai —
   * so later commands, the refresh and the revoke reach the Hub that issued the token.
   */
  hubUrl?: string
  apiUrl?: string
  projectId?: string
  accountId?: string
  env?: string
  region?: string
  userId?: string
  userName?: string
  displayName?: string
  savedAt?: string
}

export function readSession(): Session | undefined {
  try {
    const s = JSON.parse(readFileSync(SESSION_PATH, 'utf8')) as Session
    return s.bearerToken ? s : undefined
  } catch {
    return undefined
  }
}

/**
 * Write the session in one step: a temporary file next to it, then a rename.
 * A refresh rotates the refresh token, so a half-written file would lose the
 * only token that can get a new one.
 */
export function writeSession(session: Session): void {
  mkdirSync(NORBIX_DIR, {recursive: true})
  const clean = Object.fromEntries(Object.entries(session).filter(([, v]) => v !== undefined))
  const tmp = `${SESSION_PATH}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify(clean, null, 2) + '\n', {mode: 0o600})
  renameSync(tmp, SESSION_PATH)
}

export function clearSession(): void {
  if (existsSync(SESSION_PATH)) unlinkSync(SESSION_PATH)
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
