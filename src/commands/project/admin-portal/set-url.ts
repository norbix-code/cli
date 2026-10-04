import {Args, Flags} from '@oclif/core'

import {ProjectCommand} from '../../../lib/project.js'

export default class ProjectAdminPortalSetUrl extends ProjectCommand {
  static description = `Give the admin portal your own address, or go back to the Norbix one

--clear goes back to the address Norbix gives every project.`

  static examples = [
    '<%= config.bin %> project admin-portal set-url https://admin.example.com',
    '<%= config.bin %> project admin-portal set-url --clear',
    '<%= config.bin %> project admin-portal set-url https://admin.example.com --dry-run',
  ]

  static args = {
    url: Args.string({description: 'Admin portal address'}),
  }

  static flags = {
    ...ProjectCommand.dryRunFlags,
    clear: Flags.boolean({description: 'Use the Norbix address again', default: false}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(ProjectAdminPortalSetUrl)
    if (!args.url && !flags.clear) this.error('Pass the address, or --clear to use the Norbix one.')
    const {client, projectId} = this.projectClient(flags)

    const res = await client.hub.account.updateProjectAdminUrl({projectId, url: flags.clear ? undefined : args.url})

    this.print(flags.clear ? 'Admin portal address reset.' : `Admin portal address set to ${args.url}.`)
    return res
  }
}
