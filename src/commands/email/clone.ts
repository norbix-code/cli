import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class EmailClone extends BaseCommand {
  static description = 'Clone an email template'

  static examples = ['<%= config.bin %> email clone 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Template ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailClone)
    const client = this.client(flags)

    const res = await client.hub.notifications.cloneEmailTemplate({id: args.id})
    this.print(`Template ${args.id} cloned.`)
    return res
  }
}
