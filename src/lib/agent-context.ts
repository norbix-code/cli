/**
 * The AI project-context summary (Hub `GET /{v}/account/ai/context`): the
 * projects the signed-in identity may work on — environments, regions,
 * modules, integrations (id, name, kind, default per env), CORS origins,
 * languages — scoped to its roles and never holding a secret.
 *
 * `norbix ai context` prints it; `--write` (and, by themselves, `norbix login`
 * and a token renewal) keep a copy in the project folder, next to what
 * `norbix ai init` wrote, so a coding agent can rebuild its knowledge after
 * its own context was compressed:
 *
 *   .norbix-ai/context.md     the Markdown summary (what the agent reads)
 *   .norbix-ai/context.json   the structured summary with its `version`
 *   .norbix-ai/.gitignore     `*` — the summary is per person (it follows the
 *                             roles), so it is never committed
 *
 * Not `.norbix/`: run in the home folder that would be `~/.norbix`, the CLI's
 * own config, which agents are told never to read.
 *
 * Writing on its own (login / renewal) happens only in a folder `norbix ai
 * init` set up, and on renewal only when the copy already exists; it never
 * fails the command. No oclif import.
 */
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'

import {MARKER_START} from './agent-files.js'

export const CONTEXT_DIR = '.norbix-ai'
export const CONTEXT_MD = `${CONTEXT_DIR}/context.md`
export const CONTEXT_JSON = `${CONTEXT_DIR}/context.json`

/** What the Hub answers (GetAiContextResponse, camelCase). */
export interface AiContextAnswer {
  version?: string
  unchanged?: boolean
  context?: AiContextSummary
  markdown?: string
  responseStatus?: {isSuccess?: boolean; errors?: Array<{message?: string; errorCode?: string}>; message?: string}
}

/** The summary (AiProjectContextWireDto). Only the fields the CLI itself reads are typed. */
export interface AiContextSummary {
  version: string
  caller?: {kind?: string; name?: string; accountId?: string}
  projects: Array<{id: string; name: string; access: string} & Record<string, unknown>>
  hints?: string[]
}

export interface ContextRequest {
  /** Hub base without the version, e.g. `https://hub.norbix.ai`. */
  hubBase: string
  hubVersion: string
  token: string
  accountId?: string
  projectId?: string
  env?: string
  region?: string
  format: 'json' | 'markdown'
  knownVersion?: string
  fetchFn?: typeof fetch
}

export type ContextResult =
  | {status: 'ok'; version: string; context?: AiContextSummary; markdown?: string}
  | {status: 'unchanged'; version: string}
  | {status: 'error'; httpStatus: number; message: string}

/** One call to `GET /{v}/account/ai/context`. Never throws for an HTTP error; a network error throws. */
export async function fetchContext(req: ContextRequest): Promise<ContextResult> {
  const url = new URL(`${req.hubBase.replace(/\/$/, '')}/${req.hubVersion}/account/ai/context`)
  url.searchParams.set('format', req.format)
  if (req.projectId) url.searchParams.set('projectId', req.projectId)
  if (req.knownVersion) url.searchParams.set('knownVersion', req.knownVersion)

  const headers: Record<string, string> = {Accept: 'application/json', Authorization: `Bearer ${req.token}`}
  if (req.accountId) headers['norbix-account-id'] = req.accountId
  if (req.env && req.env !== 'PROD') headers['norbix-env'] = req.env
  if (req.region) headers['nb-region'] = req.region

  const res = await (req.fetchFn ?? fetch)(url, {headers, signal: AbortSignal.timeout(20_000)})
  const body = (await res.json().catch(() => ({}))) as AiContextAnswer
  if (!res.ok || body.responseStatus?.isSuccess === false) {
    const message =
      body.responseStatus?.errors?.[0]?.message ?? body.responseStatus?.message ?? `HTTP ${res.status} ${res.statusText}`.trim()
    return {status: 'error', httpStatus: res.status, message}
  }

  const version = body.version ?? body.context?.version ?? ''
  if (body.unchanged) return {status: 'unchanged', version}
  return {status: 'ok', version, context: body.context, markdown: body.markdown}
}

/** True when `norbix ai init` set this folder up (any target), or a context copy is already here. */
export function isAgentFolder(root: string): boolean {
  if (existsSync(join(root, CONTEXT_MD))) return true
  if (existsSync(join(root, '.claude/skills/norbix/SKILL.md'))) return true
  if (existsSync(join(root, '.cursor/rules/norbix.mdc'))) return true
  for (const file of ['CLAUDE.md', 'AGENTS.md']) {
    try {
      if (readFileSync(join(root, file), 'utf8').includes(MARKER_START)) return true
    } catch {
      // not there
    }
  }

  return false
}

/** The version of the copy in this folder, if any. */
export function storedVersion(root: string): string | undefined {
  try {
    const doc = JSON.parse(readFileSync(join(root, CONTEXT_JSON), 'utf8')) as {version?: unknown}
    return typeof doc.version === 'string' ? doc.version : undefined
  } catch {
    return undefined
  }
}

/** Writes the three files; returns the paths written (relative to `root`). */
export function writeContextFiles(root: string, summary: AiContextSummary, markdown: string): string[] {
  mkdirSync(join(root, CONTEXT_DIR), {recursive: true})
  writeFileSync(join(root, CONTEXT_DIR, '.gitignore'), '# Per-person Norbix context (follows your roles) — never commit it.\n*\n')
  writeFileSync(join(root, CONTEXT_JSON), JSON.stringify(summary, null, 2) + '\n')
  writeFileSync(join(root, CONTEXT_MD), markdown.endsWith('\n') ? markdown : markdown + '\n')
  return [CONTEXT_MD, CONTEXT_JSON]
}

export type SyncOutcome =
  | {written: string[]; version: string}
  | {skipped: 'not an agent folder' | 'no copy yet' | 'unchanged' | 'no credentials'}
  | {failed: string}

/**
 * Brings the copy in `root` up to date, quietly: only in an agent folder,
 * only when `onlyIfPresent` is false or a copy exists, and only when the
 * version changed (one request with `knownVersion`; a changed summary costs a
 * second one for the Markdown). Never throws.
 */
export async function syncContext(
  root: string,
  base: Omit<ContextRequest, 'format' | 'knownVersion'>,
  opts: {onlyIfPresent: boolean},
): Promise<SyncOutcome> {
  try {
    if (!base.token) return {skipped: 'no credentials'}
    if (!isAgentFolder(root)) return {skipped: 'not an agent folder'}
    const known = storedVersion(root)
    if (opts.onlyIfPresent && !existsSync(join(root, CONTEXT_MD))) return {skipped: 'no copy yet'}

    const json = await fetchContext({...base, format: 'json', knownVersion: known})
    if (json.status === 'error') return {failed: json.message}
    if (json.status === 'unchanged') return {skipped: 'unchanged'}
    const md = await fetchContext({...base, format: 'markdown'})
    if (md.status !== 'ok' || !json.context || !md.markdown) return {failed: md.status === 'error' ? md.message : 'no summary'}
    return {written: writeContextFiles(root, json.context, md.markdown), version: json.version}
  } catch (error) {
    return {failed: error instanceof Error ? error.message : String(error)}
  }
}
