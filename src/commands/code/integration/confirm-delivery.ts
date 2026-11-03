import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class CodeIntegrationConfirmDelivery extends BaseCommand {
  static description = `Confirm that a test call through a code integration really reached the function

After \`code integration test\`, run this once you have seen the call arrive
(the function's log, its answer). It marks the integration as proven to work.`

  static examples = [
    '<%= config.bin %> code integration confirm-delivery 66b2f0a1c3d4e5f6a7b8c9d0',
    '<%= config.bin %> code integration confirm-delivery 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeIntegrationConfirmDelivery)
    const client = this.client(flags)

    const res = await client.hub.code.confirmCodeIntegrationHumanDelivery({integrationId: args.id})

    this.print(`Delivery confirmed for integration ${args.id}.`)
    return res
  }
}
