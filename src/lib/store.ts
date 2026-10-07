import {mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'

/**
 * The OLD local configuration: JSON in the per-user config directory
 * (~/.config/norbix/config.json on Linux and macOS, %LOCALAPPDATA%\norbix on
 * Windows). It is only read, as the last fallback after the profiles in
 * ~/.norbix/config; `norbix logout` still clears tokens from it. Every
 * command that saves settings writes a profile (see profiles.ts).
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
