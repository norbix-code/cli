import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {MARKETPLACE_CATEGORIES, MARKETPLACE_TRANSPORTS} from '../../../lib/marketplace.js'

export default class CodeMarketplaceListings extends BaseCommand {
  static description = `Browse the marketplace: the connectors a project can enable

Without an ID: the catalog this host shows (Norbix Database, Norbix Web, Norbix AI, Slack, …), filtered by search text, tags, category or transport. With a listing ID (ml_…): one listing in full — its install form (the config and secret fields \`connections enable\` takes), its validation steps, and the functions it offers with their keys, form kind, parameters and inputs (what \`functions add\` takes).`

  static examples = [
    '<%= config.bin %> code marketplace listings',
    '<%= config.bin %> code marketplace listings --search slack --category Communication',
    '<%= config.bin %> code marketplace listings --tags database --tags official --json',
    '<%= config.bin %> code marketplace listings ml_norbix_database_v1',
  ]

  static args = {
    id: Args.string({description: 'Listing ID (ml_…): show this one listing in full'}),
  }

  static flags = {
    search: Flags.string({description: 'Text to look for in the name, vendor and description'}),
    tags: Flags.string({description: 'Only listings with this tag (repeat for more)', multiple: true}),
    category: Flags.string({description: 'Only this category (repeat for more)', multiple: true, options: MARKETPLACE_CATEGORIES}),
    transport: Flags.string({description: 'Only this transport (repeat for more)', multiple: true, options: MARKETPLACE_TRANSPORTS}),
    official: Flags.boolean({description: 'Only listings made by Norbix or the vendor itself'}),
    'page-size': Flags.integer({description: 'Records per page'}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeMarketplaceListings)
    const client = this.client(flags)

    const res = args.id
      ? await client.hub.code.getMarketplaceListing({listingViewId: args.id})
      : await client.hub.code.getMarketplaceListings({
          search: flags.search,
          tags: flags.tags,
          categories: flags.category,
          transports: flags.transport,
          officialOnly: flags.official || undefined,
          pageSize: flags['page-size'],
          startingAfter: flags.after,
        } as Parameters<typeof client.hub.code.getMarketplaceListings>[0])

    this.print(res)
    return res
  }
}
