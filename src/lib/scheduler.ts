import {Flags} from '@oclif/core'

import {executionIdentityFlag} from './triggers.js'

/** Field names of a 5-field cron, for help texts and the error message. */
export const CRON_FIELDS = 'minute hour day-of-month month day-of-week'

/**
 * The flags every task save shares — `scheduler save` (email campaign),
 * `scheduler save code` and `scheduler save workflow`: what the task is
 * called, when it fires and who it runs as.
 */
export const taskFlags = {
  id: Flags.string({description: 'Task ID — set it to update that task instead of creating one'}),
  name: Flags.string({required: true, description: 'Task name'}),
  description: Flags.string({description: 'What the task is for'}),
  cron: Flags.string({required: true, description: `When it runs: a 5-field cron (${CRON_FIELDS}) in UTC`}),
  'execution-identity': executionIdentityFlag,
  initiator: Flags.string({description: 'User ID (usr_…) the task is attributed to; default: you'}),
  enabled: Flags.boolean({
    description: 'Start firing on the cron right away (--no-enabled saves it switched off)',
    allowNo: true,
    default: true,
  }),
  'stop-on-error': Flags.boolean({description: 'Switch the task off after a run fails', default: false}),
}

export interface TaskFlags {
  id?: string
  name: string
  description?: string
  cron: string
  'execution-identity'?: string
  initiator?: string
  enabled: boolean
  'stop-on-error': boolean
}

/** A 5-field cron, normalised to single spaces; anything else is refused with an example. */
export function parseCron(cron: string, fail: (message: string) => never): string {
  const fields = cron.trim().split(/\s+/)
  if (fields.length !== 5) {
    fail(`--cron needs 5 fields (${CRON_FIELDS}), got ${fields.length}: "${cron}". Example: --cron "0 9 * * 1" (Mondays 09:00 UTC).`)
  }

  return fields.join(' ')
}

/** The save request around a task body: the same envelope for every task type. */
export function taskRequest(flags: TaskFlags, cron: string, task: Record<string, unknown>): Record<string, unknown> {
  return {
    taskId: flags.id,
    name: flags.name,
    description: flags.description,
    cron,
    executionIdentityId: flags['execution-identity'],
    initiatorUserId: flags.initiator,
    isEnabled: flags.enabled,
    stopOnError: flags['stop-on-error'],
    task,
  }
}

/** One row of a task's run history, as the gateway sends it. */
export interface TaskRun {
  logId?: string
  atUtc?: string
  outcome?: string
  reason?: string
  detail?: string
  correlationId?: string
  executionIdentityName?: string
  executionIdentityIsDefault?: boolean
}

/** The run history as a table: when, outcome, reason, who it ran as, the detail of a failed run. */
export function formatTaskRuns(runs: TaskRun[] | undefined): string {
  if (!runs?.length) return 'No runs yet.'
  const rows = runs.map((r) => [
    r.atUtc ?? '',
    r.outcome ?? '',
    r.reason ?? '',
    r.executionIdentityName ? `${r.executionIdentityName}${r.executionIdentityIsDefault ? ' (default)' : ''}` : '',
    r.detail ?? '',
  ])
  const header = ['WHEN (UTC)', 'OUTCOME', 'REASON', 'RAN AS', 'DETAIL']
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i]!.length)))
  const line = (cells: string[]) =>
    cells
      .map((c, i) => (i === cells.length - 1 ? c : c.padEnd(widths[i]!)))
      .join('  ')
      .trimEnd()
  return [line(header), ...rows.map(line)].join('\n')
}
