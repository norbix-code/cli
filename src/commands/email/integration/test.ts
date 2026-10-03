import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class EmailIntegrationTest extends BaseCommand {
  static description = `Send a test e-mail through an integration

Point this at the Fake integration while you are developing — it accepts the
send and contacts no mail service, so nothing reaches a real inbox. With a real
provider, run \`email integration confirm-delivery\` once the e-mail arrived.`

  static examples = ['<%= config.bin %> email integration test --integration 66b2f0a1... --to dev@example.com']

  static flags = {
    integration: Flags.string({required: true, description: 'Integration ID to send through'}),
    to: Flags.string({required: true, description: 'E-mail address to send the test to'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(EmailIntegrationTest)
    const client = this.client(flags)

    const res = await client.hub.notifications.testEmailIntegration({
      integrationId: flags.integration,
      to: flags.to,
    })

    this.print(res)
    return res
  }
}
