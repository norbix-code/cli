import {Flags} from '@oclif/core'

import {ProjectCommand} from '../../../lib/project.js'

export default class ProjectAdminPortalDisable extends ProjectCommand {
  static description = "Turn off the project's admin portal (its users can no longer sign in there)"

  static examples = ['<%= config.bin %> project admin-portal disable --yes']

  static flags = {
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt', default: false}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ProjectAdminPortalDisable)
    const {client, projectId} = this.projectClient(flags)

    if (!(await this.confirmOrStop(flags.yes, 'Turn off the admin portal? Its users can no longer sign in there.'))) return

    const res = await client.hub.account.setAdminPortalEnabled({projectId, enabled: false})

    this.print('Admin portal disabled.')
    return res
  }
}
