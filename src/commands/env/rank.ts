import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {usageError} from '../../lib/cli-error.js'

export default class EnvRank extends BaseCommand {
  static description = `Move an environment on the promotion ladder

The ladder orders the environments from the lowest (where changes start) up
to PROD; \`env promote\` copies only upward. \`env list\` shows the order
(promotionOrder). A rank out of range is clamped, and the Hub numbers the
ranks again. PROD's rank is fixed.`

  static examples = [
    '<%= config.bin %> env rank STAGING 2',
    '<%= config.bin %> env rank TEST 1 --dry-run',
  ]

  static args = {
    name: Args.string({required: true, description: 'Environment name'}),
    rank: Args.string({required: true, description: 'New rank (a whole number)'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EnvRank)
    const rank = Number(args.rank)
    if (!Number.isInteger(rank)) throw usageError(`The rank must be a whole number, not "${args.rank}".`)
    const name = args.name.trim().toUpperCase()

    const client = this.client(flags)
    const res = await client.hub.account.setEnvironmentRank({environmentName: name, rank})
    // The promotion order changed: read the list again next time.
    if (!flags['dry-run']) this.forgetEnvs(this.resolveContext(flags))
    this.print(`Environment ${name} moved to rank ${rank}.`)
    return res
  }
}
