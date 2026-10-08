import {Norbix} from '@norbix.ai/ts'

import {BaseCommand, type DryRunValidation, type GlobalFlags} from '../base.js'
import {usageError} from './cli-error.js'
import {MODULE_ALIASES, camelSplit, isDestructive, matchMethods, parseArgv, typeFields} from './dispatch.js'
import {readJsonInput} from './json.js'
import {describeFields, fieldKinds, methodInfo, type FieldKind} from './request-fields.js'

type SdkModule = Record<string, (request: Record<string, unknown>) => Promise<unknown>>

export interface NamespaceFlags extends GlobalFlags {
  body?: string
}

/** The text every scope help ends with: how values are typed. */
export const VALUE_RULES = `Values: words are lowercase letters; anything with digits, "_" or capitals is a
value (the first one becomes "id"). --field value is typed from the SDK's
request type (a string field keeps "0042"; a boolean flag never swallows the
next word). Force a type with --field:str, --field:num, --field:bool or
--field:json. Or pass the whole request as JSON: --body '{"id":"..."}' (or
--body - for stdin) — then no --field flags are allowed.`

/**
 * Shared engine for `norbix hub ...` and `norbix api ...` — resolves the
 * module and method from plain words and calls the SDK.
 */
export abstract class NamespaceCommand extends BaseCommand {
  protected abstract readonly target: 'api' | 'hub'

  /**
   * oclif rejects unknown flags even in non-strict mode, but here unknown
   * flags ARE the request fields (--schemaId ...). Split the raw argv:
   * known global flags go to oclif, everything else goes to the dispatcher.
   */
  protected splitArgv(): {flagArgv: string[]; rest: string[]; help: boolean} {
    const VALUE_FLAGS = new Set(['--project', '--env', '--region', '--api-key', '--account', '--profile', '--body'])
    const BOOL_FLAGS = new Set(['--json', '--yes', '-y', '--dry-run'])
    const flagArgv: string[] = []
    const rest: string[] = []
    let help = false
    const raw = this.argv

    for (let i = 0; i < raw.length; i++) {
      const token = raw[i]
      const name = token.split('=')[0]
      if (name === '--help' || name === '-h' || name === '--scope-help') {
        help = true
      } else if (VALUE_FLAGS.has(name)) {
        flagArgv.push(token)
        if (!token.includes('=') && raw[i + 1] !== undefined) flagArgv.push(raw[++i])
      } else if (BOOL_FLAGS.has(name)) {
        flagArgv.push(token)
      } else {
        rest.push(token)
      }
    }

    return {flagArgv, rest, help}
  }

  /** camelCase method → the plain-word form of this CLI (noun first, verb last). */
  protected wordForm(method: string, moduleName: string, hide: Set<string> = new Set()): string {
    const tokens = camelSplit(method)
    const moduleTokens = new Set(camelSplit(moduleName))
    const [verb, ...rest] = tokens
    const nouns = rest.filter((t) => !moduleTokens.has(t) && !hide.has(t))
    return [...nouns, verb].join(' ')
  }

  /** What `--json` returns for one method: word form, route and request fields. */
  protected describeMethod(moduleName: string, method: string, hide: Set<string>): Record<string, unknown> {
    const info = methodInfo(this.target, moduleName, method)
    return {
      method,
      words: this.wordForm(method, moduleName, hide),
      destructive: isDestructive(method),
      http: info?.http,
      path: info?.path,
      fields: info?.fields ?? [],
    }
  }

  /** Scoped help: everything callable under `norbix {target} {module} {words...}`. */
  protected scopeHelp(
    moduleWord: string,
    moduleName: string,
    methods: string[],
    words: string[],
    labelWords: string[] = words,
    hideWord?: string,
  ): unknown {
    const scoped =
      words.length === 0
        ? methods
        : methods.filter((m) => matchMethods([m], words, moduleName).length > 0)

    // The alias word (email/sms/push) is implied by the module word — hide it
    // from the printed forms so `hub email ...` reads naturally.
    const hide = new Set(hideWord ? [hideWord] : [])
    const list = scoped.length > 0 ? scoped : methods
    const rows = list
      .map((m) => {
        const form = this.wordForm(m, moduleName, hide)
        const marker = isDestructive(m) ? '  (asks confirmation)' : ''
        const fields = describeFields(methodInfo(this.target, moduleName, m))
        return `  norbix ${this.target} ${moduleWord} ${form}${marker}${fields ? `\n      fields: ${fields}` : ''}`
      })
      .join('\n')

    this.print(
      `Commands in scope "${this.target} ${moduleWord}${labelWords.length > 0 ? ' ' + labelWords.join(' ') : ''}"` +
        `${scoped.length === 0 ? ' (no exact scope match — showing the whole module)' : ''}:\n\n${rows}\n\n` +
        `Add an ID as a plain value and request fields as flags:\n` +
        `  norbix ${this.target} ${moduleWord} ${this.wordForm(list[0], moduleName, hide)} <id> --someField value\n\n` +
        `${VALUE_RULES}\n\n` +
        `Useful extras: --dry-run (preview the exact request), --yes (skip confirmation),\n` +
        `--json (machine output), --profile/--env/--region/--project (context).`,
    )
    return {
      scope: `${this.target}.${moduleName}`,
      commands: list.map((m) => this.describeMethod(moduleName, m, hide)),
      valueRules: VALUE_RULES,
    }
  }

  protected async dispatch(argv: string[], flags: NamespaceFlags, help = false): Promise<unknown> {
    const parsed = parseArgv(argv)
    const [moduleWord, ...restWords] = parsed.words

    // Introspection client — never used for requests.
    const probe = new Norbix({projectId: 'introspect', apiKey: 'introspect'}, {envSource: {}})
    const namespace = probe[this.target] as unknown as Record<string, SdkModule>
    const moduleNames = Object.keys(namespace).sort()

    if (!moduleWord) {
      this.print(
        `Usage: norbix ${this.target} <module> <words...> [id] [--field value | --body '<json>']\n\nModules:\n  ${moduleNames.join('\n  ')}\n\n` +
          `Get help at any level:\n  norbix ${this.target} <module> --help\n  norbix ${this.target} <module> <words...> --help\n\n` +
          `Example: norbix ${this.target} database aggregates delete maggr_123 --schemaId sch_456`,
      )
      return {modules: moduleNames}
    }

    const alias = MODULE_ALIASES[moduleWord]
    const moduleName = alias && namespace[alias.module] ? alias.module : moduleWord
    const sdkModule = namespace[moduleName]
    if (!sdkModule) {
      throw usageError(
        `Unknown module "${moduleWord}" on ${this.target}.`,
        `Available: ${moduleNames.join(', ')}`,
        `norbix ${this.target} --help`,
      )
    }

    // Only real SDK methods — internals like `transport` are not callable.
    const methods = Object.keys(sdkModule)
      .filter((k) => typeof sdkModule[k] === 'function')
      .sort()

    const injected = alias?.injectWord && moduleName !== moduleWord ? alias.injectWord : undefined
    const hide = new Set(injected ? [injected] : [])

    if (help) {
      const helpWords = injected ? [injected, ...restWords] : [...restWords]
      return this.scopeHelp(moduleWord, moduleName, methods, helpWords, restWords, injected)
    }

    if (restWords.length === 0 && parsed.positionals.length === 0 && parsed.rawFields.length === 0 && !flags.body) {
      this.print(
        `Methods of ${this.target}.${moduleName}:\n  ${methods.join('\n  ')}\n\nCall one with plain words, e.g.:\n  norbix ${this.target} ${moduleWord} aggregates get\n  norbix ${this.target} ${moduleWord} aggregates delete <id>\n\nSee fields per method: norbix ${this.target} ${moduleWord} --help (or --json)`,
      )
      return {module: moduleName, methods: methods.map((m) => this.describeMethod(moduleName, m, hide))}
    }

    const words = [...restWords]
    if (injected) words.unshift(injected)
    // An id (positional or --id) means one item: a verb-less tie picks get<One>, else get<Many>.
    const hasId = parsed.positionals.length > 0 || parsed.rawFields.some((f) => f.name === 'id')
    const matches = matchMethods(methods, words, moduleName, {hasId})
    if (matches.length === 0) {
      // Show only methods sharing at least one word — the full list can be 100+.
      const lower = words.map((w) => w.toLowerCase().replace(/s$/, ''))
      const related = methods.filter((m) => lower.some((w) => m.toLowerCase().includes(w)))
      const shown = (related.length > 0 ? related : methods).slice(0, 25)
      throw usageError(
        `No ${this.target}.${moduleName} method matches "${words.join(' ')}".`,
        `${related.length > 0 ? 'Close methods' : 'Methods'}: ${shown.join(', ')}` +
          `${shown.length < methods.length ? ` … run \`norbix ${this.target} ${moduleWord}\` for the full list` : ''}`,
        `norbix ${this.target} ${moduleWord} --help`,
      )
    }

    if (matches.length > 1) {
      throw usageError(
        `"${words.join(' ')}" is ambiguous — did you mean: ${matches.map((m) => m.method).join(', ')}`,
        'Add the verb (get, create, delete, …) to be specific, or type the camelCase method name itself.',
        `norbix ${this.target} ${moduleWord} --help`,
      )
    }

    const method = matches[0].method
    const info = methodInfo(this.target, moduleName, method)
    const request = await this.buildRequest(parsed, flags, info === undefined ? {} : fieldKinds(info), moduleName, method)

    // Context (auth, region, project) is resolved before any confirmation or
    // dry run, so a dry run that would fail for real fails here too.
    const client = this.client(flags)
    if (isDestructive(method)) {
      await this.confirmOrFail(`Run ${method}(${JSON.stringify(request)})?`, flags)
    }

    if (flags['dry-run'] && this.target === 'hub' && method === 'applyDatabaseSchemaBundle') {
      this.dryRunValidation = await this.validateBundle(flags, request)
    }

    const liveModule = (client[this.target] as unknown as Record<string, SdkModule>)[moduleName]
    const res = await liveModule[method](request)
    this.print(res)
    return res
  }

  /**
   * A dry run of a schema bundle asks the Hub to check the bundle JSON
   * (`account.validateSchema` writes nothing): a plain dry run only shows the
   * request and would say nothing about a bundle the real call rejects.
   */
  private async validateBundle(flags: NamespaceFlags, request: Record<string, unknown>): Promise<DryRunValidation> {
    const raw = request.bundleJson
    if (raw === undefined || raw === null || raw === '') {
      return {checked: false, note: 'no bundleJson — catalog entities (--entities) are checked by the real call only'}
    }

    const schemaJson = typeof raw === 'string' ? raw : JSON.stringify(raw)
    const checkedWith = 'hub.account.validateSchema'
    try {
      const live = this.client({...flags, 'dry-run': false} as NamespaceFlags, {requireProject: false})
      const res = await live.hub.account.validateSchema({schemaJson})
      return {
        checkedWith,
        checked: true,
        valid: Boolean(res.valid),
        issues: (res.issues ?? []).map((i) => ({where: i.where, code: i.code, message: i.message})),
        collections: res.collections ?? [],
      }
    } catch (error) {
      return {checkedWith, checked: false, note: `the check failed: ${error instanceof Error ? error.message : String(error)}`}
    }
  }

  /** The request object: `--body` as a whole, or the typed `--field` flags plus the positional id. */
  private async buildRequest(
    parsed: ReturnType<typeof parseArgv>,
    flags: NamespaceFlags,
    kinds: Record<string, FieldKind>,
    moduleName: string,
    method: string,
  ): Promise<Record<string, unknown>> {
    let request: Record<string, unknown>
    let positionals = parsed.positionals

    if (flags.body !== undefined) {
      if (parsed.rawFields.length > 0) {
        throw usageError(
          `--body carries the whole request; --${parsed.rawFields[0].name} cannot be combined with it.`,
          'Put every field inside the --body JSON object, or drop --body and use --field flags only.',
          `norbix ${this.target} --help`,
        )
      }

      const body = JSON.parse(await readJsonInput(flags.body, 'body')) as unknown
      if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        throw usageError('--body must be a JSON object.', `Example: --body '{"id":"${positionals[0] ?? 'abc123'}"}'`)
      }

      request = {...(body as Record<string, unknown>)}
    } else {
      const typed = typeFields(parsed.rawFields, kinds)
      if (typed.errors.length > 0) {
        throw usageError(typed.errors.join('; '), `Fields of ${method}: ${describeFields(methodInfo(this.target, moduleName, method)) || 'see --help'}`)
      }

      request = typed.fields
      positionals = [...positionals, ...typed.returned]
    }

    if (positionals.length > 0 && request.id === undefined) {
      request.id = positionals[0]
      if (positionals.length > 1) {
        throw usageError(
          `Only one positional value is allowed (became "id"). Pass the rest as flags, e.g. --schemaId ${positionals[1]}`,
          'Use --field value for every other request field, or --body for the whole request.',
          `norbix ${this.target} --help`,
        )
      }
    }

    return request
  }
}
