import {NorbixError} from '@norbix.ai/ts'

import type {ResolvedContext} from '../base.js'

/**
 * The four "make it public / make it private" Hub endpoints (gateway slice
 * PUB, 10b-files).
 *
 * ---------------------------------------------------------------------------
 * Why this file exists, and when it should go away
 *
 * These endpoints are new. The published `@norbix.ai/ts` the CLI depends on
 * (1.2.0) has no method for them yet — slice SDK-2 adds them, but that release
 * has not happened. So the CLI sends the request itself, with exactly the
 * headers the SDK's own transport sends.
 *
 * Once `@norbix.ai/ts` ships `hub.files.makeFilePublic` and friends, bump the
 * dependency and replace the body of `callPublicFiles` with the SDK call. The
 * two commands above it do not change.
 * ---------------------------------------------------------------------------
 */

export type PublicFilesOperation =
  | 'makeFilePrivate'
  | 'makeFilePublic'
  | 'makeFolderPrivate'
  | 'makeFolderPublic'

const ROUTES: Record<PublicFilesOperation, string> = {
  makeFilePrivate: 'files/item/private',
  makeFilePublic: 'files/item/public',
  makeFolderPrivate: 'files/folder/private',
  makeFolderPublic: 'files/folder/public',
}

/** What the gateway answers with: an id for publish, nothing for unpublish. */
export interface PublicFilesResult {
  id?: string
  status?: string
}

/** The Hub version the SDK talks by default. Kept in one place. */
const HUB_VERSION = 'v2'

export async function callPublicFiles(
  ctx: ResolvedContext,
  operation: PublicFilesOperation,
  body: {filesIntegrationId: string; path: string},
): Promise<PublicFilesResult> {
  const token = ctx.bearerToken ?? ctx.apiKey
  const headers = new Headers({
    Accept: 'application/json',
    'Content-Type': 'application/json',
  })
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (ctx.projectId) headers.set('X-CM-ProjectId', ctx.projectId)
  if (ctx.accountId) headers.set('X-CM-AccountId', ctx.accountId)
  if (ctx.env && ctx.env !== 'PROD') headers.set('norbix-env', ctx.env)
  if (ctx.region) headers.set('nb-region', ctx.region)

  const base = ctx.hubUrl.endsWith('/') ? ctx.hubUrl.slice(0, -1) : ctx.hubUrl
  const url = `${base}/${HUB_VERSION}/${ROUTES[operation]}`

  const response = await fetch(url, {body: JSON.stringify(body), headers, method: 'POST'})
  const text = await response.text()
  let payload: PublicFilesResult & {message?: string} = {}
  if (text) {
    try {
      payload = JSON.parse(text) as typeof payload
    } catch {
      payload = {}
    }
  }

  if (!response.ok) {
    throw new NorbixError({
      code: payload.status,
      message: payload.message ?? text ?? 'Request failed',
      status: response.status,
    })
  }

  return payload
}

/**
 * The address anyone can open. The gateway builds the same one and puts it on
 * the file's `publicUrl`; this is what to print right after publishing, when
 * the caller has only just been handed the id.
 *
 * `remote` is the path that was published. For a file the link ends with its
 * name; for a folder it ends with a slash, and a file inside it is reached by
 * appending the path inside the folder.
 */
export function publicUrlFor(apiUrl: string, publicId: string, remote: string, isFolder: boolean): string {
  const base = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl
  if (isFolder) return `${base}/v3/files/public/${publicId}/`
  const name = remote.split('/').filter(Boolean).pop() ?? remote
  return `${base}/v3/files/public/${publicId}/${name.split('/').map(encodeURIComponent).join('/')}`
}
