import type {Norbix} from '@norbix.ai/ts'

/**
 * The four "make it public / make it private" Hub endpoints (gateway slice
 * PUB, 10b-files): `POST /{version}/files/item/public`, `files/item/private`,
 * `files/folder/public` and `files/folder/private`.
 *
 * They go through the SDK (`hub.files.makeFilePublic` and friends), so the
 * headers, the Hub version, a session refresh and `--dry-run` work exactly as
 * for every other command. The SDK also turns an error status, and a 2xx with
 * `responseStatus.isSuccess = false` (a business refusal, 10b-files issue
 * #67), into a `NorbixError` — the command exits non-zero for both.
 */

export type PublicFilesOperation =
  | 'makeFilePrivate'
  | 'makeFilePublic'
  | 'makeFolderPrivate'
  | 'makeFolderPublic'

/** What the gateway answers with: an id for publish, nothing for unpublish. */
export interface PublicFilesResult {
  id?: string
  status?: string
}

export async function callPublicFiles(
  client: Norbix,
  operation: PublicFilesOperation,
  body: {filesIntegrationId: string; path: string},
): Promise<PublicFilesResult> {
  // publish answers an IdResponse, unpublish an EmptyResponse (or no body).
  const res = (await client.hub.files[operation](body)) as PublicFilesResult | undefined
  return res ?? {}
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
