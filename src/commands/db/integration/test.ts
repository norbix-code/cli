import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class DbIntegrationTest extends BaseCommand {
  static description = `Check that a database integration can be reached

The server connects to the database behind the integration and reports
whether it answers. Nothing is written.`

  static examples = [
    '<%= config.bin %> db integration test 66b2f0a1c3d4e5f6a7b8c9d0',
    '<%= config.bin %> db integration test 66b2f0a1c3d4e5f6a7b8c9d0 --json',
  ]

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbIntegrationTest)
    const client = this.client(flags)

    const res = await client.hub.database.testDatabaseIntegration({integrationId: args.id})

    this.print(res)
    return res
  }
}
