import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class EmailValidationTest extends BaseCommand {
  static description = `Check that an email-validation integration can reach its provider

The provider checks one test address; no e-mail is sent.`

  static examples = [
    '<%= config.bin %> email validation test 66b2f0a1c3d4e5f6a7b8c9d0',
    '<%= config.bin %> email validation test 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Validation integration ID'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailValidationTest)
    const client = this.client(flags)

    const res = await client.hub.notifications.testEmailValidationIntegration({integrationId: args.id})

    this.print(res)
    return res
  }
}
