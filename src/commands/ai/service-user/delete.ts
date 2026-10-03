import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class AiServiceUserDelete extends BaseCommand {
  static description = 'Delete an AI service user; its keys stop working at once'

  static examples = [
    '<%= config.bin %> ai service-user delete 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    '<%= config.bin %> ai service-user delete 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Service user ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiServiceUserDelete)
    const client = this.client(flags, {requireProject: false})

    await this.confirmOrFail(`Delete AI service user ${args.id}? Its keys stop working.`, flags)

    const res = await client.hub.account.deleteAiServiceUser({id: args.id})

    this.print(`Service user ${args.id} deleted.`)
    return res
  }
}
