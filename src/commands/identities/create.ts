import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class IdentitiesCreate extends BaseCommand {
  static description = `Create an execution identity

One call makes a service user in the environment and gives it roles. Prints the
new id; pass it to --execution-identity on a trigger or task save.`

  static examples = [
    '<%= config.bin %> identities create --name "Orders bot" --role Editor',
    '<%= config.bin %> identities create --name "Orders bot" --role Editor --role Mailer --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    name: Flags.string({required: true, description: 'Display name of the identity'}),
    role: Flags.string({multiple: true, description: 'Role id or role name to give (repeat for several)'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(IdentitiesCreate)
    const client = this.client(flags)

    const res = await client.hub.membership.createExecutionIdentity({name: flags.name, roleIds: flags.role ?? []})

    const id = (res as {id?: string} | undefined)?.id
    this.print(id ? `Identity ${id} created.` : 'Identity created.')
    return res
  }
}
