import {chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync} from 'node:fs'
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
  projectId?: string
  accountId?: string
  env?: string
  region?: string
  userId?: string
  userName?: string
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

export function writeSession(session: Session): void {
  mkdirSync(NORBIX_DIR, {recursive: true})
  writeFileSync(SESSION_PATH, JSON.stringify(session, null, 2) + '\n', {mode: 0o600})
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

/** A session is usable when it has a token that is not (provably) expired. */
export function isSessionValid(session: Session | undefined): session is Session {
  if (!session?.bearerToken) return false
  const exp = jwtExpiryMs(session.bearerToken)
  return exp === undefined || exp > Date.now() + 30_000
}
