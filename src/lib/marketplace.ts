import {usageError} from './cli-error.js'
import {readJsonInput} from './json.js'

/** Helpers shared by the `norbix code marketplace` commands. */

/** The gateway's `MarketplaceCategory` members (the `--category` options). */
export const MARKETPLACE_CATEGORIES = [
  'Other', 'Crm', 'Erp', 'Marketing', 'Communication', 'Productivity', 'Storage', 'Analytics',
  'Identity', 'Payments', 'DevTools', 'Ai', 'Files', 'Database', 'Calendar',
]

/** The gateway's `MarketplaceTransport` members (the `--transport` options). */
export const MARKETPLACE_TRANSPORTS = ['Mcp', 'Rest', 'Code', 'Internal', 'Sdk']

/** The value types a declared input may have (`MarketplaceFunctionParameterDto.type`). */
export const INPUT_TYPES = ['string', 'number', 'boolean', 'object', 'array']

/**
 * Repeated `--flag key=value` → `{key: value}`. The first `=` splits; the
 * value may contain more. Undefined when the flag was not given.
 */
export function parseKeyValues(values: string[] | undefined, flagName: string): Record<string, string> | undefined {
  if (!values?.length) return undefined
  const bag: Record<string, string> = {}
  for (const pair of values) {
    const at = pair.indexOf('=')
    if (at < 1) {
      throw usageError(`--${flagName} must look like key=value, got "${pair}".`, `e.g. --${flagName} databaseIntegrationId=int_6rBACnEaxQ0x1jTiHtAuWV`)
    }

    bag[pair.slice(0, at)] = pair.slice(at + 1)
  }

  return bag
}

/**
 * The function's `arguments` (a `string → string` bag on the wire): a JSON
 * object from `--arguments` (inline, @file or -), then each `--arg key=value`
 * on top. A non-string JSON value is sent as its JSON text — `{"filter":
 * {"status":"paid"}}` becomes `filter: '{"status":"paid"}'`, `pageSize: 20`
 * becomes `"20"` — which is what the family forms store.
 */
export async function readArguments(flags: {arguments?: string; arg?: string[]}): Promise<Record<string, string> | undefined> {
  let bag: Record<string, string> | undefined
  if (flags.arguments) {
    const parsed = JSON.parse(await readJsonInput(flags.arguments, 'arguments')) as unknown
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw usageError('--arguments must be a JSON object.', `e.g. --arguments '{"collection":"orders","filter":{"status":"paid"}}'`)
    }

    bag = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (value === null || value === undefined) continue
      bag[key] = typeof value === 'string' ? value : JSON.stringify(value)
    }
  }

  const pairs = parseKeyValues(flags.arg, 'arg')
  if (pairs) bag = {...bag, ...pairs}
  return bag
}

export interface DeclaredInput {
  name: string
  type: string
  isRequired: boolean
}

/** Repeated `--input name[:type[:required]]` → declared invocation inputs. Type defaults to string. */
export function parseInputs(values: string[] | undefined): DeclaredInput[] | undefined {
  if (!values?.length) return undefined
  return values.map((spec) => {
    const [name, type = 'string', flag, ...rest] = spec.split(':')
    if (!name || rest.length > 0 || !INPUT_TYPES.includes(type) || (flag !== undefined && flag !== 'required')) {
      throw usageError(
        `--input "${spec}" is not name[:type[:required]].`,
        `type is one of ${INPUT_TYPES.join(', ')}; e.g. --input orderNo:string:required`,
      )
    }

    return {name, type, isRequired: flag === 'required'}
  })
}

interface StepResult {
  key?: string
  label?: string
  requiredForFunctions?: boolean
  succeeded?: boolean
  skipped?: boolean
  message?: string
}

/**
 * The add-functions gate after a validation run: open when every step the
 * listing marks `requiredForFunctions` ran green (the server refuses Add with
 * CM-ERRORS-MARKETPLACE-013 otherwise). `blocking` names the keys that keep it shut.
 */
export function functionsGate(res: unknown): {open: boolean; blocking: string[]} {
  const steps = stepsOf(res) ?? []
  const blocking = steps.filter((s) => s.requiredForFunctions && !(s.succeeded && !s.skipped)).map((s) => s.key ?? s.label ?? '?')
  return {open: blocking.length === 0, blocking}
}

/**
 * `connections validate` for the terminal: one line per step in the listing's
 * order — state (ok / failed / skipped), key, label, "required" when it gates
 * Add, the message — then the gate line.
 */
export function formatValidation(res: unknown): string {
  const steps = stepsOf(res)
  if (!steps) {
    return `${JSON.stringify(res, null, 2)}\nThis Hub reported no validation steps.`
  }

  const lines = steps.map((s) => {
    const state = s.skipped ? 'skipped' : s.succeeded ? 'ok' : 'failed'
    const required = s.requiredForFunctions ? ' (required)' : ''
    const message = s.message ? ` — ${s.message}` : ''
    return `${state.padEnd(7)} ${s.key ?? ''}  ${s.label ?? ''}${required}${message}`
  })
  const gate = functionsGate(res)
  lines.push(
    '',
    gate.open
      ? 'Functions: can be added.'
      : `Functions: blocked until these required steps pass: ${gate.blocking.join(', ')}.`,
  )
  return lines.join('\n')
}

function stepsOf(res: unknown): StepResult[] | undefined {
  const steps = (res as {steps?: unknown} | null | undefined)?.steps
  return Array.isArray(steps) ? (steps as StepResult[]) : undefined
}

/** What `runs --details` says for a row whose run wrote no log lines. */
export const RUN_DETAILS_NEED_LOGS = "details need the project's logs on"

/** One log line of a run's details (a `TenantLogEntryDto` from GET /logs/audit). */
export interface RunDetailLine {
  timestamp?: string
  level?: string
  eventCode?: string
  title?: string
  message?: string
  meta?: Record<string, string>
}

/** A run row with its details: the log lines, or `null` plus the note when the run has none. */
export type RunWithDetails = Record<string, unknown> & {details: RunDetailLine[] | null; detailsNote?: string}

/**
 * Only a row with `hasDetails: true` and a `correlationId` has log lines: they
 * are written only while the environment's Norbix Logging is on.
 */
export function runCorrelationWithDetails(run: unknown): string | undefined {
  const row = run as {hasDetails?: unknown; correlationId?: unknown} | null | undefined
  return row?.hasDetails === true && typeof row.correlationId === 'string' && row.correlationId !== ''
    ? row.correlationId
    : undefined
}

/**
 * `runs --details` for the terminal: each row as JSON (a Fake-vendor `input`
 * pretty-printed under it, as without --details), then its log lines — one line
 * each (time, level, event code, title) with `meta` indented — or the note.
 */
export function formatRunsWithDetails(runs: RunWithDetails[]): string {
  if (runs.length === 0) return 'No runs.'
  return runs
    .map((run) => {
      const {details, detailsNote, input, ...row} = run
      const parts = [JSON.stringify(row, null, 2)]
      if (typeof input === 'string') parts.push(`input:\n${indentText(prettyJson(input))}`)
      if (details === null) {
        parts.push(`details: ${detailsNote ?? RUN_DETAILS_NEED_LOGS}`)
      } else if (details.length === 0) {
        parts.push('details: no log lines under this correlation id')
      } else {
        parts.push(
          'details:',
          ...details.map((line) => {
            const head = `  ${line.timestamp ?? ''} ${line.level ?? ''} ${line.eventCode ?? ''}  ${line.title ?? ''}`.trimEnd()
            const meta = line.meta && Object.keys(line.meta).length > 0 ? `\n${indentText(JSON.stringify(line.meta, null, 2), '    ')}` : ''
            return `${head}${meta}`
          }),
        )
      }

      return parts.join('\n')
    })
    .join('\n\n')
}

function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

function indentText(text: string, pad = '  '): string {
  return text
    .split('\n')
    .map((line) => `${pad}${line}`)
    .join('\n')
}

/** One tool of an MCP connection's stored catalog (`MarketplaceMcpToolDto`, route 24). */
export interface McpToolRow {
  name?: string
  title?: string
  description?: string
  inputSchema?: string
  readOnlyHint?: boolean
  destructiveHint?: boolean
}

/**
 * What a tool may do, from the server's own hints: `read-only` when it says
 * readOnlyHint, else `writes` (the MCP default), `writes (destructive)` when it
 * also says destructiveHint. Hints are the server's claims, not a guarantee.
 */
export function toolAccess(tool: McpToolRow): string {
  if (tool.readOnlyHint === true) return 'read-only'
  return tool.destructiveHint === true ? 'writes (destructive)' : 'writes'
}

/**
 * `connections tools` for the terminal: a table of name, access and the first
 * line of the description (cut at 80 characters), then when the catalog was
 * listed, its hash, and a note when the gateway cut it at its limit.
 */
export function formatToolCatalog(res: unknown): string {
  const catalog = (res ?? {}) as {tools?: unknown; listedAt?: string; catalogHash?: string; truncated?: boolean}
  const tools = Array.isArray(catalog.tools) ? (catalog.tools as McpToolRow[]) : []
  if (tools.length === 0) return 'No tools in the stored catalog.'

  const rows = tools.map((t) => {
    const first = (t.description ?? t.title ?? '').split('\n')[0]!.trim()
    return {name: t.name ?? '?', access: toolAccess(t), description: first.length > 80 ? `${first.slice(0, 79)}…` : first}
  })
  const nameWidth = Math.max(4, ...rows.map((r) => r.name.length))
  const accessWidth = Math.max(6, ...rows.map((r) => r.access.length))
  const lines = [
    `${'NAME'.padEnd(nameWidth)}  ${'ACCESS'.padEnd(accessWidth)}  DESCRIPTION`,
    ...rows.map((r) => `${r.name.padEnd(nameWidth)}  ${r.access.padEnd(accessWidth)}  ${r.description}`.trimEnd()),
    '',
    `${tools.length} tool${tools.length === 1 ? '' : 's'}${catalog.listedAt ? `, listed ${catalog.listedAt}` : ''}${catalog.catalogHash ? `, catalog ${catalog.catalogHash}` : ''}.`,
  ]
  if (catalog.truncated) lines.push('The server offered more tools than the gateway keeps; the list is cut.')
  lines.push('Add one as a function: norbix code marketplace functions add --connection <int_id> --key <tool name> --arg <name>=<value>')
  return lines.join('\n')
}
