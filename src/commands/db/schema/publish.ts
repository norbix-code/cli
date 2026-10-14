import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {toEnvelope} from '../../../lib/cli-error.js'

/** The gateway's "this publish removes fields" refusal (SchemaBreakingChangeRequiresConfirmationError). */
export const BREAKING_CHANGE = 'CM-ERRORS-SCHEMA-020'

export default class DbSchemaPublish extends BaseCommand {
  static description = `Publish the draft of a database schema

Records are validated against the published version from now on. Check the
change first with \`db schema draft <id>\` or \`db schema diff\`.

Confirmation is needed only when the publish would put data at risk. The
first attempt asks the Hub to publish WITHOUT the breaking-change switch: a
first publish, or one that only adds or changes fields, goes through at once
— no --yes needed. When the new version removes fields that the published
one has (the Hub answers ${BREAKING_CHANGE}), the CLI names them and asks;
in a script it exits 3 and publishes nothing — re-run with --yes to publish
anyway. --yes up front publishes even a breaking change in one call.`

  static examples = [
    '<%= config.bin %> db schema publish sch_6zbH6AJwyGylTFfs4B9bpC',
    '<%= config.bin %> db schema publish sch_6zbH6AJwyGylTFfs4B9bpC --dry-run',
    '<%= config.bin %> db schema publish sch_6zbH6AJwyGylTFfs4B9bpC --yes',
  ]

  static args = {
    id: Args.string({required: true, description: 'Schema ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbSchemaPublish)
    const client = this.client(flags)
    const publish = (confirmed: boolean) => client.hub.database.publishDatabaseSchema({id: args.id, confirmed})

    // `confirmed` is the Hub's own "yes, publish even a breaking change"
    // switch. Without --yes it is false, so the Hub itself decides whether
    // anything is at risk.
    let res: unknown
    try {
      res = await publish(flags.yes)
    } catch (error) {
      const envelope = toEnvelope(error)
      if (flags.yes || envelope.code !== BREAKING_CHANGE) throw error
      const removed = removedFieldsOf(envelope.context)
      await this.confirmOrFail(
        `Publishing schema ${args.id} removes ${removed ? `the field(s) ${removed}` : 'fields'} that the published version has (a breaking change). Publish anyway?`,
        flags,
      )
      res = await publish(true)
    }

    this.print(`Schema ${args.id} published.`)
    return res
  }
}

/** `RemovedFieldsText` from the error's context, whatever its casing. */
function removedFieldsOf(context: Record<string, unknown> | undefined): string | undefined {
  for (const [key, value] of Object.entries(context ?? {})) {
    if (key.toLowerCase() === 'removedfieldstext' && typeof value === 'string' && value) return value
  }

  return undefined
}
