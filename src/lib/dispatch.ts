/**
 * Dynamic dispatcher: turns
 *
 *   norbix hub database aggregates delete maggr_123 --schemaId sch_456
 *
 * into `client.hub.database.deleteDatabaseAggregate({id, schemaId})`.
 *
 * Grammar:  norbix {hub|api} {module} {words...} {positional id} {--field value}
 *
 * The SDK namespaces are auto-generated and uniform (every method takes one
 * request object), so the CLI can discover modules and methods at runtime —
 * every current AND future SDK method is callable without new command files.
 *
 * Values are typed in two steps: the raw tokens are collected first (the
 * method is not known yet), then `typeFields` applies the request-field map
 * of the matched method — a `string` field keeps "0042", a `boolean` flag
 * does not swallow the word after it. An explicit type wins over both:
 * `--field:str 0042`, `--field:num 7`, `--field:bool false`, `--field:json '{...}'`.
 * `--body '<json>'` replaces the field flags with one object.
 *
 * No oclif import here on purpose.
 */

import type {FieldKind} from './request-fields.js'

export type ExplicitType = 'str' | 'num' | 'bool' | 'json'

export interface RawField {
  name: string
  /** Undefined when the flag stood alone (`--archived`). */
  value?: string
  /** True when the value was the next argv token (not `--name=value`). */
  fromNextToken: boolean
  /** `--name:str value` — explicit type, wins over the field map. */
  explicit?: ExplicitType
}

export interface ParsedInvocation {
  words: string[]
  positionals: string[]
  rawFields: RawField[]
  /** Fields typed by the heuristic only — call `typeFields` once the method is known. */
  fields: Record<string, unknown>
  yes: boolean
  dryRun: boolean
}

const EXPLICIT_TYPES = new Set<string>(['str', 'num', 'bool', 'json'])

/** Split leftover argv into words, positional values and --field values. */
export function parseArgv(argv: string[]): ParsedInvocation {
  const words: string[] = []
  const positionals: string[] = []
  const rawFields: RawField[] = []
  let yes = false
  let dryRun = false

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (token === '--yes' || token === '-y') {
      yes = true
    } else if (token === '--dry-run') {
      dryRun = true
    } else if (token.startsWith('--')) {
      const body = token.slice(2)
      const eq = body.indexOf('=')
      const head = eq > 0 ? body.slice(0, eq) : body
      const {name, explicit} = splitType(head)
      if (eq > 0) {
        rawFields.push({name, value: body.slice(eq + 1), fromNextToken: false, explicit})
      } else {
        const next = argv[i + 1]
        if (next !== undefined && !next.startsWith('--')) {
          rawFields.push({name, value: next, fromNextToken: true, explicit})
          i++
        } else {
          rawFields.push({name, fromNextToken: false, explicit})
        }
      }
    } else if (/^[a-z][a-z-]*$/i.test(token) && !looksLikeId(token)) {
      words.push(token)
    } else {
      positionals.push(token)
    }
  }

  return {words, positionals, rawFields, fields: typeFields(rawFields, {}).fields, yes, dryRun}
}

/** `name:str` → {name, explicit: 'str'}; a plain name passes through. */
function splitType(head: string): {name: string; explicit?: ExplicitType} {
  const colon = head.lastIndexOf(':')
  if (colon > 0) {
    const suffix = head.slice(colon + 1)
    if (EXPLICIT_TYPES.has(suffix)) return {name: head.slice(0, colon), explicit: suffix as ExplicitType}
  }

  return {name: head}
}

/**
 * Apply the request-field kinds of the matched method. A known boolean flag
 * that took the next token gives it back as a positional. Unknown fields
 * fall back to the old heuristic (true/false/integers are converted).
 */
export function typeFields(
  rawFields: RawField[],
  kinds: Record<string, FieldKind>,
): {fields: Record<string, unknown>; returned: string[]; errors: string[]} {
  const fields: Record<string, unknown> = {}
  const returned: string[] = []
  const errors: string[] = []

  for (const raw of rawFields) {
    const kind = kinds[raw.name]
    if (raw.explicit) {
      if (raw.value === undefined) {
        if (raw.explicit === 'bool') fields[raw.name] = true
        else errors.push(`--${raw.name}:${raw.explicit} needs a value`)
        continue
      }

      const typed = convert(raw.value, raw.explicit, `--${raw.name}:${raw.explicit}`)
      if (typed.error) errors.push(typed.error)
      else fields[raw.name] = typed.value
      continue
    }

    if (kind === 'boolean') {
      if (raw.value === undefined || !raw.fromNextToken) {
        fields[raw.name] = raw.value === undefined ? true : raw.value !== 'false'
      } else if (raw.value === 'true' || raw.value === 'false') {
        fields[raw.name] = raw.value === 'true'
      } else {
        // `--archived some_id`: the flag is boolean, the token was not for it.
        fields[raw.name] = true
        returned.push(raw.value)
      }

      continue
    }

    if (raw.value === undefined) {
      fields[raw.name] = true
      continue
    }

    if (kind === 'string') fields[raw.name] = raw.value
    else if (kind === 'number') {
      const n = Number(raw.value)
      if (Number.isNaN(n)) errors.push(`--${raw.name} expects a number, got "${raw.value}"`)
      else fields[raw.name] = n
    } else if (kind === 'json' || kind === 'json[]' || kind === 'string[]' || kind === 'number[]' || kind === 'boolean[]') {
      fields[raw.name] = looksLikeJson(raw.value) ? parseJsonOr(raw.value) : kind === 'string[]' ? raw.value.split(',') : coerce(raw.value)
    } else fields[raw.name] = coerce(raw.value)
  }

  return {fields, returned, errors}
}

function convert(value: string, type: ExplicitType, label: string): {value?: unknown; error?: string} {
  switch (type) {
    case 'str':
      return {value}
    case 'num': {
      const n = Number(value)
      return Number.isNaN(n) ? {error: `${label} expects a number, got "${value}"`} : {value: n}
    }

    case 'bool':
      if (value === 'true' || value === 'false') return {value: value === 'true'}
      return {error: `${label} expects true or false, got "${value}"`}
    default:
      try {
        return {value: JSON.parse(value)}
      } catch {
        return {error: `${label} is not valid JSON: ${value.slice(0, 80)}`}
      }
  }
}

function looksLikeJson(value: string): boolean {
  return /^\s*[[{]/.test(value)
}

function parseJsonOr(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

/** IDs look like maggr_..., sch_..., 66b2f0a1..., UPPER env names, etc. */
function looksLikeId(token: string): boolean {
  return /[_0-9]/.test(token) || token === token.toUpperCase()
}

/** The old heuristic, for fields the map does not know. */
function coerce(value: string): unknown {
  if (value === 'true') return true
  if (value === 'false') return false
  if (/^-?\d+$/.test(value)) return Number(value)
  return value
}

function camelSplit(name: string): string[] {
  const tokens = name
    .replaceAll(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(' ')
  // unArchive → "unarchive", one verb.
  const merged: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === 'un' && tokens[i + 1]) {
      merged.push('un' + tokens[++i])
    } else {
      merged.push(tokens[i])
    }
  }

  return merged
}

export {camelSplit}

function singular(word: string): string {
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y'
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
  return word
}

export interface MethodMatch {
  method: string
  exact: number
  extra: number
}

/**
 * Match user words against SDK method names. "aggregates get" prefers
 * getDatabaseAggregates (plural = list); "aggregate get" (or a positional id)
 * prefers getDatabaseAggregate.
 */
export function matchMethods(
  methods: string[],
  words: string[],
  moduleName: string,
): MethodMatch[] {
  const userWords = words.map((w) => w.toLowerCase().replaceAll('-', ''))
  const moduleTokens = new Set(camelSplit(moduleName))

  const matches: MethodMatch[] = []
  for (const method of methods) {
    // Exact camelCase method name typed by the user.
    if (words.length === 1 && words[0] === method) return [{method, exact: 99, extra: 0}]

    const tokens = camelSplit(method)
    let exact = 0
    let ok = true
    for (const w of userWords) {
      if (tokens.includes(w)) {
        exact++
      } else if (tokens.some((t) => singular(t) === singular(w))) {
        // singular/plural tolerant match
      } else {
        ok = false
        break
      }
    }

    if (!ok) continue
    const extra = tokens.filter((t) => !moduleTokens.has(t) && !userWords.some((w) => singular(w) === singular(t))).length
    matches.push({method, exact, extra})
  }

  matches.sort((a, b) => b.exact - a.exact || a.extra - b.extra || a.method.localeCompare(b.method))

  // Keep only the best-scoring group so callers can detect ambiguity.
  if (matches.length > 1) {
    const best = matches[0]
    return matches.filter((m) => m.exact === best.exact && m.extra === best.extra)
  }

  return matches
}

const DESTRUCTIVE_VERBS = new Set(['delete', 'remove', 'clean', 'regenerate', 'rotate', 'stop', 'disable', 'block'])

export function isDestructive(method: string): boolean {
  return DESTRUCTIVE_VERBS.has(camelSplit(method)[0])
}

/** Read-only verbs: no --dry-run needed, nothing changes. */
const READ_VERBS = new Set(['get', 'list', 'find', 'count', 'search', 'preview', 'render', 'reveal', 'check', 'validate', 'export', 'download', 'ping', 'echo', 'test', 'verify'])

export function isReadOnly(method: string): boolean {
  return READ_VERBS.has(camelSplit(method)[0])
}

/**
 * Module aliases so daily language works: `norbix hub db ...`, and
 * `norbix hub email templates get` routes into the notifications module
 * with "email" injected as a matching word.
 */
export const MODULE_ALIASES: Record<string, {module: string; injectWord?: string}> = {
  db: {module: 'database'},
  email: {module: 'notifications', injectWord: 'email'},
  envs: {module: 'environments'},
  fs: {module: 'files'},
  push: {module: 'notifications', injectWord: 'push'},
  sms: {module: 'notifications', injectWord: 'sms'},
}
