import {Args} from '@oclif/core'

import {ProjectCommand, originsOf, sameOrigin} from '../../../lib/project.js'

export default class ProjectCorsAdd extends ProjectCommand {
  static description = `Allow one or more origins, keeping the ones already allowed

The server stores the full list, so this reads the current origins first and
writes them back with the new ones.`

  static examples = ['<%= config.bin %> project cors add https://staging.example.com']

  static strict = false

  static args = {
    origin: Args.string({required: true, description: 'Origins to allow (one or more)'}),
  }

  async run(): Promise<unknown> {
    const {argv, flags} = await this.parse(ProjectCorsAdd)
    const wanted = argv as string[]
    const {client, projectId} = this.projectClient(flags)

    const current = originsOf(await client.hub.account.getProject({projectId}))
    const added = wanted.filter((o) => !current.some((c) => sameOrigin(c, o)))
    if (added.length === 0) {
      this.print('Already allowed — nothing to change.')
      return {origins: current}
    }

    const origins = [...current, ...added]
    await client.hub.account.updateProjectAllowedOrigins({projectId, origins})

    this.print(`Allowed: ${added.join(', ')}.`)
    return {origins}
  }
}
