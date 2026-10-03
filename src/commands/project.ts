import {Args} from '@oclif/core'

import {ProjectCommand} from '../lib/project.js'

export default class Project extends ProjectCommand {
  static description = `Show a project: name, languages, regions, CORS origins, admin portal, modules

Shows the configured project unless you pass another project ID. List every
project of the account with \`account projects\`.`

  static examples = ['<%= config.bin %> project', '<%= config.bin %> project 66b2f0a1c3d4e5f6a7b8c9d0 --json']

  static args = {
    id: Args.string({description: 'Project ID (defaults to the configured project)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(Project)
    const {client, projectId} = this.projectClient(flags, args.id)

    const res = await client.hub.account.getProject({projectId})

    this.print(res)
    return res
  }
}
