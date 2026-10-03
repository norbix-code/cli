import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class EmailSignatureDelete extends BaseCommand {
  static description = 'Delete an email signature'

  static examples = [
    '<%= config.bin %> email signature delete 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    '<%= config.bin %> email signature delete 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Signature ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailSignatureDelete)
    const client = this.client(flags)

    await this.confirmOrFail(`Delete email signature ${args.id}?`, flags)

    const res = await client.hub.notifications.deleteEmailSignature({id: args.id})

    this.print(`Signature ${args.id} deleted.`)
    return res
  }
}
