import {Args, Flags} from '@oclif/core'

import {ProjectCommand} from '../../../lib/project.js'

export default class ProjectCorsSet extends ProjectCommand {
  static description = `Replace the allowed origins with this list

Every origin not in the list stops being allowed. An origin with no scheme
(example.com) means https. To change one origin, use \`project cors add\` or
\`project cors remove\` instead.`

  static examples = [
    '<%= config.bin %> project cors set https://app.example.com https://example.com',
    '<%= config.bin %> project cors set https://app.example.com --remove-admin-portal-origin',
    '<%= config.bin %> project cors set https://app.example.com https://example.com --dry-run',
  ]

  static strict = false

  static args = {
    origin: Args.string({required: true, description: 'Allowed origins (one or more)'}),
  }

  static flags = {
    ...ProjectCommand.dryRunFlags,
    'remove-admin-portal-origin': Flags.boolean({
      description: "Allow the list to drop the project's own admin portal origin",
      default: false,
    }),
  }

  async run(): Promise<unknown> {
    const {argv, flags} = await this.parse(ProjectCorsSet)
    const origins = argv as string[]
    const {client, projectId} = this.projectClient(flags)

    const res = await client.hub.account.updateProjectAllowedOrigins({
      projectId,
      origins,
      removeAdminPortalOrigin: flags['remove-admin-portal-origin'] || undefined,
    })

    this.print(`Allowed origins: ${origins.join(', ')}.`)
    return res
  }
}
