import {EXIT, codeForExit, exitForStatus, type ExitCode} from './exit-codes.js'

/**
 * One error shape for the whole CLI: `{"error": {...}}` on stdout in JSON
 * mode, `Error: ... / Hint: ...` on stderr in text mode. Every failure
 * (SDK, parser, JSON input, prompt, bug) goes through `toEnvelope`.
 *
 * No oclif import here on purpose: the MCP server shares this envelope.
 */

export interface ErrorEnvelope {
  /** Machine code: the SDK / gateway code when there is one, else derived. */
  code: string
  message: string
  /** HTTP status when the server answered. */
  status?: number
  exit: ExitCode
  /** Field → messages, only when the server named fields. */
  fieldErrors?: Record<string, string[]>
  /**
   * Extra values the gateway attached to the error (`context` on the wire),
   * e.g. `{missingPermissions: "files:create"}`. Only when there are some.
   */
  context?: Record<string, unknown>
  /** The URL that was called, when known. */
  url?: string
  /** Server trace / correlation id, when the server returned one. */
  traceId?: string
  /** What to do next. */
  hint?: string
  /** Where to read more: a URL or `norbix <cmd> --help`. */
  docs?: string
}

export interface CliErrorInit {
  exit: ExitCode
  code?: string
  message: string
  hint?: string
  docs?: string
  status?: number
  fieldErrors?: Record<string, string[]>
  url?: string
  traceId?: string
  /** Extra values for scripts, e.g. `{reason: "EmailNotVerified"}` (JSON envelope `context`). */
  context?: Record<string, unknown>
}

/** An error the CLI raises itself, already carrying its exit code and hint. */
export class CliError extends Error {
  readonly exit: ExitCode
  readonly code: string
  readonly hint?: string
  readonly docs?: string
  readonly status?: number
  readonly fieldErrors?: Record<string, string[]>
  readonly url?: string
  readonly traceId?: string
  readonly context?: Record<string, unknown>

  constructor(init: CliErrorInit) {
    super(init.message)
    this.name = 'CliError'
    this.exit = init.exit
    this.code = init.code ?? codeForExit(init.exit)
    this.hint = init.hint
    this.docs = init.docs
    this.status = init.status
    this.fieldErrors = init.fieldErrors
    this.url = init.url
    this.traceId = init.traceId
    this.context = init.context
  }
}

/** Shortcut for the most common CLI-raised error: a usage problem (exit 2). */
export function usageError(message: string, hint?: string, docs?: string): CliError {
  return new CliError({exit: EXIT.USAGE, code: 'USAGE_ERROR', message, hint, docs})
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** `responseStatus` block of a gateway body, whatever the casing of the key. */
function responseStatusOf(raw: unknown): Record<string, unknown> | undefined {
  if (!isRecord(raw)) return undefined
  for (const key of Object.keys(raw)) {
    if (key.toLowerCase() === 'responsestatus' && isRecord(raw[key])) return raw[key] as Record<string, unknown>
  }

  return undefined
}

/** Trace id from wherever the gateway puts it (top level or responseStatus/meta). */
export function traceIdOf(raw: unknown): string | undefined {
  const rs = responseStatusOf(raw)
  const meta = isRecord(rs?.meta) ? rs.meta : undefined
  const top = isRecord(raw) ? raw : undefined
  return (
    text(top?.traceId) ??
    text(top?.correlationId) ??
    text(rs?.traceId) ??
    text(rs?.correlationId) ??
    text(meta?.traceId) ??
    text(meta?.correlationId)
  )
}

/**
 * Field errors as `{field: [messages]}` from both shapes the gateway uses:
 * an `errors` array of `{fieldName, message}` items (ServiceStack) or an
 * `errors` object keyed by field.
 */
export function fieldErrorsOf(raw: unknown, items?: Array<{fieldName?: string; message?: string; errorCode?: string}>): Record<string, string[]> | undefined {
  const out: Record<string, string[]> = {}
  for (const item of items ?? []) {
    if (!item.fieldName) continue
    ;(out[item.fieldName] ??= []).push(item.message ?? item.errorCode ?? 'invalid')
  }

  const source = responseStatusOf(raw) ?? (isRecord(raw) ? raw : undefined)
  const errors = source?.errors
  if (isRecord(errors)) {
    for (const [field, value] of Object.entries(errors)) {
      const messages = Array.isArray(value) ? value.map(String) : [String(value)]
      out[field] = [...(out[field] ?? []), ...messages]
    }
  }

  return Object.keys(out).length > 0 ? out : undefined
}

interface NorbixErrorItemLike {
  fieldName?: string
  message?: string
  errorCode?: string
  /** The SDK's name for the wire `context`. */
  meta?: Record<string, unknown>
}

interface NorbixErrorLike {
  name: string
  message: string
  status?: number
  code?: string
  fieldErrors?: NorbixErrorItemLike[]
  raw?: unknown
  url?: string
}

/** Duck-typed: the SDK's NorbixError family, without importing the SDK here. */
function isNorbixError(err: unknown): err is NorbixErrorLike {
  return err instanceof Error && typeof (err as {status?: unknown}).status === 'number' && err.name.startsWith('Norbix')
}

/**
 * The `context` of the error the envelope reports: the item carrying the same
 * code, else the first item that has one. Absent when no item has any.
 */
export function contextOf(items: NorbixErrorItemLike[] | undefined, code?: string): Record<string, unknown> | undefined {
  const withMeta = (items ?? []).filter((item) => isRecord(item.meta) && Object.keys(item.meta).length > 0)
  const item = withMeta.find((i) => code !== undefined && i.errorCode === code) ?? withMeta[0]
  return item?.meta
}

const SDK_LOCAL_CODES: Record<string, ExitCode> = {
  NORBIX_NOT_AUTHENTICATED: EXIT.AUTH,
  NORBIX_ACCOUNT_SCOPE_REQUIRED: EXIT.USAGE,
  NORBIX_MISSING_PATH_PARAM: EXIT.USAGE,
}

function hintForExit(exit: ExitCode, env: {status?: number; url?: string}, command?: string): string {
  const help = command ? `norbix ${command} --help` : 'norbix --help'
  switch (exit) {
    case EXIT.AUTH:
      return env.status === 403
        ? 'The key is valid but has no permission for this call. Use a key with the right permissions, or --profile <name>.'
        : 'Not authenticated or the session expired. Run `norbix login`, pass --api-key, or use --profile <name>.'
    case EXIT.NOT_FOUND:
      return 'Check the id, the --env and the --project. List items first (e.g. `norbix users list --json`).'
    case EXIT.VALIDATION:
      return `The server rejected the request. fieldErrors names the fields; see ${help}.`
    case EXIT.NETWORK:
      return `Could not reach ${env.url ?? 'the endpoint'}. Check the host (--host / NORBIX_HOST / host in the profile), --region, and connectivity.`
    case EXIT.SERVER:
      return 'Retry with backoff. If it keeps failing, report it with the traceId.'
    case EXIT.USAGE:
      return `Run ${help} or \`norbix schema ${command ?? ''} --json\`.`.replace('  ', ' ')
    default:
      return 'Unexpected error. Re-run with --json for details and report it with the traceId.'
  }
}

/** Map any thrown value to the one error envelope. */
export function toEnvelope(err: unknown, ctx: {command?: string} = {}): ErrorEnvelope {
  const docs = ctx.command ? `norbix ${ctx.command} --help` : 'norbix --help'

  if (err instanceof CliError) {
    return compact({
      code: err.code,
      message: err.message,
      status: err.status,
      exit: err.exit,
      fieldErrors: err.fieldErrors,
      context: err.context,
      url: err.url,
      traceId: err.traceId,
      hint: err.hint ?? hintForExit(err.exit, {status: err.status, url: err.url}, ctx.command),
      docs: err.docs ?? docs,
    })
  }

  if (isNorbixError(err)) {
    const isNetwork = err.name === 'NorbixNetworkError' || err.name === 'NorbixTimeoutError'
    const exit: ExitCode = isNetwork
      ? EXIT.NETWORK
      : (err.code && SDK_LOCAL_CODES[err.code]) || exitForStatus(err.status === 0 ? undefined : err.status)
    // The SDK reads `errorCode`; some answers carry `code` instead.
    const bodyCode = isRecord(err.raw) ? (text(err.raw.code) ?? text(err.raw.errorCode)) : undefined
    const code = err.code ?? bodyCode ?? (isNetwork && err.name === 'NorbixTimeoutError' ? 'TIMEOUT' : codeForExit(exit))
    return compact({
      code,
      message: err.message,
      status: err.status && err.status > 0 ? err.status : undefined,
      exit,
      fieldErrors: fieldErrorsOf(err.raw, err.fieldErrors),
      context: contextOf(err.fieldErrors, code),
      url: err.url,
      traceId: traceIdOf(err.raw),
      hint: hintForExit(exit, {status: err.status, url: err.url}, ctx.command),
      docs,
    })
  }

  if (err instanceof Error) {
    const anyErr = err as Error & {oclif?: {exit?: number}; code?: string; parse?: unknown}
    // Ctrl+C at an @inquirer prompt.
    if (err.name === 'ExitPromptError') {
      return compact({code: 'CANCELLED', message: 'Cancelled.', exit: EXIT.CANCELLED})
    }

    // oclif parser errors (missing arg, unknown flag, bad option) and every
    // `this.error(...)` call: usage, exit 2.
    if (anyErr.parse !== undefined || anyErr.oclif?.exit === 2 || /Error$/.test(err.name) && anyErr.oclif !== undefined) {
      return compact({
        code: 'USAGE_ERROR',
        message: cleanParserMessage(err.message),
        exit: EXIT.USAGE,
        hint: hintForExit(EXIT.USAGE, {}, ctx.command),
        docs,
      })
    }

    return compact({
      code: 'INTERNAL_ERROR',
      message: err.message || String(err),
      exit: EXIT.INTERNAL,
      hint: hintForExit(EXIT.INTERNAL, {}, ctx.command),
      docs,
    })
  }

  return compact({
    code: 'INTERNAL_ERROR',
    message: String(err),
    exit: EXIT.INTERNAL,
    hint: hintForExit(EXIT.INTERNAL, {}, ctx.command),
    docs,
  })
}

/** oclif's parser wraps its message in boilerplate the envelope already covers. */
function cleanParserMessage(message: string): string {
  return message
    .replace(/^The following errors? occurred:\s*/, '')
    .replace(/\s*See more help with --help\s*$/, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
}

/** Text rendering for stderr (no ANSI codes). */
export function formatErrorText(env: ErrorEnvelope): string {
  const lines = [`Error: ${env.message}`]
  const details: string[] = []
  if (env.code && env.code !== 'INTERNAL_ERROR' && env.code !== 'USAGE_ERROR') details.push(`code: ${env.code}`)
  if (env.status !== undefined) details.push(`status: ${env.status}`)
  if (env.url) details.push(`url: ${env.url}`)
  if (env.traceId) details.push(`traceId: ${env.traceId}`)
  for (const [key, value] of Object.entries(env.context ?? {})) details.push(`context.${key}: ${contextText(value)}`)
  if (env.fieldErrors) {
    for (const [field, messages] of Object.entries(env.fieldErrors)) details.push(`${field}: ${messages.join('; ')}`)
  }

  for (const d of details) lines.push(`  ${d}`)
  if (env.hint) lines.push(`Hint: ${env.hint}`)
  if (env.docs) lines.push(`Docs: ${env.docs}`)
  return lines.join('\n')
}

function contextText(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(', ')
  if (typeof value === 'string') return value
  return JSON.stringify(value) ?? String(value)
}

function compact(env: ErrorEnvelope): ErrorEnvelope {
  return Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined)) as unknown as ErrorEnvelope
}
