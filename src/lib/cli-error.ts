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
  /**
   * Every error item the server sent (`responseStatus.errors[]`): code and
   * message. Only when the body had some.
   */
  errors?: ErrorItem[]
  /**
   * The start (≤ 500 chars) of the response body when it held no error items
   * the CLI could read — an HTML or plain-text page from a proxy, an empty
   * JSON object, ... Only when the server answered with such a body.
   */
  body?: string
  /** Seconds to wait before sending again (429: `Retry-After` header or `RetryAfterSeconds` on the error). */
  retryAfterSeconds?: number
  /** The URL that was called, when known. */
  url?: string
  /** Server trace / correlation id, when the server returned one. */
  traceId?: string
  /** What to do next. */
  hint?: string
  /** Where to read more: a URL or `norbix <cmd> --help`. */
  docs?: string
}

/** One gateway error item: `{errorCode, message}` (plus the field it names). */
export interface ErrorItem {
  code?: string
  message?: string
  field?: string
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
  errors?: ErrorItem[]
  body?: string
  retryAfterSeconds?: number
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
  readonly errors?: ErrorItem[]
  readonly body?: string
  readonly retryAfterSeconds?: number

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
    this.errors = init.errors
    this.body = init.body
    this.retryAfterSeconds = init.retryAfterSeconds
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
  retryAfterSeconds?: number
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

/** Gateway: files register refused because the project already runs the most register calls at once (HTTP 429). */
export const REGISTER_BUSY_CODE = 'CM-ERRORS-FILES-031'

/** How much of a body the envelope keeps when it has no error items. */
export const BODY_SNIPPET_LENGTH = 500

/** The start of a response body, whitespace collapsed, for people and logs. */
export function bodySnippet(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) return undefined
  const textBody = typeof raw === 'string' ? raw : JSON.stringify(raw)
  const flat = (textBody ?? '').replaceAll(/\s+/g, ' ').trim()
  if (!flat) return undefined
  return flat.length > BODY_SNIPPET_LENGTH ? `${flat.slice(0, BODY_SNIPPET_LENGTH)}…` : flat
}

/** Every error item with a code or a message, in the server's order. */
function errorItemsOf(items: NorbixErrorItemLike[] | undefined): ErrorItem[] | undefined {
  const out = (items ?? [])
    .filter((i) => i.errorCode !== undefined || i.message !== undefined)
    .map((i) => compactItem({code: i.errorCode, message: i.message, field: i.fieldName}))
  return out.length > 0 ? out : undefined
}

function compactItem(item: ErrorItem): ErrorItem {
  return Object.fromEntries(Object.entries(item).filter(([, v]) => v !== undefined)) as ErrorItem
}

/**
 * Seconds to wait before sending again: the `Retry-After` header (the SDK's
 * `retryAfterSeconds`) or `RetryAfterSeconds` the gateway puts on the error
 * item's context (e.g. CM-ERRORS-FILES-031, CM-ERRORS-LOGGING-003).
 */
function retryAfterOf(err: {retryAfterSeconds?: unknown; fieldErrors?: NorbixErrorItemLike[]}): number | undefined {
  const fromHeader = secondsOf(err.retryAfterSeconds)
  if (fromHeader !== undefined) return fromHeader
  for (const item of err.fieldErrors ?? []) {
    if (!isRecord(item.meta)) continue
    for (const [key, value] of Object.entries(item.meta)) {
      if (key.toLowerCase() !== 'retryafterseconds') continue
      const seconds = secondsOf(value)
      if (seconds !== undefined) return seconds
    }
  }

  return undefined
}

function secondsOf(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN
  return Number.isFinite(n) && n >= 0 ? Math.ceil(n) : undefined
}

/** `fetch failed` hides the reason in `cause` (ECONNREFUSED, ENOTFOUND, ...). */
function networkReason(message: string, cause: unknown): string {
  const c = cause as {code?: unknown; message?: unknown} | undefined
  const detail = typeof c?.code === 'string' ? c.code : typeof c?.message === 'string' ? c.message : undefined
  return detail && !message.includes(detail) ? `${message} (${detail})` : message
}

const SDK_LOCAL_CODES: Record<string, ExitCode> = {
  NORBIX_NOT_AUTHENTICATED: EXIT.AUTH,
  NORBIX_ACCOUNT_SCOPE_REQUIRED: EXIT.USAGE,
  NORBIX_MISSING_PATH_PARAM: EXIT.USAGE,
}

function hintForExit(exit: ExitCode, env: {status?: number; url?: string; code?: string; retryAfterSeconds?: number}, command?: string): string {
  const help = command ? `norbix ${command} --help` : 'norbix --help'
  if (env.retryAfterSeconds !== undefined || env.status === 429) {
    const wait = env.retryAfterSeconds === undefined ? 'a little' : `${env.retryAfterSeconds} second${env.retryAfterSeconds === 1 ? '' : 's'}`
    if (env.code === REGISTER_BUSY_CODE) {
      return `Register busy: the project already has the most register calls running at once. Retry after ${wait}, when one of them has finished.`
    }

    return `Rate limited. Retry after ${wait}.`
  }

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
      errors: err.errors,
      body: err.body,
      retryAfterSeconds: err.retryAfterSeconds,
      traceId: err.traceId,
      hint: err.hint ?? hintForExit(err.exit, {status: err.status, url: err.url, code: err.code, retryAfterSeconds: err.retryAfterSeconds}, ctx.command),
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
    const status = err.status && err.status > 0 ? err.status : undefined
    const errors = isNetwork ? undefined : errorItemsOf(err.fieldErrors)
    // No error item and no message the CLI could read: show what the server
    // did send (an HTML page from a proxy, plain text, an unexpected JSON).
    const generic = /^Request failed \(HTTP \d+\)$/.test(err.message)
    const body = isNetwork || status === undefined ? undefined : typeof err.raw === 'string' || (!errors && generic) ? bodySnippet(err.raw) : undefined
    const retryAfterSeconds = isNetwork ? undefined : retryAfterOf(err)
    return compact({
      code,
      message: isNetwork ? networkReason(err.message, (err.raw as {cause?: unknown} | undefined)?.cause) : err.message,
      status,
      exit,
      fieldErrors: fieldErrorsOf(err.raw, err.fieldErrors),
      context: contextOf(err.fieldErrors, code),
      errors,
      body,
      retryAfterSeconds,
      url: err.url,
      traceId: traceIdOf(err.raw),
      hint: hintForExit(exit, {status: err.status, url: err.url, code, retryAfterSeconds}, ctx.command),
      docs,
    })
  }

  if (err instanceof Error) {
    const anyErr = err as Error & {oclif?: {exit?: number}; code?: string; parse?: unknown}
    // A bare `fetch` that never reached the server (connection refused, DNS, TLS).
    if (err.name === 'TypeError' && err.message === 'fetch failed') {
      return compact({
        code: 'NORBIX_NETWORK_ERROR',
        message: networkReason(err.message, (err as {cause?: unknown}).cause),
        exit: EXIT.NETWORK,
        hint: hintForExit(EXIT.NETWORK, {}, ctx.command),
        docs,
      })
    }

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
  if (env.retryAfterSeconds !== undefined) details.push(`retryAfterSeconds: ${env.retryAfterSeconds}`)
  if (env.url) details.push(`url: ${env.url}`)
  if (env.traceId) details.push(`traceId: ${env.traceId}`)
  for (const [key, value] of Object.entries(env.context ?? {})) details.push(`context.${key}: ${contextText(value)}`)
  if (env.fieldErrors) {
    for (const [field, messages] of Object.entries(env.fieldErrors)) details.push(`${field}: ${messages.join('; ')}`)
  }

  // The first item is already the message and code above; list them all when there are more.
  const items = env.errors ?? []
  if (items.length > 1 || (items.length === 1 && items[0].message !== env.message)) {
    details.push('errors:')
    for (const item of items) details.push(`  - ${[item.code, item.field ? `${item.field}:` : undefined, item.message].filter(Boolean).join(' ')}`)
  }

  if (env.body) details.push(`body: ${env.body}`)
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
