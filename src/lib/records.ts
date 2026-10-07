import {usageError} from './cli-error.js'

/**
 * Checks the record commands run before they send anything. The gateway makes
 * the same checks; doing them here gives a plain hint and sends no request.
 */

/** True when the filter (a JSON string) is `{}` — it matches every record. */
export function isEmptyFilter(filter: string): boolean {
  const parsed: unknown = JSON.parse(filter)
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) && Object.keys(parsed).length === 0
}

/**
 * Refuse an empty filter without `--all`. The gateway refuses it too
 * (CM-ERRORS-DATABASE-037) unless the request sets `allRecords: true`.
 */
export function refuseEmptyFilter(filter: string, command: 'update' | 'delete'): void {
  if (!isEmptyFilter(filter)) return
  throw usageError(
    `--filter '{}' matches every record in the collection.`,
    `To ${command} all records on purpose, use \`norbix db ${command} <collection> --all\` instead of --filter.`,
  )
}

/**
 * Refuse an update body with `$` operators (`$set`, `$inc`, …). The update
 * is the plain fields to change; the gateway applies it with `$set` itself and
 * refuses an operator (CM-ERRORS-DATABASE-035).
 */
export function refuseUpdateOperators(update: string): void {
  const parsed: unknown = JSON.parse(update)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw usageError('--update must be a JSON object of the fields to change.', `For example --update '{"status":"paid"}'.`)
  }

  const operators = Object.keys(parsed).filter((key) => key.startsWith('$'))
  if (operators.length === 0) return
  throw usageError(
    `--update has the operator${operators.length > 1 ? 's' : ''} ${operators.join(', ')}; a record update takes the plain fields to change.`,
    `Send the fields themselves, e.g. --update '{"status":"paid"}' — the gateway applies them with $set.`,
  )
}

/**
 * `--array-filters` is a JSON array of filter documents, one per `$[name]`
 * in the update paths. The gateway refuses any other shape, and a filter
 * without its `$[name]` (or the other way round).
 */
export function requireJsonArray(value: string, flagName: string): void {
  const parsed: unknown = JSON.parse(value)
  if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'object' && item !== null && !Array.isArray(item))) return
  throw usageError(
    `--${flagName} must be a JSON array of filter objects.`,
    `For example --${flagName} '[{"line.sku":"A-1"}]' with --update '{"lines.$[line].qty":3}'.`,
  )
}
