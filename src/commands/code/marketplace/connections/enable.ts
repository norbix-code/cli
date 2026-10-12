import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'
import {usageError} from '../../../../lib/cli-error.js'
import {parseKeyValues} from '../../../../lib/marketplace.js'

export default class CodeMarketplaceConnectionsEnable extends BaseCommand {
  static description = `Enable a listing for the project (a new connection), or turn a connection back on

With --listing: creates a connection of that listing in the current environment and prints its new id (int_…). Config and secret values come from repeated --config key=value and --secret key=value; \`listings <id>\` shows the fields. A built-in Norbix listing fills its own integration (e.g. databaseIntegrationId) when the project has exactly one, and runs its validation at once. Add --id to save an existing connection again (an empty secret set keeps the stored secrets).

With a connection ID instead: turns that connection back on.`

  static examples = [
    '<%= config.bin %> code marketplace connections enable --listing ml_norbix_database_v1',
    '<%= config.bin %> code marketplace connections enable --listing ml_slack_v1 --name "Slack — support" --secret botToken=xoxb-… --config baseUrl=https://slack.com/api',
    '<%= config.bin %> code marketplace connections enable --listing ml_slack_v1 --id int_6rBACnEaxQ0x1jTiHtAuWV --config baseUrl=https://slack.com/api',
    '<%= config.bin %> code marketplace connections enable int_6rBACnEaxQ0x1jTiHtAuWV',
    '<%= config.bin %> code marketplace connections enable --listing ml_norbix_database_v1 --dry-run',
  ]

  static args = {
    id: Args.string({description: 'Connection ID (int_…) to turn back on; omit it with --listing'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    listing: Flags.string({description: 'Listing ID (ml_…) to enable as a new connection'}),
    name: Flags.string({description: 'Connection name; default: the listing name'}),
    config: Flags.string({description: 'A config value, key=value (repeat for more)', multiple: true}),
    secret: Flags.string({description: 'A secret value, key=value (repeat for more); never printed', multiple: true}),
    description: Flags.string({description: 'Free text shown with the connection'}),
    id: Flags.string({description: 'With --listing: the connection ID to save again instead of creating one'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeMarketplaceConnectionsEnable)
    if (Boolean(args.id) === Boolean(flags.listing)) {
      throw usageError(
        'Pass either --listing (a new connection) or a connection ID (turn it back on), not both and not neither.',
        'e.g. `code marketplace connections enable --listing ml_norbix_database_v1` or `code marketplace connections enable int_…`.',
      )
    }

    const client = this.client(flags)

    if (args.id) {
      const res = await client.hub.code.enableMarketplaceIntegration({integrationViewId: args.id})
      this.print(`Connection ${args.id} enabled.`)
      return res
    }

    const listingViewId = flags.listing as string
    let name = flags.name
    if (!name && !flags['dry-run']) {
      const found = await client.hub.code.getMarketplaceListing({listingViewId})
      name = found?.listing?.displayName
    }

    // The server takes transport, vendor and category from the listing and
    // mints the int_ id when viewId is empty; the cast leaves them out.
    const res = await client.hub.code.saveMarketplaceIntegration({
      integration: {
        viewId: flags.id,
        listingViewId,
        integrationName: name ?? listingViewId,
        description: flags.description,
        isEnabled: true,
        config: parseKeyValues(flags.config, 'config') ?? {},
      },
      secrets: parseKeyValues(flags.secret, 'secret') ?? {},
    } as unknown as Parameters<typeof client.hub.code.saveMarketplaceIntegration>[0])

    const id = res?.id ?? flags.id
    this.print(`Connection ${id} ${flags.id ? 'saved' : 'created'}.\nNext: norbix code marketplace connections validate ${id}`)
    return res
  }
}
