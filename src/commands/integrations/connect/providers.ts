import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class IntegrationsConnectProviders extends BaseCommand {
  static description = `List the providers that can quick-connect (one-click OAuth) on this install

For each provider: the module, whether it is available here, the inputs to ask
for before its page opens (e.g. storeUrl), its modes (test / live) and the
redirect URL Norbix registered. Read it before \`payments integration connect
start\`. The same list is in GET /echo → connect.`

  static examples = [
    '<%= config.bin %> integrations connect providers',
    '<%= config.bin %> integrations connect providers --module payments',
  ]

  static flags = {
    module: Flags.string({description: 'Only this module, e.g. payments (default: every module)'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(IntegrationsConnectProviders)
    const client = this.client(flags)

    const res = await client.hub.integrations.getQuickConnectProviders(flags.module === undefined ? {} : {module: flags.module})

    this.print(res)
    return res
  }
}
