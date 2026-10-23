import {errorFromBody, isFailedBody} from '@norbix.ai/ts'

import {CliError, toEnvelope} from './cli-error.js'

/**
 * For the few commands that call a Norbix endpoint with `fetch` instead of
 * the SDK (raw, push device delete, environment admin URL, password reset
 * test): read the answer the same way the SDK does, so a failure reaches the
 * one error envelope with its status, every error item, the body when it is
 * not a Norbix error (HTML or text from a proxy) and the retry hint.
 */

/** The body as JSON when it parses, else the text itself (undefined when empty). */
export function parseBody(text: string): unknown {
  if (!text) return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

export interface CheckOptions {
  /** A note added to the message, e.g. "this hub is older than ...". */
  note?: (status: number, hasErrors: boolean) => string | undefined
}

/**
 * Reads the answer and throws a `CliError` when it is a failure (non-2xx, or
 * a 2xx with `responseStatus.isSuccess: false`). Returns the parsed body.
 */
export async function readNorbixResponse(res: Response, url: string | URL, options: CheckOptions = {}): Promise<unknown> {
  const text = await res.text()
  const raw = parseBody(text)
  if (res.ok && !isFailedBody(raw)) return raw
  throw responseError(res.status, raw, String(url), res.headers.get('retry-after') ?? undefined, options)
}

/** A failed answer as a `CliError`: `HTTP <status>: <code> <message>; ...`. */
export function responseError(status: number, raw: unknown, url: string, retryAfter?: string, options: CheckOptions = {}): CliError {
  const sdkError = errorFromBody({status, raw, url, retryAfterSeconds: secondsOf(retryAfter)})
  const env = toEnvelope(sdkError)
  const why = (env.errors ?? []).map((e) => [e.code, e.message].filter(Boolean).join(' ')).join('; ')
  const note = options.note?.(status, why.length > 0)
  return new CliError({
    exit: env.exit,
    code: env.code,
    message: `HTTP ${status}${why ? `: ${why}` : ''}${note ? ` (${note})` : ''}`,
    status: env.status,
    fieldErrors: env.fieldErrors,
    context: env.context,
    errors: env.errors,
    body: env.body,
    retryAfterSeconds: env.retryAfterSeconds,
    url: env.url,
    traceId: env.traceId,
    // No hint / docs here: the envelope derives them with the command's name.
  })
}

function secondsOf(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined
  const n = Number(value)
  if (Number.isFinite(n) && n >= 0) return Math.ceil(n)
  const at = Date.parse(value)
  return Number.isNaN(at) ? undefined : Math.max(0, Math.ceil((at - Date.now()) / 1000))
}
