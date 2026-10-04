import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class SmsDelete extends BaseCommand {
  static description = 'Delete an SMS template'

  static examples = [
    '<%= config.bin %> sms delete 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    '<%= config.bin %> sms delete 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Template ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(SmsDelete)
    const client = this.client(flags)

    await this.confirmOrFail(`Delete SMS template ${args.id}?`, flags)

    const res = await client.hub.notifications.deleteSmsTemplate({id: args.id})
    this.print(`Template ${args.id} deleted.`)
    return res
  }
}
