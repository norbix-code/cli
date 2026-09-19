import {NorbixAuthError, NorbixError, NorbixValidationError} from '@norbix.ai/ts'

import type {ResolvedContext} from '../base.js'

/**
 * `POST /{version}/files/{filesIntegrationId}/test` — the API-surface probe of
 * a files integration (gateway slice API-TEST, 10b-files, issue #39). It
 * uploads a small file, reads it, lists the folder and deletes it again, and
 * answers one item per step.
 *
 * ---------------------------------------------------------------------------
 * Why this file exists, and when it should go away
 *
 * The published `@norbix.ai/ts` the CLI depends on (^1.3.0) has no method for
 * this endpoint. `api.files.testFilesIntegration` is added by
 * https://github.com/norbix-code/sdk-ts/pull/44, which is not released yet.
 * (`hub.files.testFilesIntegration` in 1.3.0 is a DIFFERENT endpoint — the Hub
 * one, `POST /{version}/files/integrations/test` — so it is not used here.)
 *
 * So the CLI sends the request itself, the way the SDK transport would: same
 * headers, same version, no body (the only field is in the path), and the same
 * error classes for an error status.
 *
 * TODO(10b-API-TEST): once `@norbix.ai/ts` ships `api.files.testFilesIntegration`,
 * bump the dependency and replace the body of `callTestFilesIntegration` with
 *   client.api.files.testFilesIntegration({filesIntegrationId})
 * The command and its tests do not change.
 * ---------------------------------------------------------------------------
 */

/** One probe step as the gateway answers it. */
export interface IntegrationTestResultItem {
  operation: string
  /** `OK`, `FAILED` or `NOT_TESTED` (skipped because an earlier step failed). */
  result: string
  errors?: string[]
}

export interface ResponseStatusError {
  message?: string
  errorCode?: string
}

export interface TestFilesIntegrationResult {
  items?: IntegrationTestResultItem[]
  responseStatus?: {
    isSuccess?: boolean
    errors?: ResponseStatusError[]
    message?: string
    errorCode?: string
  }
}

/** The API version the SDK talks by default. Kept in one place. */
const API_VERSION = 'v2'

export async function callTestFilesIntegration(
  ctx: ResolvedContext,
  filesIntegrationId: string,
): Promise<TestFilesIntegrationResult> {
  const token = ctx.bearerToken ?? ctx.apiKey
  const headers = new Headers({Accept: 'application/json'})
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (ctx.projectId) {
    headers.set('norbix-project-id', ctx.projectId)
    headers.set('X-CM-ProjectId', ctx.projectId)
  }
  if (ctx.accountId) {
    headers.set('norbix-account-id', ctx.accountId)
    headers.set('X-CM-AccountId', ctx.accountId)
  }
  if (ctx.env && ctx.env !== 'PROD') headers.set('norbix-env', ctx.env)
  if (ctx.region) headers.set('nb-region', ctx.region)

  const base = ctx.apiUrl.endsWith('/') ? ctx.apiUrl.slice(0, -1) : ctx.apiUrl
  const url = `${base}/${API_VERSION}/files/${encodeURIComponent(filesIntegrationId)}/test`

  const response = await fetch(url, {headers, method: 'POST'})
  const text = await response.text()
  let raw: unknown
  if (text) {
    try {
      raw = JSON.parse(text)
    } catch {
      raw = text
    }
  }

  if (!response.ok) throw errorFrom(response.status, raw, url)

  return (raw && typeof raw === 'object' ? raw : {}) as TestFilesIntegrationResult
}

/** Same mapping as the SDK transport: 401/403 → auth, 400 → validation, else NorbixError. */
function errorFrom(status: number, raw: unknown, url: string): NorbixError {
  const body = raw && typeof raw === 'object' ? (raw as TestFilesIntegrationResult & ResponseStatusError) : undefined
  const payload = body?.responseStatus ?? body
  const message =
    payload?.message ??
    body?.responseStatus?.errors?.find((e) => e.message)?.message ??
    `Request failed with status ${status}`
  const opts = {code: payload?.errorCode, message, raw, status, url}
  if (status === 401 || status === 403) return new NorbixAuthError(opts)
  if (status === 400) return new NorbixValidationError(opts)
  return new NorbixError(opts)
}

/** `Failed` / `NotTested` / `NOT_TESTED` → `FAILED` / `NOT_TESTED`. */
export function normaliseResult(result: string | undefined): string {
  if (!result) return 'UNKNOWN'
  return result.replaceAll(/([a-z])([A-Z])/g, '$1_$2').replaceAll(/[\s-]+/g, '_').toUpperCase()
}
