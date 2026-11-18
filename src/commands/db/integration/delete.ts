import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class DbIntegrationDelete extends BaseCommand {
  static description = `Delete a database integration

It removes the integration of the request environment (--env). For your own
database (a connection string) Norbix forgets the connection and its stored
secret; the database is not touched. For a Norbix-managed database the
database of that environment is DROPPED with every record in it (and the
cluster too when no other database is left on it).

The default integration of an environment is refused while another
integration exists there: make that one the default first
(\`db integration default\`). Deleting the last one leaves the environment
with no database.`

  static examples = [
    '<%= config.bin %> db integration delete 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    '<%= config.bin %> db integration delete 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbIntegrationDelete)
    const client = this.client(flags)

    await this.confirmOrFail(`Delete database integration ${args.id}? A Norbix-managed database is dropped with its records.`, flags)
    // The route token is `{Id}`; the SDK fills it from `id` (the lookup is
    // case-insensitive), so the generated field is enough.
    const res = await client.hub.database.deleteDatabaseIntegration({id: args.id})

    this.print(`Integration ${args.id} deleted.`)
    return res
  }
}
