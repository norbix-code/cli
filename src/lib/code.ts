import {readFileSync} from 'node:fs'

import {usageError} from './cli-error.js'
import {readJsonInput} from './json.js'

/** Helpers shared by the `norbix code` commands (cloud functions). */

/** `--source` as the user types it → the gateway's `CodeFunctionSource` member. */
export const EVENT_SOURCES: Record<string, string> = {
  database: 'Database',
  membership: 'Membership',
  files: 'Files',
  payments: 'Payments',
  ai: 'Ai',
  scheduler: 'Scheduler',
  manual: 'Manual',
}

export function eventSource(value: string): string {
  const member = EVENT_SOURCES[value.toLowerCase()]
  if (!member) {
    throw usageError(
      `--source "${value}" is not an event source.`,
      `One of: ${Object.keys(EVENT_SOURCES).join(', ')}.`,
    )
  }
  return member
}

/**
 * The payload of `code invoke`: `--payload '<json>'` (also `@file` or `-` for
 * stdin) or `--payload-file <path>`. Must be a JSON object — it becomes
 * `data.payload` of the envelope.
 */
export async function readPayload(flags: {payload?: string; 'payload-file'?: string}): Promise<Record<string, unknown> | undefined> {
  if (flags.payload && flags['payload-file']) {
    throw usageError('Pass either --payload or --payload-file, not both.', `--payload '{"orderId":"…"}' or --payload-file payload.json.`)
  }
  let text: string | undefined
  if (flags['payload-file']) {
    try {
      text = readFileSync(flags['payload-file'], 'utf8')
    } catch {
      throw usageError(`--payload-file: cannot read the file "${flags['payload-file']}".`, 'Check the path, e.g. --payload-file payload.json.')
    }
  } else if (flags.payload) {
    text = await readJsonInput(flags.payload, 'payload')
  }
  if (text === undefined) return undefined

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw usageError('--payload-file is not valid JSON.', 'The file must hold one JSON object, e.g. {"orderId":"…","dryRun":true}.')
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw usageError('The payload must be a JSON object.', `It becomes data.payload of the envelope, e.g. --payload '{"orderId":"…"}'.`)
  }
  return parsed as Record<string, unknown>
}
