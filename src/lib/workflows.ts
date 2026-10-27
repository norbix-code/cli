import {readFileSync} from 'node:fs'
import {extname} from 'node:path'

import {parse as parseYaml, stringify as stringifyYaml} from 'yaml'

import {usageError} from './cli-error.js'

/**
 * Helpers shared by the `norbix code workflows` commands (Workflows beta,
 * Code.Workflows.md §15): the definition file (YAML or JSON) in and out, the
 * validation report, and a run as a readable step table. YAML exists only at
 * the edge — the gateway takes and returns JSON.
 */

/** The one sentence every workflows command and the topic help carry. */
export const BETA_NOTE = 'Workflows are in beta; bugs may occur.'

/** The run states `runs --status` and `waiting --status` take (§8.1). */
export const RUN_STATUSES = ['running', 'waiting', 'succeeded', 'failed', 'cancelled']

/** What a wait parks on (`waiting --kind`). */
export const WAITING_KINDS = ['approval', 'event', 'delay']

/** The answers to an approval wait (`resume --decision`). */
export const DECISIONS = ['approved', 'rejected']

/** `--format` of `get`, `draft` and `schema`. */
export const FORMATS = ['json', 'yaml']

export type DefinitionFormat = 'json' | 'yaml'

/**
 * Reads a workflow definition: a `.yaml` / `.yml` or `.json` file, or `-` for
 * stdin. The extension decides; stdin and any other extension are read by
 * content (JSON when it parses as JSON, YAML otherwise). The result must be
 * one object — it is sent as `definition` unchanged.
 */
export async function readDefinition(path: string, flagName = 'file'): Promise<Record<string, unknown>> {
  const text = path === '-' ? await readStdin() : readText(path, flagName)
  const format = formatOf(path, text)
  let parsed: unknown
  try {
    parsed = format === 'json' ? JSON.parse(text) : parseYaml(text)
  } catch (error) {
    const why = error instanceof Error ? error.message.split('\n')[0] : String(error)
    throw usageError(
      `--${flagName}: ${path === '-' ? 'stdin' : `"${path}"`} is not valid ${format === 'json' ? 'JSON' : 'YAML'}: ${why}`,
      'The file holds one workflow definition (see `norbix code workflows schema`).',
      'norbix code workflows save --help',
    )
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw usageError(
      `--${flagName}: the definition must be one object (schemaVersion, name, executionIdentityId, steps, …).`,
      'Start from `norbix code workflows schema --format yaml`, or read one back with `norbix code workflows get <wf_…> --format yaml`.',
      'norbix code workflows save --help',
    )
  }

  return parsed as Record<string, unknown>
}

/** `.json` → JSON, `.yaml` / `.yml` → YAML; else by content. */
export function formatOf(path: string, text: string): DefinitionFormat {
  const ext = path === '-' ? '' : extname(path).toLowerCase()
  if (ext === '.json') return 'json'
  if (ext === '.yaml' || ext === '.yml') return 'yaml'
  try {
    JSON.parse(text)
    return 'json'
  } catch {
    return 'yaml'
  }
}

/** A value as YAML (a definition, the schema document). */
export function toYaml(value: unknown): string {
  return stringifyYaml(value, {lineWidth: 0}).trimEnd()
}

/** `--format yaml` prints `value` as YAML; json (the default) the whole answer as JSON. */
export function formatAs(format: string | undefined, res: unknown, yamlValue: unknown): string {
  return format === 'yaml' ? toYaml(yamlValue ?? null) : JSON.stringify(res, null, 2)
}

/** One issue of `validate` and of the `warnings` a save answers with. */
export interface WorkflowIssue {
  code?: string
  message?: string
  path?: string
  stepId?: string
  line?: number
  column?: number
}

/** `CM-ERRORS-WORKFLOWS-005  step "notify": … (steps[2].action, line 14:7)`. */
export function formatIssue(issue: WorkflowIssue): string {
  const where = [issue.path, issue.line === undefined ? undefined : `line ${issue.line}${issue.column === undefined ? '' : `:${issue.column}`}`]
    .filter(Boolean)
    .join(', ')
  const step = issue.stepId ? `step "${issue.stepId}": ` : ''
  return `${issue.code ?? ''}  ${step}${issue.message ?? ''}${where ? ` (${where})` : ''}`.trim()
}

/** The readable `validate` report: a verdict line, then the errors and the warnings. */
export function formatValidation(res: unknown): string {
  const r = (res ?? {}) as {isValid?: boolean; errors?: WorkflowIssue[]; warnings?: WorkflowIssue[]}
  const errors = r.errors ?? []
  const warnings = r.warnings ?? []
  const lines = [
    r.isValid
      ? `Valid${warnings.length > 0 ? ` — ${plural(warnings.length, 'warning')}` : ''}.`
      : `NOT valid — ${plural(errors.length, 'error')}${warnings.length > 0 ? `, ${plural(warnings.length, 'warning')}` : ''}.`,
  ]
  if (errors.length > 0) lines.push('', 'Errors:', ...errors.map((e) => `  ${formatIssue(e)}`))
  if (warnings.length > 0) lines.push('', 'Warnings:', ...warnings.map((w) => `  ${formatIssue(w)}`))
  return lines.join('\n')
}

/** The `warnings` of a saved / published workflow, or nothing. */
export function formatWarnings(warnings: WorkflowIssue[] | undefined): string[] {
  if (!warnings || warnings.length === 0) return []
  return ['Warnings:', ...warnings.map((w) => `  ${formatIssue(w)}`)]
}

/** A workflow after save / publish / enable / disable: id, version, draft, on/off, warnings. */
export function formatWorkflow(verb: string, res: unknown): string {
  const wf = (res as {workflow?: Record<string, unknown>} | undefined)?.workflow
  if (!wf) return JSON.stringify(res, null, 2)
  const definition = (wf.definition ?? {}) as {name?: string}
  const version = wf.version === undefined || wf.version === null || wf.version === 0 ? 'none published' : `v${wf.version}`
  const lines = [
    `Workflow ${wf.workflowId as string}${definition.name ? ` (${definition.name})` : ''} ${verb}.`,
    `  version: ${version}  draft: ${wf.hasDraft ? 'yes' : 'no'}  enabled: ${wf.isEnabled ? 'yes' : 'no'}${wf.disabledReason ? ` (${wf.disabledReason as string})` : ''}`,
    ...formatWarnings(wf.warnings as WorkflowIssue[] | undefined),
  ]
  return lines.join('\n')
}

interface RunStep {
  stepId?: string
  kind?: string
  status?: string
  attempt?: number
  pass?: number
  durationMs?: number
  error?: {code?: string; message?: string}
  decision?: string
}

interface Run {
  runId?: string
  workflowId?: string
  version?: number
  isDraft?: boolean
  status?: string
  source?: string
  startedAt?: string
  finishedAt?: string
  durationMs?: number
  waitingOn?: Array<{stepId?: string; kind?: string; until?: string; key?: string; assignees?: string[]}>
  error?: {code?: string; stepId?: string; reason?: string; message?: string}
  output?: unknown
  steps?: RunStep[]
}

/**
 * A run for the terminal: the header (status, version, source, timing), what
 * it waits on, its error, then one row per step execution — stepId, kind,
 * status, attempt, pass, duration — and the run's output.
 */
export function formatRun(run: Run | undefined): string {
  if (!run) return 'The answer has no run.'
  const version = run.isDraft ? 'draft' : run.version === undefined || run.version === null ? '—' : `v${run.version}`
  const lines = [
    `Run ${run.runId ?? ''} of ${run.workflowId ?? ''}: ${run.status ?? 'unknown'}`,
    `  version: ${version}  source: ${run.source ?? '—'}  started: ${run.startedAt ?? '—'}${run.finishedAt ? `  finished: ${run.finishedAt}` : ''}${run.durationMs === undefined || run.durationMs === null ? '' : `  duration: ${run.durationMs} ms`}`,
  ]
  for (const w of run.waitingOn ?? []) {
    const extra = [w.until ? `until ${w.until}` : '', w.key ? `key ${w.key}` : '', w.assignees?.length ? `assignees ${w.assignees.join(', ')}` : '']
      .filter(Boolean)
      .join(', ')
    lines.push(`  waiting on: step ${w.stepId ?? '?'} (${w.kind ?? '?'})${extra ? ` — ${extra}` : ''}`)
  }

  if (run.error) {
    const e = run.error
    lines.push(`  error: ${[e.code, e.stepId ? `step ${e.stepId}` : '', e.reason].filter(Boolean).join(' · ')}${e.message ? ` — ${e.message}` : ''}`)
  }

  const steps = run.steps ?? []
  if (steps.length > 0) {
    const header = ['STEP', 'KIND', 'STATUS', 'ATTEMPT', 'PASS', 'DURATION']
    const rows = steps.map((s) => [
      s.stepId ?? '',
      s.kind ?? '',
      `${s.status ?? ''}${s.decision ? ` (${s.decision})` : ''}`,
      String(s.attempt ?? ''),
      String(s.pass ?? ''),
      s.durationMs === undefined || s.durationMs === null ? '—' : `${s.durationMs} ms`,
    ])
    const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)))
    const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join('  ').trimEnd()
    lines.push('', line(header), ...rows.map(line))
    for (const s of steps.filter((x) => x.error)) {
      lines.push(`  ${s.stepId} attempt ${s.attempt ?? '?'}: ${[s.error?.code, s.error?.message].filter(Boolean).join(' — ')}`)
    }
  }

  if (run.output !== undefined && run.output !== null) {
    lines.push('', 'Output:', JSON.stringify(run.output, null, 2))
  }

  return lines.join('\n')
}

/**
 * A JSON object flag (`--payload`): inline, `@file` or `-`; or `--payload-file`.
 * Both cannot be given; the value must be an object.
 */
export async function readObjectFlag(
  inline: string | undefined,
  file: string | undefined,
  name = 'payload',
): Promise<Record<string, unknown> | undefined> {
  if (inline !== undefined && file !== undefined) {
    throw usageError(`Pass either --${name} or --${name}-file, not both.`, `--${name} '{"orderId":"…"}' or --${name}-file ${name}.json.`)
  }

  let text: string | undefined
  let from = `--${name}`
  if (file !== undefined) {
    text = file === '-' ? await readStdin() : readText(file, `${name}-file`)
    from = `--${name}-file`
  } else if (inline !== undefined) {
    text = inline === '-' ? await readStdin() : inline.startsWith('@') ? readText(inline.slice(1), name) : inline
  }

  if (text === undefined) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw usageError(`${from} is not valid JSON.`, `Pass one JSON object, e.g. --${name} '{"orderId":"6ac54a59212c29912eaddd81"}'.`)
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw usageError(`${from} must be a JSON object.`, `e.g. --${name} '{"orderId":"6ac54a59212c29912eaddd81"}'.`)
  }

  return parsed as Record<string, unknown>
}

function readText(path: string, flagName: string): string {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    throw usageError(`--${flagName}: cannot read the file "${path}".`, 'Check the path.')
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}
