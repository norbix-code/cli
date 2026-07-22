import {Flags} from '@oclif/core'
import {extname} from 'node:path'

/** Shared flag: which files integration to talk to. */
export const integrationFlag = Flags.string({
  char: 'i',
  description: 'Files integration ID',
  env: 'NORBIX_FILES_INTEGRATION_ID',
})

/** Resolve the files integration ID: flag > env (via oclif) > config file. */
export function resolveIntegration(
  flagValue: string | undefined,
  storedValue: string | undefined,
): string | undefined {
  return flagValue ?? storedValue
}

const MIME_BY_EXT: Record<string, string> = {
  '.css': 'text/css',
  '.csv': 'text/csv',
  '.gif': 'image/gif',
  '.html': 'text/html',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.webp': 'image/webp',
  '.xml': 'application/xml',
  '.zip': 'application/zip',
}

export function guessContentType(fileName: string): string {
  return MIME_BY_EXT[extname(fileName).toLowerCase()] ?? 'application/octet-stream'
}
