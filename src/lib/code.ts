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

/**
 * `code runs` for the terminal. A run through the Sandbox (Fake) provider carries
 * `input` — the envelope the function received, `context.runAs.accessToken`
 * masked, cut at 64 KB. It is printed under the run's row as pretty JSON (as
 * it came when the cut left it unparsable); every other field stays in the
 * row. Without any `input` the answer prints as it is. `--json` prints the
 * raw answer, `input` a string.
 */
export function formatRuns(res: unknown): string {
  const runs = (res as {runs?: unknown} | null | undefined)?.runs
  if (!Array.isArray(runs) || !runs.some((run) => typeof (run as {input?: unknown} | null)?.input === 'string')) {
    return JSON.stringify(res, null, 2)
  }

  return runs
    .map((run) => {
      const {input, ...row} = run as {input?: unknown} & Record<string, unknown>
      const text = JSON.stringify(row, null, 2)
      return typeof input === 'string' ? `${text}\ninput:\n${indent(formatRunInput(input))}` : text
    })
    .join('\n\n')
}

/** The `input` of one run, pretty-printed when it parses as JSON, as it came otherwise. */
export function formatRunInput(input: string): string {
  try {
    return JSON.stringify(JSON.parse(input), null, 2)
  } catch {
    return input
  }
}

function indent(text: string): string {
  return text
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n')
}
