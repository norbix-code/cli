import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class SmsIntegrationDelete extends BaseCommand {
  static description = 'Delete an SMS integration'

  static examples = [
    '<%= config.bin %> sms integration delete 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    '<%= config.bin %> sms integration delete 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(SmsIntegrationDelete)
    const client = this.client(flags)

    await this.confirmOrFail(`Delete SMS integration ${args.id}?`, flags)

    const res = await client.hub.notifications.deleteSmsIntegration({id: args.id})

    this.print(`Integration ${args.id} deleted.`)
    return res
  }
}
