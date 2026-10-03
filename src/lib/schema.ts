import {EXIT_CODES} from './exit-codes.js'

/**
 * `norbix schema [command] --json`: the whole command surface as data, so an
 * agent can discover the CLI without reading source. Built from plain
 * descriptors (the command converts oclif's manifest into them) — no oclif
 * import here, so the MCP server can emit the same document.
 */

export interface SchemaArg {
  name: string
  required: boolean
  description?: string
  options?: string[]
}

export interface SchemaFlag {
  name: string
  char?: string
  type: 'boolean' | 'string' | 'integer' | 'option'
  description?: string
  required?: boolean
  multiple?: boolean
  options?: string[]
  env?: string
  default?: unknown
  /** True for the context flags every command takes (--project, --profile, --json, ...). */
  global?: boolean
}

export interface SchemaCommand {
  id: string
  description: string
  /** Asks for confirmation; exits 3 without a terminal unless --yes. */
  destructive: boolean
  /** Accepts --dry-run: resolves context, prints the request, sends nothing. */
  supportsDryRun: boolean
  args: SchemaArg[]
  flags: SchemaFlag[]
  examples: string[]
}

export interface CliSchema {
  cli: 'norbix'
  version: string
  contract: string
  exitCodes: Record<string, {name: string; meaning: string; hint: string}>
  commands: SchemaCommand[]
  dynamic: {hub: string; api: string; valueRules: string}
}

/** What the command hands in for every entry of the manifest. */
export interface CommandDescriptor {
  id: string
  description?: string
  hidden?: boolean
  args: Record<string, {name?: string; required?: boolean; description?: string; options?: string[]}>
  flags: Record<
    string,
    {
      name?: string
      char?: string
      type?: string
      description?: string
      required?: boolean
      multiple?: boolean
      options?: string[]
      env?: string
      default?: unknown
      helpGroup?: string
      hidden?: boolean
    }
  >
  examples?: Array<string | {description?: string; command: string}>
}

export const CONTRACT_PATH = 'docs/agent-contract.md'
export const CONTRACT_URL = 'https://github.com/norbix-code/cli/blob/main/docs/agent-contract.md'

export const DYNAMIC_HELP = {
  hub: 'norbix hub <module> --help lists every method with its request fields; norbix hub <module> --json returns them as data; call with plain words: norbix hub <module> <words...> [id] [--field value | --body <json>]',
  api: 'norbix api <module> --help / --json — same engine as hub, for the data-plane API',
}

export function buildSchema(input: {version: string; bin?: string; commands: CommandDescriptor[]; valueRules: string}): CliSchema {
  const bin = input.bin ?? 'norbix'
  const commands = input.commands
    .filter((c) => !c.hidden)
    .map((c) => toSchemaCommand(c, bin))
    .sort((a, b) => a.id.localeCompare(b.id))

  const exitCodes: CliSchema['exitCodes'] = {}
  for (const e of EXIT_CODES) exitCodes[String(e.code)] = {name: e.name, meaning: e.meaning, hint: e.hint}

  return {
    cli: 'norbix',
    version: input.version,
    contract: `${CONTRACT_PATH} (${CONTRACT_URL})`,
    exitCodes,
    commands,
    dynamic: {...DYNAMIC_HELP, valueRules: input.valueRules},
  }
}

function toSchemaCommand(c: CommandDescriptor, bin: string): SchemaCommand {
  const flags = Object.entries(c.flags)
    .filter(([, f]) => !f.hidden)
    .map(([name, f]) => {
      const flag: SchemaFlag = {name: f.name ?? name, type: flagType(f.type, f.options)}
      if (f.char) flag.char = f.char
      if (f.description) flag.description = f.description
      if (f.required) flag.required = true
      if (f.multiple) flag.multiple = true
      if (f.options) flag.options = f.options
      if (f.env) flag.env = f.env
      if (f.default !== undefined && f.default !== false) flag.default = f.default
      if (f.helpGroup === 'GLOBAL' || name === 'json') flag.global = true
      return flag
    })

  const args = Object.entries(c.args).map(([name, a]) => {
    const arg: SchemaArg = {name: a.name ?? name, required: Boolean(a.required)}
    if (a.description) arg.description = a.description
    if (a.options) arg.options = a.options
    return arg
  })

  const names = new Set(flags.map((f) => f.name))
  return {
    id: c.id.replaceAll(':', ' '),
    description: (c.description ?? '').split('\n')[0],
    destructive: names.has('yes'),
    supportsDryRun: names.has('dry-run'),
    args,
    flags,
    examples: (c.examples ?? []).map((e) => (typeof e === 'string' ? e : e.command).replaceAll('<%= config.bin %>', bin)),
  }
}

function flagType(type: string | undefined, options: string[] | undefined): SchemaFlag['type'] {
  if (type === 'boolean') return 'boolean'
  if (options && options.length > 0) return 'option'
  return 'string'
}

/** Compact text table for humans. */
export function formatSchemaTable(schema: CliSchema): string {
  const width = Math.max(...schema.commands.map((c) => c.id.length))
  const lines = schema.commands.map((c) => {
    const marks = [c.destructive ? 'destructive' : '', c.supportsDryRun ? 'dry-run' : ''].filter(Boolean).join(', ')
    return `${c.id.padEnd(width)}  ${c.description}${marks ? `  [${marks}]` : ''}`
  })
  return [
    `norbix ${schema.version} — ${schema.commands.length} commands. Contract: ${schema.contract}`,
    '',
    ...lines,
    '',
    `Dynamic: ${schema.dynamic.hub}`,
    `         ${schema.dynamic.api}`,
    '',
    'Exit codes: ' + Object.entries(schema.exitCodes).map(([code, e]) => `${code}=${e.name}`).join(' '),
    '',
    'Machine form: norbix schema --json, or norbix schema <command> --json for one command.',
  ].join('\n')
}
