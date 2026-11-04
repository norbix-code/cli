import {Flags} from '@oclif/core'

import {usageError} from './cli-error.js'

/** Who a trigger runs as: the flag every trigger and task save shares. */
export const EXECUTION_IDENTITY_HELP =
  'Who it runs as: a service user id (usr_…) from `norbix identities list`, or `default` for the project default'

export const executionIdentityFlag = Flags.string({description: EXECUTION_IDENTITY_HELP})

/** The gateway's TriggerType, as the runs routes take it. */
export const TRIGGER_TYPES = ['Membership', 'Schema', 'Files', 'Payments', 'Ai']

export const TRIGGER_RUN_STATUSES = ['queued', 'running', 'succeeded', 'failed', 'skipped']

/** The trigger type the server dispatches a files trigger body by, and its events. */
export const FILES_TRIGGER = 'Files'
export const FILES_TRIGGER_TYPES = ['OnFileUploaded', 'OnFileDeleted']

/** The trigger type of a membership (end-user) trigger, and its events. */
export const MEMBERSHIP_TRIGGER = 'Membership'
export const MEMBERSHIP_TRIGGER_TYPES = [
  'OnRegistered',
  'OnInvited',
  'OnVerified',
  'OnUpdated',
  'OnDeleted',
  'OnBlocked',
  'OnReactivated',
  'OnUserCreated',
]

/** The trigger type of a trigger on an AI project event, and its events. */
export const AI_TRIGGER = 'Ai'
export const AI_TRIGGER_TYPES = ['OnCreditsWarning', 'OnCreditsExhausted', 'OnQuotaWarning', 'OnQuotaExhausted']

/** The part of every host trigger `save` help that is the same for files, membership and AI. */
export const TRIGGER_SAVE_HELP = `The file holds the trigger: name, "when" (what fires it), the action ({type, ...})
and optionally description, preExecuteCode, order and breakOnError — the same
shape \`trigger definition <id> --type <type>\` prints. A file that holds the
whole request ({"trigger": {...}}) or a \`trigger <id> --json\` answer works too.
"type" is filled in when the file leaves it out; --when overrides the file.

The action: {"type": "Email" | "Sms" | "Push" | "WebhookCall" | "SseCall" |
"Code" | "Marketplace" | "Workflow", ...}. A Code action names the function:
{"type": "Code", "functionRef": {"integrationId": "int_…", "functionId": "my-fn"}}.
A Workflow action starts a workflow: {"type": "Workflow", "workflowRef": "wf_…"}.

--id sets triggerId (update instead of create), --order and --break-on-error
set the trigger's place in the queue of the same event, --execution-identity
says who the trigger runs as (leave it out for the project default).`

/** The flags every host trigger `save` shares: the file, --id, --when, who it runs as, the queue place. */
export function triggerSaveFlags(whenTypes: string[], whenHelp: string) {
  return {
    file: Flags.string({required: true, description: 'Trigger JSON file (or `-` for stdin)'}),
    id: Flags.string({description: 'Trigger ID — set it to update instead of create'}),
    when: Flags.string({description: `What fires the trigger (overrides "when" in the file): ${whenHelp}`, options: whenTypes}),
    'execution-identity': executionIdentityFlag,
    order: Flags.integer({
      min: 0,
      description: 'Place in the queue of the event: lower runs first, 0 or more (overrides "order" in the file)',
    }),
    'break-on-error': Flags.boolean({
      allowNo: true,
      description: 'Stop the later triggers of the same event when this one fails (overrides "breakOnError" in the file)',
    }),
  }
}

export interface TriggerSaveFlags {
  id?: string
  when?: string
  'execution-identity'?: string
  order?: number
  'break-on-error'?: boolean
}

/**
 * The body of a host trigger save: the file's trigger with `type` filled in and
 * the flags on top. `when` has no default on these hosts (unlike a payment
 * trigger): a file without it and no --when is a usage error, with the values
 * listed, before anything is sent.
 */
export function buildHostTrigger(
  fromFile: Record<string, unknown>,
  flags: TriggerSaveFlags,
  type: string,
  whenTypes: string[],
): Record<string, unknown> {
  const trigger: Record<string, unknown> = {type, ...fromFile}
  if (flags.id) trigger.triggerId = flags.id
  if (flags.when) trigger.when = flags.when
  if (flags['execution-identity']) trigger.executionIdentityId = flags['execution-identity']
  if (flags.order !== undefined) trigger.order = flags.order
  if (flags['break-on-error'] !== undefined) trigger.breakOnError = flags['break-on-error']

  if (typeof trigger.when !== 'string' || trigger.when === '') {
    throw usageError(
      'The trigger does not say what fires it: put "when" in the file or pass --when.',
      `--when is one of ${whenTypes.join(', ')}.`,
    )
  }

  return trigger
}

interface AttentionRow {
  triggerId?: string
  triggerType?: string
  reason?: string
  atUtc?: string
}

/** `trigger attention` for the terminal: one line per trigger that stopped before it acted. */
export function formatTriggerAttention(res: unknown): string {
  const items = ((res ?? {}) as {items?: AttentionRow[]}).items
  const rows = Array.isArray(items) ? items : []
  if (rows.length === 0) return 'No trigger needs attention.'

  const header = ['TRIGGER', 'TYPE', 'SINCE', 'REASON']
  const cells = rows.map((r) => [r.triggerId ?? '', r.triggerType ?? '', r.atUtc ?? '', r.reason ?? ''])
  const widths = header.map((h, i) => Math.max(h.length, ...cells.map((row) => row[i]!.length)))
  const line = (c: string[]) => c.map((v, i) => (i === c.length - 1 ? v : v.padEnd(widths[i]!))).join('  ')
  return [line(header), ...cells.map(line), '', `${rows.length} trigger${rows.length === 1 ? '' : 's'}. Read the runs: norbix trigger runs <type> <trigger>`].join('\n')
}

interface PreExecuteProblem {
  code?: string
  message?: string
  line?: number
  column?: number
}

/** `trigger pre-execute-test` for the terminal: would the trigger run, and what is wrong with the code. */
export function formatPreExecuteTest(res: unknown): string {
  const r = (res ?? {}) as {outcome?: string; triggerRuns?: boolean; problems?: PreExecuteProblem[]}
  const lines = [`Outcome:        ${r.outcome ?? '?'}`, `Trigger runs:   ${r.triggerRuns ? 'yes' : 'no'}`]
  const problems = Array.isArray(r.problems) ? r.problems : []
  if (problems.length > 0) {
    lines.push('Problems:')
    for (const p of problems) {
      const where = p.line === undefined ? '' : ` (line ${p.line}${p.column === undefined ? '' : `, column ${p.column}`})`
      lines.push(`  ${p.code ?? '?'}${where}: ${p.message ?? ''}`)
    }
  }

  return lines.join('\n')
}

interface IdentityCheck {
  executionIdentityId?: string
  isDefault?: boolean
  canAssign?: boolean
  missingPermissions?: string[]
  callerMissingPermissions?: string[]
  refusals?: Array<{errorCode?: string; message?: string}>
}

/** `trigger identity-check` for the terminal: may the identity be used, and what it lacks for the action. */
export function formatIdentityCheck(res: unknown): string {
  const r = (res ?? {}) as IdentityCheck
  const lines = [
    `Identity:       ${r.executionIdentityId ?? '(project default)'}${r.isDefault ? ' (default)' : ''}`,
    `Can assign:     ${r.canAssign ? 'yes' : 'no'}`,
    `Missing:        ${r.missingPermissions?.length ? r.missingPermissions.join(', ') : 'nothing — the action can run'}`,
  ]
  if (r.callerMissingPermissions?.length) lines.push(`You lack:       ${r.callerMissingPermissions.join(', ')}`)
  for (const refusal of r.refusals ?? []) lines.push(`Refused:        ${refusal.errorCode ?? '?'} ${refusal.message ?? ''}`.trimEnd())
  return lines.join('\n')
}

/**
 * The trigger of a `--file` for `db trigger create` / `payments trigger save`.
 *
 * Accepts the bare trigger, the whole save request (`{"trigger": {...}}`) or
 * the read answer of `… trigger <id> --json` (`{"item": {...}}`). A read
 * answer names the action `thenAction`; the save request names it `action`,
 * so a file saved from a read is renamed here — without it the round trip
 * saved a trigger with no action.
 */
export function triggerFromFile(parsed: Record<string, unknown>): Record<string, unknown> {
  const inner = [parsed.trigger, parsed.item].find((v) => v && typeof v === 'object' && !Array.isArray(v))
  const trigger = {...((inner ?? parsed) as Record<string, unknown>)}

  if (trigger.action === undefined && trigger.thenAction !== undefined) {
    trigger.action = trigger.thenAction
  }

  delete trigger.thenAction
  return trigger
}

interface TriggerRunRow {
  runId?: string
  event?: string
  action?: string
  status?: string
  startedAt?: string
  durationMs?: number
  error?: string
  startedBy?: {kind?: string; id?: string; name?: string}
  executionIdentityId?: string
  executionIdentityName?: string
  executionIdentityIsDefault?: boolean
  produced?: {kind?: string; id?: string}
}

function runsAs(run: TriggerRunRow): string {
  const name = run.executionIdentityName ?? run.executionIdentityId ?? ''
  return run.executionIdentityIsDefault ? `${name || 'Project triggers'} (default)` : name
}

function produced(run: TriggerRunRow): string {
  return run.produced ? [run.produced.kind, run.produced.id].filter(Boolean).join(' ') : ''
}

/** `trigger runs` for the terminal: one line per run, newest first. */
export function formatTriggerRuns(res: unknown): string {
  const list = ((res ?? {}) as {list?: {items?: TriggerRunRow[]; hasMore?: boolean; startingAfter?: string}}).list ?? {}
  const runs = Array.isArray(list.items) ? list.items : []
  if (runs.length === 0) return 'No runs match (runs are kept 30 days).'

  const header = ['STARTED', 'EVENT', 'ACTION', 'STATUS', 'RUNS AS', 'PRODUCED', 'RUN']
  const rows = runs.map((r) => [
    r.startedAt ?? '',
    r.event ?? '',
    r.action ?? '',
    r.error ? `${r.status ?? ''} — ${r.error}` : (r.status ?? ''),
    runsAs(r),
    produced(r),
    r.runId ?? '',
  ])
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i]!.length)))
  const line = (cells: string[]) => cells.map((c, i) => (i === cells.length - 1 ? c : c.padEnd(widths[i]!))).join('  ')
  const lines = [line(header), ...rows.map(line), '']
  lines.push(`${runs.length} run${runs.length === 1 ? '' : 's'}. Read one: norbix trigger run <run>`)
  if (list.hasMore && list.startingAfter) lines.push(`More: add --after ${list.startingAfter}`)
  return lines.join('\n')
}

/** `trigger run <id>` for the terminal: every field the run has, one per line. */
export function formatTriggerRun(res: unknown): string {
  const run = ((res ?? {}) as {item?: TriggerRunRow & Record<string, unknown>}).item
  if (!run) return 'No such run.'
  const missing = run.missingPermissions as string[] | undefined
  const fields: Array<[string, unknown]> = [
    ['Run', run.runId],
    ['Trigger', [run.triggerName, run.triggerId].filter(Boolean).join(' ')],
    ['Type', run.triggerType],
    ['Event', run.event],
    ['Action', run.action],
    ['Status', run.status],
    ['Reason', run.error],
    ['Started', run.startedAt],
    ['Finished', run.finishedAt],
    ['Duration', run.durationMs === undefined ? undefined : `${run.durationMs} ms`],
    ['Runs as', runsAs(run)],
    ['Caused by', [run.startedBy?.kind, run.startedBy?.name ?? run.startedBy?.id].filter(Boolean).join(' ')],
    ['Produced', produced(run)],
    ['Missing', missing?.length ? missing.join(', ') : undefined],
    ['Records', run.recordCount],
    ['Correlation id', run.correlationId],
  ]
  return fields
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([label, value]) => `${`${label}:`.padEnd(16)}${String(value)}`)
    .join('\n')
}

interface IdentityRow {
  id?: string
  name?: string
  isDefault?: boolean
  status?: string
  canAssign?: boolean
  usedBy?: {triggers?: number; tasks?: number; workflows?: number}
}

/** `identities list` for the terminal. */
export function formatIdentities(res: unknown): string {
  const identities = ((res ?? {}) as {identities?: IdentityRow[]}).identities ?? []
  if (identities.length === 0) return 'No execution identities yet. The first trigger save creates the default one.'

  const header = ['NAME', 'STATUS', 'YOU MAY ASSIGN', 'USED BY', 'ID']
  const rows = identities.map((i) => [
    i.isDefault ? `${i.name ?? ''} (default)` : (i.name ?? ''),
    i.status ?? '',
    i.canAssign ? 'yes' : 'no',
    `${i.usedBy?.triggers ?? 0} triggers · ${i.usedBy?.tasks ?? 0} tasks · ${i.usedBy?.workflows ?? 0} workflows`,
    i.id ?? '',
  ])
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i]!.length)))
  const line = (cells: string[]) => cells.map((c, i) => (i === cells.length - 1 ? c : c.padEnd(widths[i]!))).join('  ')
  return [line(header), ...rows.map(line)].join('\n')
}
