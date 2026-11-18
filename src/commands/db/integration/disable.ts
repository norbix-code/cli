import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class DbIntegrationDisable extends BaseCommand {
  static description = `Turn a database integration off

It turns off the integration of the request environment (--env). A default
integration cannot be turned off while another integration exists in that
environment — make that one the default first (\`db integration default\`).`

  static examples = [
    '<%= config.bin %> db integration disable 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    '<%= config.bin %> db integration disable 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbIntegrationDisable)
    const client = this.client(flags)

    await this.confirmOrFail(`Turn off database integration ${args.id}?`, flags)
    // The route token is `{Id}`; the SDK fills it from `id` (the lookup is
    // case-insensitive), so the generated field is enough.
    const res = await client.hub.database.disableDatabaseIntegration({id: args.id})

    this.print(`Integration ${args.id} disabled.`)
    return res
  }
}
