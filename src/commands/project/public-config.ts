import {Args} from '@oclif/core'

import {ProjectCommand} from '../../lib/project.js'

export default class ProjectPublicConfig extends ProjectCommand {
  static description = `Show the project's public config: name, branding, sign-in options, AI chat

This is what the admin portal and other apps read before anyone signs in (API
host, public route).`

  static examples = ['<%= config.bin %> project public-config', '<%= config.bin %> project public-config 66b2f0a1... --json']

  static args = {
    id: Args.string({description: 'Project ID (defaults to the configured project)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(ProjectPublicConfig)
    const {client, projectId} = this.projectClient(flags, args.id)

    const res = await client.api.public.getPublicProjectConfig({projectId})

    this.print(res)
    return res
  }
}
