import {Args} from '@oclif/core'

import {ProjectCommand} from '../../lib/project.js'

export default class ProjectSetLanguages extends ProjectCommand {
  static description = `Set the languages the project supports

Pass the full list — it replaces the one stored. The default language must stay
in it (\`project set-default-language\`).`

  static examples = [
    '<%= config.bin %> project set-languages en lt de',
    '<%= config.bin %> project set-languages en lt de --dry-run',
  ]

  static strict = false

  static args = {
    language: Args.string({required: true, description: 'Language codes (one or more)'}),
  }

  static flags = {
    ...ProjectCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {argv, flags} = await this.parse(ProjectSetLanguages)
    const languages = argv as string[]
    const {client, projectId} = this.projectClient(flags)

    const res = await client.hub.account.updateProjectLanguages({projectId, languages})

    this.print(`Languages set to ${languages.join(', ')}.`)
    return res
  }
}
