import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {databaseIntegrationFlag} from '../../lib/database.js'

export default class DbChangeOwner extends BaseCommand {
  static description = `Hand a record to another user

The record's owner (the responsible user) decides who may read or change it
under "own" permissions.`

  static examples = [
    '<%= config.bin %> db change-owner orders 66b2f0a1c3d4e5f6a7b8c9d0 --user 66b2f0a1c3d4e5f6a7b8c9d1',
    '<%= config.bin %> db change-owner orders 66b2f0a1c3d4e5f6a7b8c9d0 --user 66b2f0a1c3d4e5f6a7b8c9d1 --dry-run',
  ]

  static args = {
    collection: Args.string({required: true, description: 'Collection name'}),
    id: Args.string({required: true, description: 'Record ID'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    ...databaseIntegrationFlag,
    user: Flags.string({char: 'u', required: true, description: 'ID of the user who becomes the owner'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbChangeOwner)
    const client = this.client(flags)

    const res = await client.api.database.changeResponsibility({
      collectionName: args.collection,
      id: args.id,
      databaseIntegrationId: flags.integration,
      newResponsibleUserId: flags.user,
    })

    this.print(`Record ${args.id} in "${args.collection}" now belongs to user ${flags.user}.`)
    return res
  }
}
