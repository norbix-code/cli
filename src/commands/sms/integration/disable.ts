import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class SmsIntegrationDisable extends BaseCommand {
  static description = 'Turn an SMS integration off'

  static examples = [
    '<%= config.bin %> sms integration disable 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    '<%= config.bin %> sms integration disable 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(SmsIntegrationDisable)
    const client = this.client(flags)
    await this.confirmOrFail(`Turn off SMS integration ${args.id}?`, flags)

    // The route token is `{Id}`; the SDK (4.2.0) fills it from `id` — the
    // lookup is case-insensitive — so the generated field is enough.
    const res = await client.hub.notifications.disableSmsIntegration({id: args.id})

    this.print(`Integration ${args.id} disabled.`)
    return res
  }
}
