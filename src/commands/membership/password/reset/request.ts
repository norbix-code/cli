import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'

/** The admin answer of `POST /{version}/membership/userauth/password/reset/test` (gateway N45). */
export interface TestPasswordResetAnswer {
  queued?: boolean
  reason?: string
  env?: string
  correlationId?: string
  expiresAtUtc?: string
  integrationId?: string
  integrationName?: string
  provider?: string
  integrationProblem?: string
  responseStatus?: {isSuccess?: boolean; errors?: Array<{message?: string; errorCode?: string}>}
}

/** One project-log entry, as `GET /{version}/logs` lists it. */
interface LogEntry {
  timestamp?: string
  level?: string
  eventCode?: string
  title?: string
  meta?: Record<string, string>
}

/** What the hub did with the e-mail, read from its project-log entry. */
export interface DeliveryResult {
  status: 'sent' | 'not-sent' | 'unknown'
  integrationId?: string
  integrationName?: string
  provider?: string
  template?: string
  language?: string
  fallbackReason?: string
  reason?: string
}

const SENT = 'membership:email:sent'
const NOT_SENT = 'membership:email:not-sent'

/** The hub's send-side entry among the entries of one correlation id; `unknown` when there is none yet. */
export function deliveryFrom(entries: LogEntry[]): DeliveryResult {
  const entry = entries.find((e) => (e.eventCode === SENT || e.eventCode === NOT_SENT) && e.meta?.stage === 'send')
  if (!entry) return {status: 'unknown'}
  const m = entry.meta ?? {}
  return entry.eventCode === SENT
    ? {
        status: 'sent',
        integrationId: m.integrationId,
        integrationName: m.integrationName,
        provider: m.provider,
        template: m.template,
        language: m.language,
        fallbackReason: m.fallbackReason,
      }
    : {status: 'not-sent', reason: m.reason, integrationId: m.integrationId, fallbackReason: m.fallbackReason}
}

export default class MembershipPasswordResetRequest extends BaseCommand {
  static description = `Send a test password-reset e-mail to a project user and report which integration sent it.

Admin only (needs the right to change project users' logins). It runs the same
reset flow an app runs — the login is looked up in the --env environment, a
one-time link is issued and the hub sends the e-mail — and answers what the
public request never tells: whether a login was found, the environment, the
integration that will send it, and the correlation id. It then waits for the
hub's project-log entry with that correlation id and prints what really
happened (sent through which integration and template, or why not).

The user really gets a working reset link: use a test address.`

  static examples = [
    '<%= config.bin %> membership password reset request tester@example.com --env TEST',
    '<%= config.bin %> membership password reset request tester@example.com --env TEST --wait 0 --json',
    '<%= config.bin %> membership password reset request tester@example.com --dry-run',
  ]

  static args = {
    email: Args.string({required: true, description: 'Email address of the project user'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    wait: Flags.integer({
      description: 'Seconds to wait for the hub\'s project-log entry that says what happened (0 = do not wait)',
      default: 60,
      min: 0,
    }),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(MembershipPasswordResetRequest)
    const ctx = await this.freshContext(flags)
    this.assertEndpoints(ctx)

    if (!ctx.projectId) this.error('No project ID configured. Run `norbix login` or pass --project.')
    const token = ctx.bearerToken ?? ctx.apiKey
    if (!token) this.error('Not authenticated. Run `norbix login` or pass --api-key.')

    const url = `${ctx.apiUrl.replace(/\/$/, '')}/v3/membership/userauth/password/reset/test`
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'norbix-project-id': ctx.projectId,
    }
    if (ctx.accountId) headers['norbix-account-id'] = ctx.accountId
    if (ctx.env && ctx.env !== 'PROD') headers['norbix-env'] = ctx.env
    if (ctx.region) headers['nb-region'] = ctx.region
    const body = {email: args.email}

    if (flags['dry-run']) {
      return this.dryRun({
        method: 'membership password reset request',
        request: body,
        http: {method: 'POST', url, headers: {...headers, Authorization: 'Bearer ***'}, body},
      })
    }

    const res = await fetch(url, {method: 'POST', headers, body: JSON.stringify(body)})
    const text = await res.text()
    let answer: TestPasswordResetAnswer
    try {
      answer = JSON.parse(text) as TestPasswordResetAnswer
    } catch {
      this.error(`HTTP ${res.status}: ${text.slice(0, 300)}`)
    }

    if (!res.ok || answer.responseStatus?.isSuccess === false) {
      const why = answer.responseStatus?.errors?.map((e) => [e.errorCode, e.message].filter(Boolean).join(' ')).join('; ')
      this.error(`HTTP ${res.status}${why ? `: ${why}` : ''}${res.status === 401 || res.status === 403 ? ' (an admin sign-in is needed)' : ''}`)
    }

    let delivery: DeliveryResult = {status: 'unknown'}
    if (answer.queued && answer.correlationId && flags.wait > 0) {
      const client = this.client(flags)
      const until = Date.now() + flags.wait * 1000
      while (delivery.status === 'unknown' && Date.now() < until) {
        await new Promise((r) => setTimeout(r, 2000))
        const logs = (await client.hub.logs.getLogs({logCorrelationId: answer.correlationId, module: 'Membership', pageSize: 50})) as {
          list?: {items?: LogEntry[]}
        }
        delivery = deliveryFrom(logs?.list?.items ?? [])
      }
    }

    const result = {...answer, responseStatus: undefined, delivery}
    if (!this.jsonEnabled()) this.log(describe(answer, delivery, flags.wait))
    return result
  }
}

/** The plain-text report. */
export function describe(answer: TestPasswordResetAnswer, delivery: DeliveryResult, waited: number): string {
  const env = answer.env ?? 'PROD'
  const lines: string[] = []
  if (!answer.queued) {
    lines.push(`Nothing sent in ${env}: ${answer.reason ?? 'unknown reason'}.`)
    if (answer.reason === 'no-login') lines.push(`  No login with that address in ${env}'s users database. Check --env.`)
  } else {
    lines.push(`Queued in ${env} (correlation ${answer.correlationId}; the link expires ${answer.expiresAtUtc}).`)
  }

  if (answer.integrationProblem) lines.push(`  The hub will NOT send it: ${answer.integrationProblem}.`)
  else if (answer.integrationId) lines.push(`  Integration for ${env}: ${answer.integrationName} (${answer.provider}, ${answer.integrationId}).`)

  if (answer.queued) {
    if (delivery.status === 'sent') {
      lines.push(`Sent by the hub through ${delivery.integrationName} (${delivery.provider}, ${delivery.integrationId}).`)
      lines.push(delivery.template
        ? `  Template ${delivery.template}, language ${delivery.language}.`
        : `  Fixed English text (template not used: ${delivery.fallbackReason ?? 'unknown'}).`)
    } else if (delivery.status === 'not-sent') {
      lines.push(`The hub did NOT send it: ${delivery.reason ?? 'unknown reason'}.`)
    } else if (waited > 0) {
      lines.push(`No project-log entry from the hub within ${waited}s. Check \`norbix logs list --correlation ${answer.correlationId}\` later; if it stays empty, ${env} has no logging integration.`)
    }
  }

  return lines.join('\n')
}
