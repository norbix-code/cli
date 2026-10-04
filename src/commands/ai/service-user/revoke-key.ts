import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class AiServiceUserRevokeKey extends BaseCommand {
  static description = 'Revoke one API key of an AI service user; it stops working at once'

  static examples = [
    '<%= config.bin %> ai service-user revoke-key 66b2f0a1c3d4e5f6a7b8c9d0 key_123 --yes',
    '<%= config.bin %> ai service-user revoke-key 66b2f0a1c3d4e5f6a7b8c9d0 key_123 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Service user ID'}),
    keyId: Args.string({required: true, description: 'Key ID (see `ai service-users`)'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiServiceUserRevokeKey)
    const client = this.client(flags, {requireProject: false})

    await this.confirmOrFail(`Revoke key ${args.keyId}? It stops working at once.`, flags)

    const res = await client.hub.account.revokeAiServiceUserKey({id: args.id, keyId: args.keyId})

    this.print(`Key ${args.keyId} revoked.`)
    return res
  }
}
