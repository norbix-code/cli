import {Args, Flags} from '@oclif/core'

import {ProjectCommand} from '../../lib/project.js'

export default class ProjectCheckLanguages extends ProjectCommand {
  static description = `List the templates that miss a project language

Checks the active e-mail, push and SMS templates against a language list
before you save it with \`project set-languages\` (or \`project
set-default-language\`). Give the proposed languages and / or --default; give
neither to check the current settings. Changes nothing.`

  static examples = [
    '<%= config.bin %> project check-languages',
    '<%= config.bin %> project check-languages en lt de',
    '<%= config.bin %> project check-languages en lt --default lt --json',
  ]

  static strict = false

  static args = {
    languages: Args.string({description: 'Proposed complete language list (codes, e.g. en lt)'}),
  }

  static flags = {
    default: Flags.string({description: 'Proposed default language code'}),
  }

  async run(): Promise<unknown> {
    const {argv, flags} = await this.parse(ProjectCheckLanguages)
    const languages = (argv as string[]).flatMap((l) => l.split(',')).map((l) => l.trim()).filter(Boolean)
    const {client, projectId} = this.projectClient(flags)

    const res = await client.hub.account.checkProjectLanguages({
      projectId,
      ...(languages.length > 0 ? {languages} : {}),
      ...(flags.default ? {defaultLanguage: flags.default} : {}),
    })

    this.print(res)
    return res
  }
}
