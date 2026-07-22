import {mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'

/**
 * Local CLI configuration, stored as JSON in the per-user config directory
 * (oclif picks the right place per OS: ~/.config/norbix on Linux,
 * ~/Library/Application Support/norbix... actually ~/.config/norbix on macOS
 * too for oclif, %LOCALAPPDATA%\norbix on Windows).
 *
 * Secrets (apiKey, bearerToken, refreshToken) live in the same file, which is
 * written with mode 0600 (owner read/write only) on POSIX systems.
 */
export interface StoredConfig {
  projectId?: string
  accountId?: string
  region?: string
  env?: string
  apiUrl?: string
  hubUrl?: string
  filesIntegrationId?: string
  apiKey?: string
  bearerToken?: string
  refreshToken?: string
  userId?: string
  userName?: string
}

/** Keys a user may change via `norbix config set`. Tokens are managed by login/logout. */
export const SETTABLE_KEYS = [
  'projectId',
  'accountId',
  'region',
  'env',
  'apiUrl',
  'hubUrl',
  'apiKey',
  'filesIntegrationId',
] as const

export type SettableKey = (typeof SETTABLE_KEYS)[number]

export function isSettableKey(key: string): key is SettableKey {
  return (SETTABLE_KEYS as readonly string[]).includes(key)
}

export function configFilePath(configDir: string): string {
  return join(configDir, 'config.json')
}

export function readStore(configDir: string): StoredConfig {
  try {
    return JSON.parse(readFileSync(configFilePath(configDir), 'utf8')) as StoredConfig
  } catch {
    return {}
  }
}

export function writeStore(configDir: string, store: StoredConfig): void {
  mkdirSync(configDir, {recursive: true})
  // Drop undefined values so the file stays clean.
  const clean = Object.fromEntries(Object.entries(store).filter(([, v]) => v !== undefined))
  writeFileSync(configFilePath(configDir), JSON.stringify(clean, null, 2) + '\n', {mode: 0o600})
}

/** Shorten a secret for display: "nbk_abc…xyz". Never print full secrets. */
export function redact(secret?: string): string | undefined {
  if (!secret) return undefined
  return secret.length <= 8 ? '********' : `${secret.slice(0, 3)}…${secret.slice(-3)}`
}
