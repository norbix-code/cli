import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {listOf} from '../../../lib/membership.js'

export default class UsersRolesCreate extends BaseCommand {
  static description = `Create a role

Policy IDs come from \`norbix users policies\`; never guess them from a policy name.`

  static examples = [
    '<%= config.bin %> users roles create --name Editor --description "Can edit orders" --policy pol_3kJ9xJ2mQ0aB',
    '<%= config.bin %> users roles create --name Viewer --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    name: Flags.string({required: true, description: 'Role name, unique in the project'}),
    description: Flags.string({description: 'What the role is for'}),
    policy: Flags.string({description: 'Policy ID to attach (repeat for several, or a comma list)', multiple: true}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(UsersRolesCreate)
    const policies = listOf(flags.policy)
    const client = this.client(flags)

    const res = await client.hub.membership.createRole({
      roleName: flags.name,
      ...(flags.description ? {description: flags.description} : {}),
      ...(policies ? {policies} : {}),
    })
    const id = (res as {id?: string} | undefined)?.id
    this.print(id ? `Role ${flags.name} created (${id}).` : `Role ${flags.name} created.`)
    return res
  }
}
