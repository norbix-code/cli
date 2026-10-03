import {Flags} from '@oclif/core'

import {ProjectCommand} from '../../lib/project.js'

export default class ProjectTokens extends ProjectCommand {
  static description = `List the template tokens the project offers

These are the @Model values an e-mail, SMS or push template can use. Pass user
ids to see the tokens filled in for those users.`

  static examples = [
    '<%= config.bin %> project tokens',
    '<%= config.bin %> project tokens --recipient 66b2f0a1c3d4e5f6a7b8c9d0',
  ]

  static flags = {
    initiator: Flags.string({description: 'User who started the action'}),
    recipient: Flags.string({description: 'User who receives the message'}),
    'target-user': Flags.string({description: 'User the action is about'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ProjectTokens)
    const {client, projectId} = this.projectClient(flags)

    const res = await client.hub.account.getProjectTokens({
      projectId,
      initiatorId: flags.initiator,
      recipientId: flags.recipient,
      targetUserId: flags['target-user'],
    })

    this.print(res)
    return res
  }
}
