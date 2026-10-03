import {Args, Flags} from '@oclif/core'

import {ProjectCommand} from '../../lib/project.js'

export default class ProjectSetUrl extends ProjectCommand {
  static description = `Set or clear the project's website address

This is the public site the project belongs to (shown on the admin portal and
in e-mails). The admin portal's own address is \`project admin-portal set-url\`.`

  static examples = [
    '<%= config.bin %> project set-url https://shop.example.com',
    '<%= config.bin %> project set-url --clear',
  ]

  static args = {
    url: Args.string({description: 'Website address'}),
  }

  static flags = {
    clear: Flags.boolean({description: 'Remove the address', default: false}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(ProjectSetUrl)
    if (!args.url && !flags.clear) this.error('Pass the address, or --clear to remove it.')
    const {client, projectId} = this.projectClient(flags)

    const res = await client.hub.account.updateProjectUrl({projectId, url: flags.clear ? undefined : args.url})

    this.print(flags.clear ? 'Website address removed.' : `Website address set to ${args.url}.`)
    return res
  }
}
