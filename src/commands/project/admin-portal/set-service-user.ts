import {Args} from '@oclif/core'

import {ProjectCommand} from '../../../lib/project.js'

export default class ProjectAdminPortalSetServiceUser extends ProjectCommand {
  static description = `Pick the service user the admin portal acts as

The admin portal calls the project's APIs under this user's permissions.`

  static examples = ['<%= config.bin %> project admin-portal set-service-user 66b2f0a1...']

  static args = {
    id: Args.string({required: true, description: 'Service user ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(ProjectAdminPortalSetServiceUser)
    const {client, projectId} = this.projectClient(flags)

    const res = await client.hub.account.assignAdminPortalServiceUser({projectId, serviceUserId: args.id})

    this.print(`Admin portal service user set to ${args.id}.`)
    return res
  }
}
