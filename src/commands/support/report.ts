import {Flags} from '@oclif/core'
import {NorbixError} from '@norbix.ai/ts'

import {BaseCommand} from '../../base.js'

/** Turns repeated `--evidence key=value` flags into the evidence map the hub reads. */
export function evidenceFrom(pairs: string[] | undefined): Record<string, string> {
  const evidence: Record<string, string> = {}
  for (const pair of pairs ?? []) {
    const at = pair.indexOf('=')
    if (at > 0) evidence[pair.slice(0, at).trim()] = pair.slice(at + 1).trim()
  }
  return evidence
}

export default class SupportReport extends BaseCommand {
  static description = `Report a problem in Norbix itself to Norbix support, with the evidence

Use it when you have clear evidence that Norbix failed — a Norbix error code or a 5xx answer for a valid request — not for your own mistake, a validation error or a missing permission. The same problem again is added to its open case. It is free and does not count against any support allowance; Norbix reads every report but does not promise an immediate fix. Never put a secret, a key or a token in the message or the evidence.`

  static examples = [
    '<%= config.bin %> support report --subject "insert answers 500 on orders" --message "Inserted {total: 12}, got 500, expected the record id" --evidence errorCode=CM-ERRORS-GENERIC-500 --evidence httpStatus=500 --evidence endpoint=/v3/db/collections/orders/records --evidence correlationId=c0ffee00',
    '<%= config.bin %> support report --subject "…" --message "…" --automatic --json',
  ]

  static flags = {
    subject: Flags.string({required: true, description: 'One line: what failed'}),
    message: Flags.string({required: true, description: 'What you did, what Norbix answered, what you expected'}),
    kind: Flags.string({description: 'Bug (default) or Incident', options: ['Bug', 'Incident']}),
    severity: Flags.string({description: 'S1 (production down) … S4 (minor); default S3', options: ['S1', 'S2', 'S3', 'S4']}),
    evidence: Flags.string({
      multiple: true,
      description:
        'key=value, repeatable: errorCode, httpStatus, endpoint, method, correlationId, requestId, occurredAt, environment, region, details',
    }),
    automatic: Flags.boolean({description: 'An AI agent or a script files this, not a person typing it'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(SupportReport)
    const client = this.client(flags)
    const ctx = this.resolveContext(flags)

    try {
      const res = await client.hub.support.reportNorbixIssue({
        subject: flags.subject,
        message: flags.message,
        kind: flags.kind,
        severity: flags.severity,
        projectId: ctx.projectId,
        source: 'Cli',
        automatic: flags.automatic,
        reportedBy: `norbix-cli ${this.config.version}`,
        evidence: {
          ...evidenceFrom(flags.evidence),
          client: 'norbix-cli',
          clientVersion: this.config.version,
          ...(ctx.projectId ? {projectId: ctx.projectId} : {}),
        },
      })
      this.print(res)
      return res
    } catch (error) {
      if (error instanceof NorbixError && (error.status === 404 || error.status === 405)) {
        this.error('This Norbix does not take issue reports yet (its hub is older than the report route). Tell the user what failed instead.', {exit: 4})
      }
      throw error
    }
  }
}
