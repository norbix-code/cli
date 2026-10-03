import {Args, Flags} from '@oclif/core'

import {ProjectCommand, originsOf, sameOrigin} from '../../../lib/project.js'

export default class ProjectCorsRemove extends ProjectCommand {
  static description = `Stop allowing one or more origins, keeping the rest

The server stores the full list, so this reads the current origins first and
writes them back without the ones you name. Removing the project's own admin
portal origin needs --remove-admin-portal-origin.`

  static examples = ['<%= config.bin %> project cors remove https://staging.example.com']

  static strict = false

  static args = {
    origin: Args.string({required: true, description: 'Origins to remove (one or more)'}),
  }

  static flags = {
    'remove-admin-portal-origin': Flags.boolean({
      description: "Allow removing the project's own admin portal origin",
      default: false,
    }),
  }

  async run(): Promise<unknown> {
    const {argv, flags} = await this.parse(ProjectCorsRemove)
    const unwanted = argv as string[]
    const {client, projectId} = this.projectClient(flags)

    const current = originsOf(await client.hub.account.getProject({projectId}))
    const origins = current.filter((c) => !unwanted.some((o) => sameOrigin(c, o)))
    if (origins.length === current.length) {
      this.print('None of these origins is allowed — nothing to change.')
      return {origins: current}
    }

    await client.hub.account.updateProjectAllowedOrigins({
      projectId,
      origins,
      removeAdminPortalOrigin: flags['remove-admin-portal-origin'] || undefined,
    })

    this.print(`Removed: ${current.filter((c) => !origins.includes(c)).join(', ')}.`)
    return {origins}
  }
}
