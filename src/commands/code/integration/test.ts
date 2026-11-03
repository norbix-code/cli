import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class CodeIntegrationTest extends BaseCommand {
  static description = `Check that a code integration works: a live call to the provider

The gateway lists the functions the integration may call (or, for Azure, reads
the function app). Point this at the Sandbox integration while you are
developing — it contacts no cloud. With a real provider, run \`code integration
confirm-delivery\` once you checked the result.`

  static examples = [
    '<%= config.bin %> code integration test --integration 66b2f0a1c3d4e5f6a7b8c9d0',
    '<%= config.bin %> code integration test --integration 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    integration: Flags.string({required: true, description: 'Integration ID to test'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(CodeIntegrationTest)
    const client = this.client(flags)

    const res = await client.hub.code.testCodeIntegration({integrationId: flags.integration})

    this.print(res)
    return res
  }
}
