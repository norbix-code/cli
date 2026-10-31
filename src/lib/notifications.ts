import type {Norbix} from '@norbix.ai/ts'

import type {ResolvedContext} from '../base.js'
import {readNorbixResponse} from './http-response.js'

/**
 * Campaign recipients and the "retry the failed ones" call (gateway N-28,
 * release 2.3.9) for the three channels. Every recipient row carries
 * `state` (Pending, Sending, Retrying, Accepted, Failed, Blocked, Cancelled),
 * `attempts[]` and `deliveryEvents[]`; the campaign statistics carry
 * `failedRetryable` and `cancelled`.
 *
 * Campaign data lives on the Api host, like every other campaign command.
 * `POST /v3/notifications/<channel>/campaigns/{Id}/retry-failed` is called
 * directly with the headers the SDK transport sends, so an older host that
 * answers 404 gets a hint (like `push device delete`).
 */

export type Channel = 'email' | 'sms' | 'push'

export const CHANNEL_LABEL: Record<Channel, string> = {email: 'e-mail', sms: 'SMS', push: 'push'}

/** The failure classes `--category` accepts (Ambiguous only through --include-ambiguous). */
export const RETRY_CATEGORIES = ['Transient', 'Permanent', 'Unknown']

export const AMBIGUOUS_WARNING =
  'Ambiguous recipients are retried too: their first send may have been accepted by the provider, so this MAY SEND A DUPLICATE.'

export interface RetryFailedBody {
  idempotencyKey: string
  databaseIntegrationId?: string
  notificationIds?: string[]
  includeAmbiguous?: boolean
  categories?: string[]
}

/** The answer to retry-failed. */
export interface RetryFailedAnswer {
  retryRequestId?: string
  selected?: number
  /**
   * How many were left out, per reason: AlreadyAccepted, InFlight, Ambiguous,
   * NotFound, Blocked, Category. Also who the send gates stopped during the retry:
   * optedOut, compliance, undeliverable. Those are added to the stored answer
   * later and are part of `selected`.
   */
  skipped?: Record<string, number>
  /** True when this key was seen before: the first answer, nothing sent. */
  replayed?: boolean
  /** Set when includeAmbiguous was true: "may send a duplicate". */
  warning?: string
  responseStatus?: {isSuccess?: boolean; errors?: Array<{message?: string; errorCode?: string}>}
}

export interface HubCall {
  method: 'POST'
  url: string
  headers: Record<string, string>
  body: RetryFailedBody
}

/** Builds the retry-failed request; the caller checked that a project and a token are there. */
export function retryFailedCall(ctx: ResolvedContext, token: string, channel: Channel, campaignId: string, body: RetryFailedBody): HubCall {
  const url = `${ctx.apiUrl.replace(/\/$/, '')}/v3/notifications/${channel}/campaigns/${encodeURIComponent(campaignId)}/retry-failed`
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'norbix-project-id': ctx.projectId!,
  }
  if (ctx.accountId) headers['norbix-account-id'] = ctx.accountId
  if (ctx.env && ctx.env !== 'PROD') headers['norbix-env'] = ctx.env
  if (ctx.region) headers['nb-region'] = ctx.region
  return {method: 'POST', url, headers, body}
}

/** Sends the call; a failure becomes the one error envelope (with a hint on an old hub). */
export async function sendRetryFailed(call: HubCall): Promise<RetryFailedAnswer> {
  const res = await fetch(call.url, {method: call.method, headers: call.headers, body: JSON.stringify(call.body)})
  const answer = await readNorbixResponse(res, call.url, {
    note: (status, hasErrors) => ((status === 404 || status === 405) && !hasErrors ? 'this host is older than retry-failed (gateway 2.3.9) — upgrade it' : undefined),
  })
  return (answer ?? {}) as RetryFailedAnswer
}

/** The `skipped` keys of the people the send gates stopped during a retry. */
const GATE_LABELS: Record<string, string> = {
  optedOut: 'opted out',
  compliance: 'stopped by a compliance rule',
  undeliverable: 'undeliverable',
}

/** Lines for people: what was selected, what was skipped and why, the duplicate warning. */
export function describeRetryAnswer(channel: Channel, campaignId: string, answer: RetryFailedAnswer): string {
  const lines: string[] = []
  const selected = answer.selected ?? 0
  lines.push(
    answer.replayed
      ? `Already done: this key was used before on campaign ${campaignId} — the first answer is shown, nothing was sent again.`
      : `Retrying ${selected} failed ${CHANNEL_LABEL[channel]} recipient${selected === 1 ? '' : 's'} of campaign ${campaignId}.`,
  )
  if (answer.retryRequestId) lines.push(`Retry request: ${answer.retryRequestId} (each new attempt names it as retryRequestId).`)
  const counts = Object.entries(answer.skipped ?? {}).filter(([, n]) => n > 0)
  const skipped = counts.filter(([reason]) => !(reason in GATE_LABELS))
  const stopped = counts.filter(([reason]) => reason in GATE_LABELS)
  if (skipped.length > 0) lines.push(`Skipped: ${skipped.map(([reason, n]) => `${n} ${reason}`).join(', ')}.`)
  if (stopped.length > 0) {
    lines.push(`Stopped by the send gates: ${stopped.map(([reason, n]) => `${n} ${GATE_LABELS[reason]}`).join(', ')} (counted in the ${selected}).`)
  }
  if (answer.warning) lines.push(`Warning: ${answer.warning}`)
  if (selected === 0 && !answer.replayed) lines.push('Nothing to retry: no recipient of this campaign is in a Failed state (see `notifications <campaignId> --state failed`).')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Recipient rows
// ---------------------------------------------------------------------------

/** One recipient row as the hub lists it (the fields the CLI reads; the rest passes through). */
export interface NotificationRow {
  notificationId?: string
  batchId?: string
  state?: string
  stateChangedAt?: string
  status?: string
  attempts?: Array<{number?: number; outcome?: string; category?: string; trigger?: string; message?: string; errorCode?: string; statusCode?: number}>
  deliveryEvents?: Array<{outcome?: string; at?: string; provider?: string; reason?: string}>
  deliveryOutcome?: string
  [key: string]: unknown
}

interface Page<T> {
  list?: {items?: T[]; hasMore?: boolean; startingAfter?: string}
}

const PAGE_SIZE = 200

/**
 * Every recipient row of a campaign: the hub lists rows per batch, so the
 * batches are walked first, then each batch's messages, page by page.
 * `state` filters client-side (the hub has no state filter), case-insensitive.
 */
export async function collectNotifications(
  client: Norbix,
  channel: Channel,
  campaignId: string,
  options: {state?: string; databaseIntegrationId?: string} = {},
): Promise<{batches: number; rows: NotificationRow[]}> {
  const n = client.api.notifications
  // The generated request types do not all carry the paging fields, so the
  // arguments are passed as the server reads them.
  const batches: PageCall =
    channel === 'email'
      ? (args) => n.getEmailCampaignBatches(args as never)
      : channel === 'sms'
        ? (args) => n.getSmsCampaignBatches(args as never)
        : (args) => n.getPushCampaignBatches(args as never)
  const messages: PageCall =
    channel === 'email'
      ? (args) => n.getEmailCampaignMessages(args as never)
      : channel === 'sms'
        ? (args) => n.getSmsCampaignMessages(args as never)
        : (args) => n.getPushCampaignMessages(args as never)

  const batchIds: string[] = []
  for (const batch of await allPages<{id?: string; batchId?: string}>(batches, {id: campaignId, databaseIntegrationId: options.databaseIntegrationId})) {
    const id = batch.batchId ?? batch.id
    if (id) batchIds.push(id)
  }

  const want = options.state?.trim().toLowerCase()
  const rows: NotificationRow[] = []
  for (const batchId of batchIds) {
    for (const row of await allPages<NotificationRow>(messages, {campaignId, campaignBatchId: batchId, databaseIntegrationId: options.databaseIntegrationId})) {
      if (!want || stateOf(row).toLowerCase() === want) rows.push(row)
    }
  }

  return {batches: batchIds.length, rows}
}

type PageCall = (args: Record<string, unknown>) => Promise<unknown>

async function allPages<T>(call: PageCall, args: Record<string, unknown>): Promise<T[]> {
  const out: T[] = []
  let startingAfter: string | undefined
  for (;;) {
    const page = (await call({...args, pageSize: PAGE_SIZE, startingAfter})) as Page<T>
    const items = page.list?.items ?? []
    out.push(...items)
    if (!page.list?.hasMore || items.length === 0 || !page.list.startingAfter) break
    startingAfter = page.list.startingAfter
  }

  return out
}

/** The row's delivery state; rows written before gateway 2.3.9 only have `status`. */
export function stateOf(row: NotificationRow): string {
  return row.state ?? row.status ?? ''
}

/**
 * The label people see for a state / status value. The hub's `Completed`
 * stays on the wire (renaming it would break every SDK, D-N28-6) and reads
 * "Accepted": the provider took the message; "delivered" is a delivery event.
 */
export function stateLabel(value: string | undefined): string {
  if (!value) return '-'
  if (value === 'Completed') return 'Accepted'
  if (value === 'Cancelled') return 'Cancelled (stopped before send)'
  return value
}

/** One line per recipient row, for people (the JSON output keeps the rows as the hub sent them). */
export function describeNotifications(channel: Channel, campaignId: string, found: {batches: number; rows: NotificationRow[]}, state?: string): string {
  const which = state ? `${state} ` : ''
  const head = `${found.rows.length} ${which}${CHANNEL_LABEL[channel]} recipient${found.rows.length === 1 ? '' : 's'} of campaign ${campaignId} (${found.batches} batch${found.batches === 1 ? '' : 'es'}).`
  if (found.rows.length === 0) return head
  const lines = found.rows.map((row) => {
    const attempts = row.attempts ?? []
    const last = attempts[attempts.length - 1]
    const parts = [
      `${row.notificationId ?? '?'}`,
      stateLabel(stateOf(row)),
      `${attempts.length} attempt${attempts.length === 1 ? '' : 's'}`,
    ]
    if (last?.outcome === 'Blocked') parts.push('last attempt Blocked')
    if (last?.category) parts.push(last.category)
    if (last?.errorCode || last?.message) parts.push([last.errorCode, last.message].filter(Boolean).join(' '))
    if (row.deliveryOutcome) parts.push(`delivery: ${row.deliveryOutcome}`)
    return `  ${parts.join('  ')}`
  })
  return [head, ...lines].join('\n')
}

// ---------------------------------------------------------------------------
// Campaign statistics
// ---------------------------------------------------------------------------

export interface CampaignStats {
  batches?: number
  sent?: number
  failed?: number
  failedRetryable?: number
  cancelled?: number
  blocked?: number
  inProgress?: number
  removedRecipients?: number
  successRate?: number
}

/** The statistics for people; the JSON output is the hub's answer untouched. */
export function describeStats(answer: unknown): string {
  const stats = ((answer as {stats?: CampaignStats} | undefined)?.stats ?? answer ?? {}) as CampaignStats
  const rate = typeof stats.successRate === 'number' ? `${Math.round(stats.successRate * 100) / 100}%` : '-'
  return [
    `Batches:            ${stats.batches ?? 0}`,
    `Accepted:           ${stats.sent ?? 0}`,
    `Failed:             ${stats.failed ?? 0}`,
    `  retryable:        ${stats.failedRetryable ?? 0}  (retry them with \`retry-failed\`)`,
    `Blocked:            ${stats.blocked ?? 0}  (not sent on purpose: a preference or a compliance rule; outside the success rate)`,
    `Removed:            ${stats.removedRecipients ?? 0}  (addresses taken off shared e-mails; the row went to the others)`,
    `Cancelled:          ${stats.cancelled ?? 0}  (stopped before the send; outside the success rate)`,
    `In progress:        ${stats.inProgress ?? 0}`,
    `Success rate:       ${rate}`,
  ].join('\n')
}
