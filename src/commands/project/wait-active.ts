import {Flags} from '@oclif/core'

import {ProjectCommand} from '../../lib/project.js'

export default class ProjectWaitActive extends ProjectCommand {
  static description = `Wait until a new project is ready to use

A new project prepares its database in the background, so it is not active
the moment \`project create\` answers. Run this once before you build inside
it (schemas, modules, templates). The Hub waits for you, at most --timeout
seconds (default 30, at most 90). A timeout is not an error: the answer says
isActive false; run it again.`

  static examples = [
    '<%= config.bin %> project wait-active',
    '<%= config.bin %> project wait-active --project pr_8mpQ2LuS --timeout 90',
  ]

  static flags = {
    timeout: Flags.integer({description: 'Seconds to wait (1-90)', min: 1, max: 90}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ProjectWaitActive)
    const {client, projectId} = this.projectClient(flags)

    const res = await client.hub.account.waitForProjectActive({
      projectId,
      ...(flags.timeout === undefined ? {} : {timeoutSeconds: flags.timeout}),
    })

    this.print(res)
    return res
  }
}
