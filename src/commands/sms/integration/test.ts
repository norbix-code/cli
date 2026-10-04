import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class SmsIntegrationTest extends BaseCommand {
  static description = `Send a test SMS through an integration

Point this at the Fake integration while you are developing — it accepts the
send and contacts no SMS service, so nothing reaches a real phone.`

  static examples = [
    '<%= config.bin %> sms integration test --integration 66b2f0a1c3d4e5f6a7b8c9d0 --to +37060000000',
    '<%= config.bin %> sms integration test --integration 66b2f0a1c3d4e5f6a7b8c9d0 --to +37060000000 --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    integration: Flags.string({required: true, description: 'Integration ID to send through'}),
    to: Flags.string({description: 'Phone number (international format) to send the test to'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(SmsIntegrationTest)
    const client = this.client(flags)

    const res = await client.hub.notifications.testSmsIntegration({
      integrationId: flags.integration,
      to: flags.to,
    })

    this.print(res)
    return res
  }
}
