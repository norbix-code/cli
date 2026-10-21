import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {CliError, usageError} from '../../lib/cli-error.js'
import {EXIT} from '../../lib/exit-codes.js'
import {readJsonInput} from '../../lib/json.js'
import {parseMetadata} from '../../lib/payments.js'

type Level = 'information' | 'warning' | 'error'

interface Entry {
  level?: Level
  title: string
  message?: string
  eventCode?: string
  correlationId?: string
  timestamp?: string
  meta?: Record<string, string>
}

export default class LogsWrite extends BaseCommand {
  static description = `Write your own lines to the project's logs

One line from the flags (--title is required), or up to 100 from --file: a
JSON array of entries {title, level?, message?, eventCode?, correlationId?,
timestamp?, meta?} — a path, @path, or - for stdin. The lines are queued and
show in \`logs list\` a moment later; prints how many were accepted.
eventCode is stored as app:<code>. On a 429 the project's per-minute quota is
used up: the error says how many seconds to wait (Retry-After).`

  static examples = [
    '<%= config.bin %> logs write --title "Order paid" --event-code order:paid --meta orderId=ord_123',
    '<%= config.bin %> logs write --title "Payment failed" --level error --message "Card declined" --correlation-id ord_123',
    '<%= config.bin %> logs write --file entries.json',
    '<%= config.bin %> logs write --title "Order paid" --dry-run',
    'cat entries.json | <%= config.bin %> logs write --file -',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    title: Flags.string({description: 'A short line, 1–200 characters (what the Logs list shows)', exclusive: ['file']}),
    level: Flags.string({description: 'Severity', options: ['information', 'warning', 'error'], exclusive: ['file']}),
    message: Flags.string({description: 'Details, at most 8 000 characters', exclusive: ['file']}),
    'event-code': Flags.string({
      description: 'Your code for this kind of line (a-z 0-9 _ . : -, at most 64); stored as app:<code>',
      exclusive: ['file'],
    }),
    'correlation-id': Flags.string({
      description: 'Groups lines into one flow (letters, digits, _ or -, at most 64)',
      exclusive: ['file'],
    }),
    timestamp: Flags.string({
      description: 'When it happened (UTC, ISO 8601; at most 7 days old, 5 minutes ahead)',
      exclusive: ['file'],
    }),
    meta: Flags.string({description: 'Extra field key=value (repeat for several, at most 20)', multiple: true, exclusive: ['file']}),
    file: Flags.string({description: 'A JSON array of entries: a path, @path, or - for stdin'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(LogsWrite)
    const entries = flags.file ? await readEntries(flags.file) : [this.entryFromFlags(flags)]

    const client = this.client(flags)
    let res: {accepted?: number}
    try {
      res = (await client.api.logs.writeLogs({entries} as Parameters<typeof client.api.logs.writeLogs>[0])) as {
        accepted?: number
      }
    } catch (error) {
      throw quotaError(error) ?? error
    }

    this.print(`accepted: ${res?.accepted ?? 0}`)
    return res
  }

  private entryFromFlags(flags: {
    title?: string
    level?: string
    message?: string
    'event-code'?: string
    'correlation-id'?: string
    timestamp?: string
    meta?: string[]
  }): Entry {
    if (!flags.title) {
      throw usageError('Pass --title (or --file with a JSON array of entries).', 'e.g. norbix logs write --title "Order paid"')
    }

    let meta: Record<string, string> | undefined
    try {
      meta = parseMetadata(flags.meta)
    } catch (error) {
      throw usageError((error as Error).message, 'e.g. --meta orderId=ord_123 (repeat for several)')
    }

    const entry: Entry = {title: flags.title}
    if (flags.level) entry.level = flags.level as Level
    if (flags.message !== undefined) entry.message = flags.message
    if (flags['event-code']) entry.eventCode = flags['event-code']
    if (flags['correlation-id']) entry.correlationId = flags['correlation-id']
    if (flags.timestamp) entry.timestamp = flags.timestamp
    if (meta) entry.meta = meta
    return entry
  }
}

/** --file: `-` (stdin), `@path`, inline JSON, or a plain path. Must be a non-empty array. */
async function readEntries(value: string): Promise<Entry[]> {
  const source = value === '-' || value.startsWith('@') || /^\s*[[{]/.test(value) ? value : `@${value}`
  const parsed = JSON.parse(await readJsonInput(source, 'file')) as unknown
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw usageError(
      '--file must hold a JSON array with at least one entry.',
      'e.g. [{"title":"Order paid","eventCode":"order:paid"}] — at most 100 entries per call.',
    )
  }

  return parsed as Entry[]
}

/** A 429 from the gateway: the per-minute quota is used up; say how long to wait. */
function quotaError(error: unknown): CliError | undefined {
  const err = error as {name?: string; status?: number; code?: string; message?: string; url?: string; retryAfterSeconds?: number}
  if (!err || typeof err !== 'object' || !err.name?.startsWith('Norbix') || err.status !== 429) return undefined
  const seconds = err.retryAfterSeconds
  const wait = seconds === undefined ? 'a minute' : `${seconds} second${seconds === 1 ? '' : 's'}`
  return new CliError({
    exit: EXIT.SERVER,
    code: err.code ?? 'CM-ERRORS-LOGGING-003',
    status: 429,
    url: err.url,
    message: `${err.message ?? 'Log quota used up.'} Retry after ${wait}.`,
    hint: `The project's per-minute log quota is used up. Wait ${wait} and send again.`,
    context: seconds === undefined ? undefined : {retryAfterSeconds: seconds},
  })
}
