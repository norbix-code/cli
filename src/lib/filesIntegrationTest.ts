import {NorbixError, type Norbix} from '@norbix.ai/ts'

/**
 * `POST /{version}/files/{filesIntegrationId}/test` — the API-surface probe of
 * a files integration (gateway slice API-TEST, 10b-files, issue #39). It
 * uploads a small file, reads it, lists the folder and deletes it again, and
 * answers one item per step.
 *
 * Sent through the SDK: `api.files.testFilesIntegration`. (`hub.files.
 * testFilesIntegration` is a DIFFERENT endpoint — the Hub one,
 * `POST /{version}/files/integrations/test` — so it is not used here.)
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

export async function callTestFilesIntegration(
  client: Norbix,
  filesIntegrationId: string,
): Promise<TestFilesIntegrationResult> {
  try {
    const res = await client.api.files.testFilesIntegration({filesIntegrationId})
    return (res ?? {}) as TestFilesIntegrationResult
  } catch (error) {
    // The SDK throws on a 2xx with `responseStatus.isSuccess = false`. Here
    // that answer is a result, not a failure of the call: the command prints
    // the gateway's errors (and any steps) itself and exits 2.
    if (error instanceof NorbixError && error.status >= 200 && error.status < 300 && isObject(error.raw)) {
      return error.raw as TestFilesIntegrationResult
    }

    throw error
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** `Failed` / `NotTested` / `NOT_TESTED` → `FAILED` / `NOT_TESTED`. */
export function normaliseResult(result: string | undefined): string {
  if (!result) return 'UNKNOWN'
  return result.replaceAll(/([a-z])([A-Z])/g, '$1_$2').replaceAll(/[\s-]+/g, '_').toUpperCase()
}
