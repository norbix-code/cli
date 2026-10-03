import {ProjectCommand} from '../../lib/project.js'

export default class ProjectEnable extends ProjectCommand {
  static description = 'Turn a disabled project back on'

  static examples = [
    '<%= config.bin %> project enable',
    '<%= config.bin %> project enable --dry-run',
  ]

  static flags = {
    ...ProjectCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ProjectEnable)
    const {client, projectId} = this.projectClient(flags)

    const res = await client.hub.account.enableProject({projectId})

    this.print(`Project ${projectId} enabled.`)
    return res
  }
}
