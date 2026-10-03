import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class EmailIntegrationDisable extends BaseCommand {
  static description = 'Turn an email integration off'

  static examples = ['<%= config.bin %> email integration disable 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailIntegrationDisable)
    const client = this.client(flags)

    const res = await client.hub.notifications.disableEmailIntegration({id: args.id})

    this.print(`Integration ${args.id} disabled.`)
    return res
  }
}
