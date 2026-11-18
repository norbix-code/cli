import {BaseCommand} from '../../../base.js'

export default class DbIntegrationsFlexTiers extends BaseCommand {
  static description = `List the Norbix-managed database tiers this account may pick

Each tier has a code and a display name; the list is the platform's
configuration. Only the Norbix managed service answers it: a self-hosted
install refuses the call.`

  static examples = ['<%= config.bin %> db integrations flex-tiers', '<%= config.bin %> db integrations flex-tiers --json']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(DbIntegrationsFlexTiers)
    const client = this.client(flags)

    const res = await client.hub.database.getAllowedFlexTiers({})

    this.print(res)
    return res
  }
}
