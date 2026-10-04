import {readFileSync} from 'node:fs'

/**
 * The request-field map generated from the installed SDK
 * (`scripts/gen-request-fields.mjs` → `src/generated/request-fields.json`):
 * for every `api.*` / `hub.*` method, its HTTP route and request fields.
 * Loaded lazily — only `hub`/`api` and `schema` read it.
 *
 * No oclif import: the MCP server can list the same fields.
 */

export type FieldKind = 'string' | 'number' | 'boolean' | 'json' | 'string[]' | 'number[]' | 'boolean[]' | 'json[]'

export interface RequestField {
  name: string
  /** The TypeScript type as the SDK declares it (for display). */
  type: string
  kind: FieldKind
  required: boolean
  /** Enum values when the type is an enum. */
  options?: string[]
}

export interface MethodInfo {
  http: string
  path: string
  dto: string
  fields: RequestField[]
}

export interface RequestFieldMap {
  sdk: string
  api: Record<string, Record<string, MethodInfo>>
  hub: Record<string, Record<string, MethodInfo>>
}

let cached: RequestFieldMap | undefined

export function loadRequestFields(): RequestFieldMap {
  cached ??= JSON.parse(readFileSync(new URL('../generated/request-fields.json', import.meta.url), 'utf8')) as RequestFieldMap
  return cached
}

export function methodInfo(target: 'api' | 'hub', moduleName: string, method: string): MethodInfo | undefined {
  return loadRequestFields()[target][moduleName]?.[method]
}

/** `name` → kind, for the plain-word parser. */
export function fieldKinds(info: MethodInfo | undefined): Record<string, FieldKind> {
  const out: Record<string, FieldKind> = {}
  for (const f of info?.fields ?? []) out[f.name] = f.kind
  return out
}

/** One line per field for help: `id (string, required)`. */
export function describeFields(info: MethodInfo | undefined): string {
  if (!info) return ''
  return info.fields
    .map((f) => `${f.name} (${f.options ? f.options.join('|') : f.kind}${f.required ? ', required' : ''})`)
    .join(', ')
}
