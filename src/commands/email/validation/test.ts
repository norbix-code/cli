import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class EmailValidationTest extends BaseCommand {
  static description = `Check that an email-validation integration can reach its provider

The provider checks one test address; no e-mail is sent.`

  static examples = ['<%= config.bin %> email validation test 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Validation integration ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailValidationTest)
    const client = this.client(flags)

    const res = await client.hub.notifications.testEmailValidationIntegration({integrationId: args.id})

    this.print(res)
    return res
  }
}
