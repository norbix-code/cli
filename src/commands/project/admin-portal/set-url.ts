import {Args, Flags} from '@oclif/core'

import {ProjectCommand} from '../../../lib/project.js'

export default class ProjectAdminPortalSetUrl extends ProjectCommand {
  static description = `Save the address where you run the admin portal, or remove it

Norbix hosts no admin portal: you run github.com/norbix-code/admin yourself.
Saving its address adds the address's origin to CORS, and password-reset,
magic-link and invitation e-mails open it. --clear removes the address.`

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
    clear: Flags.boolean({description: 'Remove the saved address', default: false}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(ProjectAdminPortalSetUrl)
    if (!args.url && !flags.clear) this.error('Pass the address, or --clear to remove it.')
    const {client, projectId} = this.projectClient(flags)

    const res = await client.hub.account.updateProjectAdminUrl({projectId, url: flags.clear ? undefined : args.url})

    this.print(flags.clear ? 'Admin portal address removed.' : `Admin portal address set to ${args.url}.`)
    return res
  }
}
