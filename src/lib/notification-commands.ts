import {Args, Flags} from '@oclif/core'

import {BaseCommand, type GlobalFlags} from '../base.js'
import {
  AMBIGUOUS_WARNING,
  CHANNEL_LABEL,
  RETRY_CATEGORIES,
  collectNotifications,
  describeNotifications,
  describeRetryAnswer,
  retryFailedCall,
  sendRetryFailed,
  type Channel,
  type RetryFailedBody,
} from './notifications.js'

/** Flags and args shared by `email|sms|push retry-failed`. */
export const retryFailedArgs = {
  id: Args.string({required: true, description: 'Campaign ID'}),
}

export const retryFailedFlags = {
  ...BaseCommand.dryRunFlags,
  key: Flags.string({
    required: true,
    description: 'Your idempotency key for this retry (any string up to 64 characters). The same key again returns the first answer and sends nothing; the same key with other flags is refused (409)',
  }),
  notification: Flags.string({
    description: 'Retry only this notification id (repeatable; default: every failed recipient of the campaign)',
    multiple: true,
  }),
  'include-ambiguous': Flags.boolean({
    description: 'Also retry recipients whose failure is Ambiguous (a timeout after the request was sent) — this MAY SEND A DUPLICATE',
    default: false,
  }),
  category: Flags.string({
    description: 'Only these failure classes (repeatable); default: all three. Ambiguous only through --include-ambiguous',
    multiple: true,
    options: RETRY_CATEGORIES,
  }),
  'database-integration': Flags.string({description: "Database integration ID; default: the project's default for the environment"}),
}

/**
 * `norbix <channel> retry-failed <campaignId> --key k`: sends the failed
 * recipients of a campaign again — only the ones whose send failed, never one
 * the provider accepted; each as a new attempt with the same notification id.
 */
export abstract class RetryFailedCommand extends BaseCommand {
  protected abstract readonly channel: Channel

  protected async retry(args: {id: string}, flags: GlobalFlags & {
    key: string
    notification?: string[]
    'include-ambiguous': boolean
    category?: string[]
    'database-integration'?: string
    'dry-run': boolean
  }): Promise<unknown> {
    if (flags.key.trim() === '' || flags.key.length > 64) this.error('--key must be 1 to 64 characters.')
    const ctx = await this.freshContext(flags)
    this.assertEndpoints(ctx)
    if (!ctx.projectId) this.error('No project ID configured. Run `norbix login` or pass --project.')
    const token = ctx.bearerToken ?? ctx.apiKey
    if (!token) this.error('Not authenticated. Run `norbix login` or pass --api-key.')

    const body: RetryFailedBody = {idempotencyKey: flags.key}
    if (flags['database-integration']) body.databaseIntegrationId = flags['database-integration']
    if (flags.notification?.length) body.notificationIds = flags.notification
    if (flags['include-ambiguous']) body.includeAmbiguous = true
    if (flags.category?.length) body.categories = flags.category

    const call = retryFailedCall(ctx, token, this.channel, args.id, body)

    if (flags['include-ambiguous'] && !this.jsonEnabled()) this.warn(AMBIGUOUS_WARNING)

    if (flags['dry-run']) {
      return this.dryRun({
        method: `${this.channel} retry-failed`,
        request: body,
        http: {method: call.method, url: call.url, headers: {...call.headers, Authorization: 'Bearer ***'}, body},
      })
    }

    const answer = await sendRetryFailed(call)
    this.print(describeRetryAnswer(this.channel, args.id, answer))
    return answer
  }
}

/** Flags and args shared by `email|sms|push notifications`. */
export const notificationsArgs = {
  id: Args.string({required: true, description: 'Campaign ID'}),
}

export const notificationsFlags = {
  state: Flags.string({
    description: 'Only rows in this delivery state (filtered here, not by the hub): pending, sending, retrying, accepted, failed, blocked, cancelled',
  }),
  'database-integration': Flags.string({description: "Database integration ID; default: the project's default for the environment"}),
}

/**
 * `norbix <channel> notifications <campaignId> [--state failed]`: every
 * recipient row of the campaign with its delivery state and attempts, across
 * all batches (the hub lists rows per batch).
 */
export abstract class NotificationsCommand extends BaseCommand {
  protected abstract readonly channel: Channel

  protected async list(args: {id: string}, flags: GlobalFlags & {state?: string; 'database-integration'?: string}): Promise<unknown> {
    const client = this.client(flags)
    const found = await collectNotifications(client, this.channel, args.id, {
      state: flags.state,
      databaseIntegrationId: flags['database-integration'],
    })
    this.print(describeNotifications(this.channel, args.id, found, flags.state))
    return {campaignId: args.id, channel: this.channel, batches: found.batches, state: flags.state, count: found.rows.length, items: found.rows}
  }

  /** The help text: one sentence per channel. */
  protected static describe(channel: Channel): string {
    return `List the ${CHANNEL_LABEL[channel]} recipients of a campaign with their delivery state and attempts

Walks every batch of the campaign and lists its rows: \`state\` (Pending, Sending,
Retrying, Accepted, Failed, Blocked, Cancelled), \`attempts[]\` (one per send,
with its outcome, failure class and error) and \`deliveryEvents[]\` (what the
provider reported later). --state filters client-side; \`--state failed\` is the
list \`retry-failed\` will send again. The hub's \`Completed\` reads "Accepted".`
  }
}
