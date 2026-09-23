import {NorbixAuthError, NorbixError, NorbixValidationError} from '@norbix.ai/ts'

/**
 * Reading a gateway error body, for the two places the CLI still calls the
 * gateway with `fetch` instead of the SDK (the files integration probe and the
 * public-files calls — endpoints the published `@norbix.ai/ts` does not carry
 * yet).
 *
 * The gateway puts its message and its error code inside
 * `responseStatus.errors[]`, not at the top of the block. Reading the top gave
 * every caller "Request failed with status 404" and no code (10b-files slice
 * ERRORS, issue #66).
 *
 * TODO(10b-ERRORS): once `@norbix.ai/ts` 2.0.0 is published, delete this file
 * and import `errorFromBody` / `isFailedBody` from the SDK — it exports the
 * same readers, and one implementation is better than two.
 */

export interface GatewayErrorItem {
  errorCode?: string
  fieldName?: string
  message?: string
  context?: Record<string, string | null>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The `responseStatus` block of a body, whatever the casing of the key. */
function responseStatusOf(raw: unknown): Record<string, unknown> | undefined {
  if (!isRecord(raw)) return undefined
  for (const key of Object.keys(raw)) {
    if (key.toLowerCase() === 'responsestatus') {
      const value = raw[key]
      return isRecord(value) ? value : undefined
    }
  }

  return undefined
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function itemsOf(value: unknown): GatewayErrorItem[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry) => isRecord(entry)).map((entry) => entry as GatewayErrorItem)
}

/**
 * True when the gateway said the call failed inside the body.
 *
 * A business refusal — an unknown id, a rule that says no — comes back as HTTP
 * 200 with `responseStatus.isSuccess = false` (10b-files, issue #67).
 */
export function saysItFailed(raw: unknown): boolean {
  const status = responseStatusOf(raw)
  return isRecord(status) && status.isSuccess === false
}

/** The message and the error code a gateway answer carries. */
export function readGatewayError(
  raw: unknown,
  status: number,
): {code?: string; errors: GatewayErrorItem[]; message: string} {
  const responseStatus = responseStatusOf(raw)
  // `source` is responseStatus when the body has one, the body itself when it
  // has none — so the top-level fields are read only in the second case.
  const source = responseStatus ?? (isRecord(raw) ? raw : undefined)

  const errors = itemsOf(source?.errors)
  const first = errors.find((e) => e.message !== undefined || e.errorCode !== undefined)

  return {
    code: first?.errorCode ?? text(source?.errorCode),
    errors,
    message: first?.message ?? text(source?.message) ?? `Request failed (HTTP ${status})`,
  }
}

/** Build the right NorbixError for a status and an already-parsed body. */
export function gatewayError(status: number, raw: unknown, url?: string): NorbixError {
  const {code, message} = readGatewayError(raw, status)
  const opts = {code, message, raw, status, url}
  if (status === 401 || status === 403) return new NorbixAuthError(opts)
  if (status === 400) return new NorbixValidationError(opts)
  return new NorbixError(opts)
}
