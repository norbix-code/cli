import {CliError} from './cli-error.js'
import {EXIT} from './exit-codes.js'

/**
 * The env rule (owner, 2026-10-14):
 *   - a project with only PROD needs no env — with or without `--env PROD` it works in PROD;
 *   - a project with more than one environment needs the caller to say which one.
 *
 * "Said" means `--env`, `--prod`, NORBIX_ENV, or an env saved on purpose
 * (`norbix env use`, `env =` in a profile). A saved env is printed on stderr
 * for every project-scoped command, so an agent always sees where it writes.
 *
 * The plain REST API and the SDKs are not touched: an app that sends no env
 * still works in PROD.
 */

/** Where the env of this run came from. */
export type EnvSource =
  | '--env'
  | '--prod'
  | 'NORBIX_ENV'
  | 'saved by norbix env use'
  | `profile [${string}]`
  | 'old config.json'
  | 'none'

/** A source the user typed for this run (not a saved default). */
export function isPerRunSource(source: EnvSource): boolean {
  return source === '--env' || source === '--prod' || source === 'NORBIX_ENV'
}

/** PROD first, then the rest alphabetically; upper case. */
export function orderEnvs(envs: string[]): string[] {
  const upper = [...new Set(envs.map((e) => e.trim().toUpperCase()).filter(Boolean))]
  return upper.sort((a, b) => (a === 'PROD' ? -1 : b === 'PROD' ? 1 : a.localeCompare(b)))
}

/** The environment names in a `GetProjectEnvironments` answer, or undefined when it has none. */
export function envsOf(response: unknown): string[] | undefined {
  const item = (response as {item?: {environments?: unknown}} | undefined)?.item
  const list = item?.environments
  if (!Array.isArray(list)) return undefined
  const names = list
    .map((e) => (typeof e === 'string' ? e : typeof e === 'object' && e && 'name' in e ? String((e as {name: unknown}).name) : ''))
    .filter(Boolean)
  return names.length > 0 ? orderEnvs(names) : undefined
}

export interface EnvCheck {
  /** The env named for this run, upper case; undefined = none. */
  env?: string
  source: EnvSource
}

/** What the check decided: go on (with an optional stderr line). */
export interface EnvVerdict {
  /** One line for stderr, or undefined. */
  notice?: string
}

/** The usage error of a multi-env project with no env named. */
export function envRequiredError(envs: string[]): CliError {
  const list = envs.join(', ')
  return new CliError({
    exit: EXIT.USAGE,
    code: 'ENV_REQUIRED',
    message: `This project has environments ${list}. Pass --env <name> (or set NORBIX_ENV).`,
    hint:
      `Name the environment for this command: ${envs.map((e) => `--env ${e}`).join(' or ')} (--prod is short for --env PROD). ` +
      'To make one the default, run `norbix env use <name>` — it is then printed on every command. Ask the user when it is not clear.',
    docs: 'norbix env list --help',
  })
}

/**
 * Decide for one project-scoped command. `envs` = the project's environments
 * (undefined = could not be read: the command runs as before, with a warning).
 */
export function checkEnv(envs: string[] | undefined, check: EnvCheck): EnvVerdict {
  if (!envs) {
    return check.env
      ? {}
      : {
          notice:
            'Warning: could not read the project\'s environments (`norbix env list`); running without an env, which means PROD. ' +
            'Pass --env <name> if the project has more than one.',
        }
  }

  if (envs.length <= 1) {
    // Only PROD: nothing to choose. A wrong name is left to the gateway, which refuses it.
    return {}
  }

  if (!check.env) throw envRequiredError(envs)
  if (!isPerRunSource(check.source)) return {notice: `env: ${check.env} (${check.source})`}
  return {}
}
