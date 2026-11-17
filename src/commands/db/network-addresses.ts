import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

interface RegionAddresses {
  regionCode?: string
  addresses?: string[]
}

export default class DbNetworkAddresses extends BaseCommand {
  static description = `List the IP addresses Norbix connects to databases from, per region

Add them to your MongoDB Atlas IP access list (Network Access) when you
connect your own database with a connection string. Without a region code
every region is listed. An empty list means this install does not publish them.`

  static examples = [
    '<%= config.bin %> db network-addresses',
    '<%= config.bin %> db network-addresses nb-eu-germany',
    '<%= config.bin %> db network-addresses --json',
  ]

  static args = {
    regionCode: Args.string({description: 'A Norbix region code, e.g. nb-eu-germany; left out: every region'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbNetworkAddresses)
    const client = this.client(flags, {requireProject: false})

    const res = await client.hub.database.getNetworkAddresses(args.regionCode ? {regionCode: args.regionCode} : {})

    const regions = ((res ?? {}) as {regions?: RegionAddresses[]}).regions ?? []
    this.print(
      regions.length === 0
        ? 'No regions.'
        : regions.map((r) => `${r.regionCode ?? '-'}: ${r.addresses?.length ? r.addresses.join(', ') : '(none listed)'}`).join('\n'),
    )
    return res
  }
}
