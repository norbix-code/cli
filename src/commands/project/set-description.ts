import {Args, Flags} from '@oclif/core'

import {ProjectCommand} from '../../lib/project.js'

export default class ProjectSetDescription extends ProjectCommand {
  static description = 'Set or clear the project description'

  static examples = [
    '<%= config.bin %> project set-description "Orders and invoices for the web shop"',
    '<%= config.bin %> project set-description --clear',
  ]

  static args = {
    description: Args.string({description: 'New description'}),
  }

  static flags = {
    clear: Flags.boolean({description: 'Remove the description', default: false}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(ProjectSetDescription)
    if (!args.description && !flags.clear) this.error('Pass the new description, or --clear to remove it.')
    const {client, projectId} = this.projectClient(flags)

    const res = await client.hub.account.updateProjectDescription({
      projectId,
      description: flags.clear ? '' : args.description,
    })

    this.print(flags.clear ? 'Description removed.' : 'Description saved.')
    return res
  }
}
