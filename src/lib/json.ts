import {readFileSync} from 'node:fs'

import {usageError} from './cli-error.js'

/** Helpers for JSON flags: inline JSON, `@path` for a file, or `-` to read from stdin. */

export async function readJsonInput(value: string, flagName: string): Promise<string> {
  const raw = value === '-' ? await readStdin() : value.startsWith('@') ? readJsonFile(value.slice(1), flagName) : value
  try {
    // Parse + re-stringify: validates and normalizes the JSON the backend
    // receives (all Norbix DTOs take filters/documents as JSON strings).
    return JSON.stringify(JSON.parse(raw))
  } catch {
    throw usageError(
      `--${flagName} is not valid JSON: ${truncate(raw)}`,
      `Pass a JSON document in quotes, e.g. --${flagName} '{"status":"paid"}', @file.json, or \`-\` to read it from stdin.`,
    )
  }
}

function readJsonFile(path: string, flagName: string): string {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    throw usageError(`--${flagName}: cannot read the file "${path}".`, `Check the path after @, e.g. --${flagName} @orders.json.`)
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

function truncate(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}
