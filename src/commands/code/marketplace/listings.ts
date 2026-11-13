import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {MARKETPLACE_CATEGORIES, MARKETPLACE_KINDS, MARKETPLACE_TRANSPORTS} from '../../../lib/marketplace.js'

export default class CodeMarketplaceListings extends BaseCommand {
  static description = `Browse the marketplace: the connectors a project can enable

Without an ID: the catalog this host shows (Norbix Database, Norbix Web, Norbix AI, Slack, …), filtered by search text, tags, category or transport. --kind Workflow lists the curated workflows instead (beta): install one with code marketplace install-workflow. With a listing ID (ml_…): one listing in full — its install form (the config and secret fields \`connections enable\` takes), its validation steps, and the functions it offers with their keys, form kind, parameters and inputs (what \`functions add\` takes). With a listing ID and --tokens <function key>: the @Model.X tokens that function reads, before it is added to a connection.`

  static examples = [
    '<%= config.bin %> code marketplace listings',
    '<%= config.bin %> code marketplace listings --search slack --category Communication',
    '<%= config.bin %> code marketplace listings --tags database --tags official --json',
    '<%= config.bin %> code marketplace listings --kind Workflow',
    '<%= config.bin %> code marketplace listings ml_norbix_database_v1',
    '<%= config.bin %> code marketplace listings ml_norbix_database_v1 --tokens db.find',
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
    kind: Flags.string({description: 'Connector (the default) or Workflow', options: MARKETPLACE_KINDS}),
    'page-size': Flags.integer({description: 'Records per page'}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
    tokens: Flags.string({description: 'With a listing ID: list the tokens this function key reads'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeMarketplaceListings)
    if (flags.tokens && !args.id) this.error('--tokens needs a listing ID: code marketplace listings <ml_…> --tokens <function key>.')
    const client = this.client(flags)

    if (args.id && flags.tokens) {
      const tokens = await client.hub.code.getMarketplaceListingFunctionTokens({listingViewId: args.id, functionKey: flags.tokens})
      const list = (tokens as {tokens?: string[]}).tokens ?? []
      this.print(list.length ? list.join('\n') : `${flags.tokens} reads no tokens.`)
      return tokens
    }

    const res = args.id
      ? await client.hub.code.getMarketplaceListing({listingViewId: args.id})
      : await client.hub.code.getMarketplaceListings({
          search: flags.search,
          tags: flags.tags,
          categories: flags.category,
          transports: flags.transport,
          officialOnly: flags.official || undefined,
          kind: flags.kind,
          pageSize: flags['page-size'],
          startingAfter: flags.after,
        } as Parameters<typeof client.hub.code.getMarketplaceListings>[0])

    this.print(res)
    return res
  }
}
