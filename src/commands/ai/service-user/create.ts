import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class AiServiceUserCreate extends BaseCommand {
  static description = `Create an AI service user and print its first API key

The key is shown once — store it now. What the user may do comes from roles:
--account-role gives it an account team role (whole account); --project-role
gives it a role of the configured project (or --project). Repeat either flag
for several roles; at least one is needed.`

  static examples = [
    '<%= config.bin %> ai service-user create --name "Claude Code on my laptop" --project-role rl_reader',
    '<%= config.bin %> ai service-user create --name ci-bot --account-role rl_admin --project-role rl_writer --project pr_123',
    '<%= config.bin %> ai service-user create --name "Claude Code on my laptop" --project-role rl_reader --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    name: Flags.string({required: true, description: 'A name people recognise'}),
    'account-role': Flags.string({description: 'Account team role id it gets (repeat for several)', multiple: true}),
    'project-role': Flags.string({description: 'Role id of the configured project it gets (repeat for several)', multiple: true}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(AiServiceUserCreate)
    const accountRoleIds = flags['account-role'] ?? []
    const projectRoleIds = flags['project-role'] ?? []
    if (accountRoleIds.length === 0 && projectRoleIds.length === 0) {
      this.error('Give the user at least one role: --account-role <id> and/or --project-role <id>.')
    }

    const projectId = projectRoleIds.length > 0 ? this.resolveContext(flags).projectId : undefined
    if (projectRoleIds.length > 0 && !projectId) {
      this.error('--project-role needs a project. Pass --project, or run `norbix configure`.')
    }

    const client = this.client(flags, {requireProject: false})

    const res = await client.hub.account.createAiServiceUser({
      name: flags.name,
      ...(accountRoleIds.length > 0 ? {accountRoleIds} : {}),
      ...(projectId ? {projectRoles: [{projectId, roleIds: projectRoleIds}]} : {}),
    })

    this.print(res)
    return res
  }
}
