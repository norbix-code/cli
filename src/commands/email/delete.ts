import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class EmailDelete extends BaseCommand {
  static description = 'Delete an email template'

  static examples = ['<%= config.bin %> email delete 66b2f0a1... --yes']

  static args = {
    id: Args.string({required: true, description: 'Template ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailDelete)
    const client = this.client(flags)

    await this.confirmOrFail(`Delete email template ${args.id}?`, flags)

    const res = await client.hub.notifications.deleteEmailTemplate({id: args.id})
    this.print(`Template ${args.id} deleted.`)
    return res
  }
}
