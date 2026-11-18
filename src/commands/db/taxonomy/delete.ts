import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class DbTaxonomyDelete extends BaseCommand {
  static description = `Delete a database taxonomy

Only the taxonomy goes: the gateway does not check whether a schema field or
another taxonomy (as parent or dependency) still uses it, and it does not
remove the terms stored in the database. Delete the terms first with
\`db term delete-many <id> --all\` if they should go too.`

  static examples = [
    '<%= config.bin %> db taxonomy delete txn_1 --yes',
    '<%= config.bin %> db taxonomy delete txn_1 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Taxonomy ID (txn_…)'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbTaxonomyDelete)
    const client = this.client(flags)

    await this.confirmOrFail(`Delete taxonomy ${args.id}?`, flags)

    const res = await client.hub.database.deleteDatabaseTaxonomy({id: args.id})

    this.print(`Taxonomy ${args.id} deleted.`)
    return res
  }
}
