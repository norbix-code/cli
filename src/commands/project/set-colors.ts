import {Flags} from '@oclif/core'

import {ProjectCommand} from '../../lib/project.js'

export default class ProjectSetColors extends ProjectCommand {
  static description = `Set the project brand colours

The main colour and the accent colour are separate settings; pass one or both.
Colours are hex values such as #1F6FEB.`

  static examples = [
    '<%= config.bin %> project set-colors --main "#1F6FEB" --accent "#F78166"',
    '<%= config.bin %> project set-colors --accent "#F78166"',
  ]

  static flags = {
    main: Flags.string({description: 'Main brand colour (hex)'}),
    accent: Flags.string({description: 'Accent colour (hex)'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ProjectSetColors)
    if (!flags.main && !flags.accent) this.error('Pass --main, --accent or both.')
    const {client, projectId} = this.projectClient(flags)

    const res: Record<string, unknown> = {}
    if (flags.main) {
      res.main = await client.hub.account.updateProjectMainColor({projectId, color: flags.main})
      this.print(`Main colour set to ${flags.main}.`)
    }

    if (flags.accent) {
      res.accent = await client.hub.account.updateProjectAccentColor({projectId, color: flags.accent})
      this.print(`Accent colour set to ${flags.accent}.`)
    }

    return res
  }
}
