import {Flags} from '@oclif/core'

/** Who a trigger runs as: the flag every trigger and task save shares. */
export const EXECUTION_IDENTITY_HELP =
  'Who it runs as: a service user id (usr_…) from `norbix identities list`, or `default` for the project default'

export const executionIdentityFlag = Flags.string({description: EXECUTION_IDENTITY_HELP})

/** The gateway's TriggerType, as the runs routes take it. */
export const TRIGGER_TYPES = ['Membership', 'Schema', 'Files', 'Payments', 'Ai']

export const TRIGGER_RUN_STATUSES = ['queued', 'running', 'succeeded', 'failed', 'skipped']

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
