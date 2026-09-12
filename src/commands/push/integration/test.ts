import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class PushIntegrationTest extends BaseCommand {
  static description = `Send a test push through an integration

Point this at the Fake integration while you are developing — it accepts the
send and contacts no push service, so nothing reaches a real device.`

  static examples = [
    '<%= config.bin %> push integration test --integration 66b2f0a1... --token dGVzdA== --family Ios',
  ]

  static flags = {
    integration: Flags.string({required: true, description: 'Integration ID to send through'}),
    token: Flags.string({description: 'Device token to send the test to'}),
    family: Flags.string({
      description: 'Which platform the token came from',
      options: ['Ios', 'Android', 'Chrome', 'Safari', 'Expo'],
    }),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(PushIntegrationTest)
    const client = this.client(flags)

    const res = await client.hub.notifications.testPushIntegration({
      integrationId: flags.integration,
      testToken: flags.token,
      deliveryFamily: flags.family,
    })

    this.print(res)
    return res
  }
}
