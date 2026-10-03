import {Args} from '@oclif/core'

import {ProjectCommand} from '../../lib/project.js'

export default class ProjectSetDefaultLanguage extends ProjectCommand {
  static description = 'Set the project default language (one of its languages)'

  static examples = ['<%= config.bin %> project set-default-language en']

  static args = {
    language: Args.string({required: true, description: 'Language code'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(ProjectSetDefaultLanguage)
    const {client, projectId} = this.projectClient(flags)

    const res = await client.hub.account.updateProjectDefaultLanguage({projectId, defaultLanguage: args.language})

    this.print(`Default language set to ${args.language}.`)
    return res
  }
}
