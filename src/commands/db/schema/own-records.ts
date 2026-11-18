import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {listOf} from '../../../lib/membership.js'

export default class DbSchemaOwnRecords extends BaseCommand {
  static description = `List or turn on "signed-in users can create their own records"

Every schema of the environment (--env) with its endUserOwnRecords switch and
hasRecordOwner, and what the call did or would do (unchanged, already on,
would turn on, cannot turn on: needs hasRecordOwner, turned on, refused).

A preview is the default: it sends dryRun true and changes nothing. With
--enable and --yes it turns the switch ON for exactly the schemas named
(collection names) — never anything else, never off. Turn one off with
\`db schema settings set <id> --own-records false\`.`

  static examples = [
    '<%= config.bin %> db schema own-records',
    '<%= config.bin %> db schema own-records --enable orders,invoices --dry-run',
    '<%= config.bin %> db schema own-records --enable orders --yes',
  ]

  static flags = {
    ...BaseCommand.mutatingFlags,
    enable: Flags.string({description: 'Collection names to turn the switch on for, comma separated (repeatable)', multiple: true}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(DbSchemaOwnRecords)
    const client = this.client(flags)
    const enable = listOf(flags.enable) ?? []

    // The gateway reads an unset dryRun as true; it is always sent, and only
    // --yes with names to enable turns the preview into a change.
    const dryRun = !(flags.yes && enable.length > 0)
    const res = await client.hub.database.endUserOwnRecordsReport({dryRun, enable})

    this.print(res)
    return res
  }
}
