import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {dirname, join, parse, resolve} from 'node:path'

import {usageError} from './cli-error.js'

/**
 * The repo's own Norbix target (N3 of the Happy Tummy findings):
 * `.norbix/project.json` in the project folder (or any folder above the
 * current one), written by `norbix ai init` and `norbix env use`:
 *
 *   {"host": "cloud.example.com", "projectId": "pr_…", "env": "TEST"}
 *
 * No secrets: the sign-in stays in ~/.norbix. Commit it, so every clone and
 * every coding agent in this repo talks to the same installation and
 * project, whatever the computer's [default] profile says.
 *
 * Precedence: --host / --project / --env (and NORBIX_*) → this file → the
 * profile → the sign-in. The file's host behaves like --host: a [default]
 * profile for another host is not used (its API key is never sent there).
 * An explicit --profile for another host wins, and the file is ignored.
 */

export const PROJECT_DIR = '.norbix'
export const PROJECT_FILE = 'project.json'

export interface ProjectConfig {
  host?: string
  projectId?: string
  env?: string
}

export interface FoundProjectConfig {
  path: string
  config: ProjectConfig
}

/** `<dir>/.norbix/project.json`. */
export function projectConfigPath(dir: string): string {
  return join(dir, PROJECT_DIR, PROJECT_FILE)
}

/**
 * The nearest `.norbix/project.json` from `start` upwards. The home folder
 * itself is never searched (~/.norbix is the CLI's own folder), nor anything
 * above it. NORBIX_PROJECT_CONFIG=0 turns the lookup off.
 */
export function findProjectConfig(start: string = process.cwd(), home: string = homedir()): FoundProjectConfig | undefined {
  if (process.env.NORBIX_PROJECT_CONFIG === '0') return undefined
  let dir = resolve(start)
  const stop = resolve(home)
  const root = parse(dir).root
  for (;;) {
    if (dir === stop) return undefined
    const path = projectConfigPath(dir)
    if (existsSync(path)) return {path, config: readProjectConfig(path)}
    if (dir === root) return undefined
    dir = dirname(dir)
  }
}

export function readProjectConfig(path: string): ProjectConfig {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw usageError(
      `${path} is not valid JSON: ${error instanceof Error ? error.message : String(error)}.`,
      'Fix it, or write it again with `norbix ai init --force`.',
      'norbix ai init --help',
    )
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw usageError(`${path} must hold a JSON object like {"host": "…", "projectId": "…", "env": "TEST"}.`, undefined, 'norbix ai init --help')
  }

  const o = parsed as Record<string, unknown>
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
  return {host: text(o.host), projectId: text(o.projectId), env: text(o.env)?.toUpperCase()}
}

export function writeProjectConfig(path: string, config: ProjectConfig): void {
  mkdirSync(dirname(path), {recursive: true})
  const clean: ProjectConfig = {}
  if (config.host) clean.host = config.host
  if (config.projectId) clean.projectId = config.projectId
  if (config.env) clean.env = config.env
  writeFileSync(path, JSON.stringify(clean, null, 2) + '\n')
}
