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
 */

export interface ParsedInvocation {
  words: string[]
  positionals: string[]
  fields: Record<string, unknown>
  yes: boolean
  dryRun: boolean
}

/** Split leftover argv into words, positional values and --field values. */
export function parseArgv(argv: string[]): ParsedInvocation {
  const words: string[] = []
  const positionals: string[] = []
  const fields: Record<string, unknown> = {}
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
      if (eq > 0) {
        // --field=value syntax
        fields[body.slice(0, eq)] = coerce(body.slice(eq + 1))
      } else {
        const next = argv[i + 1]
        if (next !== undefined && !next.startsWith('--')) {
          fields[body] = coerce(next)
          i++
        } else {
          fields[body] = true
        }
      }
    } else if (/^[a-z][a-z-]*$/i.test(token) && !looksLikeId(token)) {
      words.push(token)
    } else {
      positionals.push(token)
    }
  }

  return {words, positionals, fields, yes, dryRun}
}

/** IDs look like maggr_..., sch_..., 66b2f0a1..., UPPER env names, etc. */
function looksLikeId(token: string): boolean {
  return /[_0-9]/.test(token) || token === token.toUpperCase()
}

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

const DESTRUCTIVE_VERBS = new Set(['delete', 'remove', 'clean', 'regenerate', 'rotate', 'stop'])

export function isDestructive(method: string): boolean {
  return DESTRUCTIVE_VERBS.has(camelSplit(method)[0])
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
