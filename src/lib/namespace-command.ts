import {confirm} from '@inquirer/prompts'
import {Norbix} from '@norbix.ai/ts'

import {BaseCommand, type GlobalFlags} from '../base.js'
import {MODULE_ALIASES, camelSplit, isDestructive, matchMethods, parseArgv} from './dispatch.js'

type SdkModule = Record<string, (request: Record<string, unknown>) => Promise<unknown>>

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
    const VALUE_FLAGS = new Set(['--project', '--env', '--region', '--api-key', '--account', '--profile'])
    const BOOL_FLAGS = new Set(['--json'])
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
        return `  norbix ${this.target} ${moduleWord} ${form}${marker}`
      })
      .join('\n')

    this.print(
      `Commands in scope "${this.target} ${moduleWord}${labelWords.length > 0 ? ' ' + labelWords.join(' ') : ''}"` +
        `${scoped.length === 0 ? ' (no exact scope match — showing the whole module)' : ''}:\n\n${rows}\n\n` +
        `Add an ID as a plain value and request fields as flags:\n` +
        `  norbix ${this.target} ${moduleWord} ${this.wordForm(list[0], moduleName, hide)} <id> --someField value\n\n` +
        `Useful extras: --dry-run (preview the call), --yes (skip confirmation),\n` +
        `--json (machine output), --profile/--env/--region/--project (context).`,
    )
    return {scope: `${this.target}.${moduleName}`, commands: list.map((m) => this.wordForm(m, moduleName, hide))}
  }

  protected async dispatch(argv: string[], flags: GlobalFlags, help = false): Promise<unknown> {
    const parsed = parseArgv(argv)
    const [moduleWord, ...restWords] = parsed.words

    // Introspection client — never used for requests.
    const probe = new Norbix({projectId: 'introspect', apiKey: 'introspect'}, {envSource: {}})
    const namespace = probe[this.target] as unknown as Record<string, SdkModule>
    const moduleNames = Object.keys(namespace).sort()

    if (!moduleWord) {
      this.print(
        `Usage: norbix ${this.target} <module> <words...> [id] [--field value]\n\nModules:\n  ${moduleNames.join('\n  ')}\n\n` +
          `Get help at any level:\n  norbix ${this.target} <module> --help\n  norbix ${this.target} <module> <words...> --help\n\n` +
          `Example: norbix ${this.target} database aggregates delete maggr_123 --schemaId sch_456`,
      )
      return {modules: moduleNames}
    }

    const alias = MODULE_ALIASES[moduleWord]
    const moduleName = alias && namespace[alias.module] ? alias.module : moduleWord
    const sdkModule = namespace[moduleName]
    if (!sdkModule) {
      this.error(
        `Unknown module "${moduleWord}" on ${this.target}.\nAvailable: ${moduleNames.join(', ')}`,
      )
    }

    // Only real SDK methods — internals like `transport` are not callable.
    const methods = Object.keys(sdkModule)
      .filter((k) => typeof sdkModule[k] === 'function')
      .sort()

    if (help) {
      const injected = alias?.injectWord && moduleName !== moduleWord ? alias.injectWord : undefined
      const helpWords = injected ? [injected, ...restWords] : [...restWords]
      return this.scopeHelp(moduleWord, moduleName, methods, helpWords, restWords, injected)
    }

    if (restWords.length === 0 && parsed.positionals.length === 0) {
      this.print(
        `Methods of ${this.target}.${moduleName}:\n  ${methods.join('\n  ')}\n\nCall one with plain words, e.g.:\n  norbix ${this.target} ${moduleWord} aggregates get\n  norbix ${this.target} ${moduleWord} aggregates delete <id>`,
      )
      return {module: moduleName, methods}
    }

    const words = [...restWords]
    if (alias?.injectWord && moduleName !== moduleWord) words.unshift(alias.injectWord)
    const matches = matchMethods(methods, words, moduleName)
    if (matches.length === 0) {
      // Show only methods sharing at least one word — the full list can be 100+.
      const lower = words.map((w) => w.toLowerCase().replace(/s$/, ''))
      const related = methods.filter((m) => lower.some((w) => m.toLowerCase().includes(w)))
      const shown = (related.length > 0 ? related : methods).slice(0, 25)
      this.error(
        `No ${this.target}.${moduleName} method matches "${words.join(' ')}".\n` +
          `${related.length > 0 ? 'Close methods' : 'Methods'}:\n  ${shown.join('\n  ')}` +
          `${shown.length < methods.length ? `\n  … run \`norbix ${this.target} ${moduleWord}\` for the full list` : ''}`,
      )
    }

    if (matches.length > 1) {
      this.error(
        `"${words.join(' ')}" is ambiguous — did you mean:\n  ${matches.map((m) => m.method).join('\n  ')}\nAdd a word (e.g. the verb) to be specific.`,
      )
    }

    const method = matches[0].method
    const request: Record<string, unknown> = {...parsed.fields}
    if (parsed.positionals.length > 0 && request.id === undefined) {
      request.id = parsed.positionals[0]
      if (parsed.positionals.length > 1) {
        this.error(
          `Only one positional value is allowed (became "id"). Pass the rest as flags, e.g. --schemaId ${parsed.positionals[1]}`,
        )
      }
    }

    if (parsed.dryRun) {
      this.print({wouldCall: `${this.target}.${moduleName}.${method}`, request})
      return {method: `${this.target}.${moduleName}.${method}`, request, dryRun: true}
    }

    if (isDestructive(method) && !parsed.yes && process.stdout.isTTY) {
      const ok = await confirm({
        message: `Run ${method}(${JSON.stringify(request)})?`,
        default: false,
      })
      if (!ok) return this.print('Cancelled.')
    }

    const client = this.client(flags)
    const liveModule = (client[this.target] as unknown as Record<string, SdkModule>)[moduleName]
    const res = await liveModule[method](request)
    this.print(res)
    return res
  }
}
