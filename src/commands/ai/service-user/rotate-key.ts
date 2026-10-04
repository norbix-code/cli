import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class AiServiceUserRotateKey extends BaseCommand {
  static description = `Issue a new API key for an AI service user

The new key is shown once — store it now. The old keys keep working until you
revoke them; --revoke <keyId> revokes one in the same call.`

  static examples = [
    '<%= config.bin %> ai service-user rotate-key 66b2f0a1c3d4e5f6a7b8c9d0',
    '<%= config.bin %> ai service-user rotate-key 66b2f0a1c3d4e5f6a7b8c9d0 --revoke key_123',
    '<%= config.bin %> ai service-user rotate-key 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Service user ID'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    revoke: Flags.string({description: 'Key ID to revoke at the same time'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiServiceUserRotateKey)
    const client = this.client(flags, {requireProject: false})

    const res = await client.hub.account.rotateAiServiceUserKey({id: args.id, revokeKeyId: flags.revoke})

    this.print(res)
    return res
  }
}
