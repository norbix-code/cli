import {ProjectCommand} from '../../../lib/project.js'

export default class ProjectAuthHide extends ProjectCommand {
  static description = `Hide the sign-in methods and password policy from the public

The public project config stops listing them (the default).`

  static examples = [
    '<%= config.bin %> project auth hide',
    '<%= config.bin %> project auth hide --dry-run',
  ]

  static flags = {
    ...ProjectCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ProjectAuthHide)
    const {client, projectId} = this.projectClient(flags)

    const res = await client.hub.account.updateProjectExposeAuth({projectId, exposed: false})

    this.print('The sign-in methods are hidden from the public.')
    return res
  }
}
