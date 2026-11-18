import {ProjectCommand} from '../../../lib/project.js'

export default class ProjectAuthExpose extends ProjectCommand {
  static description = `Show the sign-in methods and password policy to the public (off by default)

The public project config (\`project public-config\`) then lists the
sign-in methods (email / phone / username) and the password policy, so a
sign-in page can build itself before anyone signs in.`

  static examples = [
    '<%= config.bin %> project auth expose',
    '<%= config.bin %> project auth expose --dry-run',
  ]

  static flags = {
    ...ProjectCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ProjectAuthExpose)
    const {client, projectId} = this.projectClient(flags)

    const res = await client.hub.account.updateProjectExposeAuth({projectId, exposed: true})

    this.print('The sign-in methods are public.')
    return res
  }
}
