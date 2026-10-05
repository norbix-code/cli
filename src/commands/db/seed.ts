import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {databaseIntegrationFlag, readJsonText} from '../../lib/database.js'

export default class DbSeed extends BaseCommand {
  static description = `Fill several collections with test records in one call

The server reads the published schemas, inserts parents before children and
puts real record ids into reference fields. --collections is a JSON array:

  dummy mode (default):  [{"collectionName":"families","count":3}]
  realistic mode:        [{"collectionName":"pairs","documents":[{...}]}]

In realistic mode a reference to another seeded collection is written as
{"$seedRef":{"collection":"<name>","index":<n>}}. All or nothing: every
document is validated first. The report lists the ids inserted per collection.`

  static examples = [
    `<%= config.bin %> db seed --collections '[{"collectionName":"orders","count":5}]' --yes`,
    '<%= config.bin %> db seed --mode realistic --collections @seed.json --yes',
    `<%= config.bin %> db seed --collections '[{"collectionName":"orders","count":5}]' --dry-run`,
  ]

  static flags = {
    ...BaseCommand.mutatingFlags,
    ...databaseIntegrationFlag,
    collections: Flags.string({char: 'c', required: true, description: 'JSON array — inline, @file or -'}),
    mode: Flags.string({description: 'Seeding mode', options: ['dummy', 'realistic'], default: 'dummy'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(DbSeed)
    const client = this.client(flags)

    const collections = await readJsonText(flags.collections, 'collections')
    if (!collections.startsWith('[')) this.error('--collections must be a JSON array.')
    await this.confirmOrFail(`Insert ${flags.mode} test records into the collections in ${collections}?`, flags)

    const res = await client.hub.database.seedCollectionRecords({
      mode: flags.mode,
      databaseIntegrationId: flags.integration,
      collections,
    })

    this.print(res)
    return res
  }
}
