import {readFileSync} from 'node:fs'

import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {CliError, toEnvelope, usageError} from '../../../lib/cli-error.js'
import {
  CLICKS_PER_BATCH,
  batches,
  formatSummary,
  parseClicksFile,
  summarize,
  type RecordEmailClicksAnswer,
} from '../../../lib/email-clicks.js'

export default class EmailClicksImport extends BaseCommand {
  static description = `Send email clicks back: the nblid values your site, logs or analytics saw

Reads a JSON array of clicks ({"nblid", "url", "clickedAt", "userAgent"}) or a
CSV whose first row names the columns nblid, url, clickedAt, userAgent (any
order; only nblid is required). Every row is checked before anything is sent:
an empty file or a row with no nblid sends nothing (exit 2). Sent in batches of
at most ${CLICKS_PER_BATCH}. Prints recorded / duplicates / flagged / rejected and every
rejected row (row numbers from 1, the CSV header not counted) with its reason:
not-valid (the id was not made for this project and environment), not-found
(no such email) or in-future. A click that looks like a mail scanner is
recorded but flagged suspected-scanner. --json prints the gateway's answer per
batch as well as the totals.

Running the same file again is safe: the same nblid, url and clickedAt answers
duplicate. A row with no clickedAt is stamped "now" by the gateway, so only
rows that carry clickedAt are recognised as duplicates on a second run.
Clicks are recorded only for emails sent while \`norbix email click-tracking\`
was on.`

  static examples = [
    '<%= config.bin %> email clicks import clicks.csv',
    '<%= config.bin %> email clicks import clicks.json --json',
    '<%= config.bin %> email clicks import clicks.csv --env TEST --dry-run',
  ]

  static args = {
    file: Args.string({required: true, description: 'A JSON array of clicks, or a CSV with a header row (nblid, url, clickedAt, userAgent)'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailClicksImport)

    let text: string
    try {
      text = readFileSync(args.file, 'utf8')
    } catch (error) {
      throw usageError(`Cannot read ${args.file}: ${(error as Error).message}`, 'Pass the path of a JSON or CSV file of clicks.')
    }

    const clicks = parseClicksFile(text)
    const client = this.client(flags)
    const answers: RecordEmailClicksAnswer[] = []
    const chunks = batches(clicks)
    for (const [b, chunk] of chunks.entries()) {
      try {
        answers.push((await client.hub.notifications.recordEmailClicks({clicks: chunk})) as RecordEmailClicksAnswer)
      } catch (error) {
        throw b === 0 ? error : partialFailure(error, b * CLICKS_PER_BATCH, clicks.length, this.commandName)
      }
    }

    const summary = summarize(clicks, answers)
    const undated = clicks.filter((c) => !c.clickedAt).length
    if (!this.jsonEnabled()) {
      this.log(formatSummary(summary).join('\n'))
      if (undated > 0) {
        process.stderr.write(
          `Note: ${undated} row${undated === 1 ? ' has' : 's have'} no clickedAt — the gateway stamped ${undated === 1 ? 'it' : 'them'} now, so running this file again records ${undated === 1 ? 'it' : 'them'} again.\n`,
        )
      }

      const notValid = summary.rejectedRows.filter((r) => r.reason === 'not-valid').length
      if (notValid > 0 && notValid === summary.clicks) {
        process.stderr.write('Hint: every click id was not valid. A click id is valid only in the project and environment that sent the email — check --project and --env.\n')
      }
    }

    return {...summary, withoutClickedAt: undated, answers}
  }
}

/** A batch after the first failed: say how many rows the gateway already has, and that a re-run is safe. */
function partialFailure(error: unknown, sent: number, total: number, command: string): CliError {
  const envelope = toEnvelope(error, {command})
  const note = `${sent} of ${total} clicks were sent before this error. Running the file again is safe: rows already recorded answer duplicate (rows with no clickedAt are recorded again).`
  return new CliError({
    ...envelope,
    hint: envelope.hint ? `${note} ${envelope.hint}` : note,
    context: {...envelope.context, sent, total},
  })
}
