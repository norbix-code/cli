import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class EmailStop extends BaseCommand {
  static description = 'Stop a running email campaign'

  static examples = ['<%= config.bin %> email stop 66b2f0a1... --yes']

  static args = {
    id: Args.string({required: true, description: 'Campaign ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailStop)
    const client = this.client(flags)

    await this.confirmOrFail(`Stop email campaign ${args.id}?`, flags)

    const res = await client.hub.notifications.stopEmailCampaign({id: args.id})
    this.print(`Campaign ${args.id} stopped.`)
    return res
  }
}
