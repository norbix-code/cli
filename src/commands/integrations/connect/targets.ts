import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class IntegrationsConnectTargets extends BaseCommand {
  static description = `List the accounts a quick connect may finish with

Once the person approved on the provider's page, this lists the accounts
(profiles, shops) the provider offered for the connect id — pick one and finish
with \`norbix payments integration connect complete <connectId> --target <id>\`.`

  static examples = ['<%= config.bin %> integrations connect targets qc_1']

  static args = {
    connectId: Args.string({required: true, description: 'The connect id `connect start` printed'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(IntegrationsConnectTargets)
    const client = this.client(flags)

    const res = await client.hub.integrations.getIntegrationConnectTargets({connectId: args.connectId})

    this.print(res)
    return res
  }
}
