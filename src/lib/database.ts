import {readFileSync} from 'node:fs'

import type {Norbix} from '@norbix.ai/ts'
import {Flags} from '@oclif/core'

import {readJsonInput} from './json.js'

// `readJsonObject` is shared with the push and sms commands; it lives in
// ./push.ts and is used here unchanged.
export {readJsonObject} from './push.js'

/**
 * Read a JSON value given inline, as `@file.json`, or as `-` (stdin) and
 * return it as a normalized JSON string — the database DTOs take documents,
 * schemas and updates as JSON strings.
 */
export async function readJsonText(value: string, flagName: string): Promise<string> {
  const raw = value.startsWith('@') ? readFileSync(value.slice(1), 'utf8') : value
  return readJsonInput(raw, flagName)
}

/** `--integration`: the database integration to use instead of the project default. */
export const databaseIntegrationFlag = {
  integration: Flags.string({
    description: 'Database integration ID (default: the project default integration)',
  }),
}

type HubDatabase = Norbix['hub']['database']
type TriggerType = NonNullable<NonNullable<Parameters<HubDatabase['enableSchemaTrigger']>[0]>['triggerType']>
/** The `settings` body of `saveDatabaseSchema` (a generated type). */
export type SchemaSettings = NonNullable<NonNullable<Parameters<HubDatabase['saveDatabaseSchema']>[0]>['settings']>

/**
 * Every trigger under `db trigger` is a schema trigger. The generated
 * `TriggerType` is a TypeScript enum whose value is the wire string, so the
 * string is cast to it.
 */
export const SCHEMA_TRIGGER = 'Schema' as unknown as TriggerType

/** A file flag (`--file`): a path, or `-` for stdin — in the form `readJsonText` reads. */
export function fileSource(value: string): string {
  return value === '-' ? '-' : `@${value}`
}
