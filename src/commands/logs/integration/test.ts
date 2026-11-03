import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class LogsIntegrationTest extends BaseCommand {
  static description = `Check that a logging integration works: a live write to the provider

Nothing is delivered to an integration until its last test passed, so run this
after every save. The answer lists one step per operation with its result.`

  static examples = [
    '<%= config.bin %> logs integration test --integration 66b2f0a1c3d4e5f6a7b8c9d0',
    '<%= config.bin %> logs integration test --integration 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    integration: Flags.string({required: true, description: 'Integration ID to test'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(LogsIntegrationTest)
    const client = this.client(flags)

    const res = await client.hub.logs.testLoggingIntegration({integrationId: flags.integration})

    this.print(res)
    return res
  }
}
