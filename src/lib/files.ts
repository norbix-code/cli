import type {Norbix} from '@norbix.ai/ts'
import {Flags} from '@oclif/core'
import {extname} from 'node:path'

import {CliError, toEnvelope, usageError} from './cli-error.js'
import {EXIT} from './exit-codes.js'

/** Shared flag: which files integration to talk to. */
export const integrationFlag = Flags.string({
  char: 'i',
  description: 'Files integration ID (default: the project default files integration of the environment)',
  env: 'NORBIX_FILES_INTEGRATION_ID',
})

/** What a dry run sends instead of looking the default integration up. */
export const DRY_RUN_FILES_INTEGRATION = '<default files integration>'

/**
 * The project's default files integration in the current environment —
 * like the database commands, which use the default database integration
 * when no --integration is given (N6). One read of the Hub's integration list:
 * its `defaultIntegrationId` is resolved for the environment of the call
 * (Hub.Files/Integrations/GetAll.cs). The list itself is project-wide (its
 * items carry no environment), so an integration is never picked from it —
 * it may belong to another environment. No integration at all, and no
 * default here, are two different errors.
 */
export async function defaultFilesIntegration(hub: Pick<Norbix['hub'], 'files'>, env: string | undefined): Promise<string> {
  const where = `environment ${env ?? 'PROD'}`
  let res: Awaited<ReturnType<Norbix['hub']['files']['getFilesIntegrations']>>
  try {
    res = await hub.files.getFilesIntegrations({})
  } catch (error) {
    const envelope = toEnvelope(error)
    throw new CliError({
      ...envelope,
      message: `No files integration ID given, and the project's files integrations could not be read: ${envelope.message}`,
      hint: 'Pass --integration <id>, set NORBIX_FILES_INTEGRATION_ID, or save one: norbix config set files_integration_id <id>.',
      docs: 'norbix files list --help',
    })
  }

  if (res.defaultIntegrationId) return res.defaultIntegrationId
  const items = (res.list?.items ?? []) as Array<{viewId: string; integrationName?: string}>
  if (items.length === 0) {
    throw new CliError({
      exit: EXIT.NOT_FOUND,
      code: 'NO_FILES_INTEGRATION',
      message: `This project has no files integration (looked up for ${where}).`,
      hint:
        `Add one in the dashboard (Files → Integrations) or with \`norbix hub files saveFilesIntegration --body '<json>'\`` +
        `${env && env !== 'PROD' ? `, or pass --env for the environment that has one` : ''}; then run the command again.`,
      docs: 'norbix integrations files --help',
    })
  }

  throw usageError(
    `No default files integration in ${where}.`,
    `Pass --integration <id> (or save one: norbix config set files_integration_id <id>). The project's files integrations (all environments — the list does not say which):\n${items.map((i) => `  ${i.viewId}${i.integrationName ? `  ${i.integrationName}` : ''}`).join('\n')}`,
    'norbix integrations files --help',
  )
}

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
