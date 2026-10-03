import {confirm} from '@inquirer/prompts'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class AiServiceUserRevokeKey extends BaseCommand {
  static description = 'Revoke one API key of an AI service user; it stops working at once'

  static examples = ['<%= config.bin %> ai service-user revoke-key 66b2f0a1... key_123 --yes']

  static args = {
    id: Args.string({required: true, description: 'Service user ID'}),
    keyId: Args.string({required: true, description: 'Key ID (see `ai service-users`)'}),
  }

  static flags = {
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt', default: false}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiServiceUserRevokeKey)
    const client = this.client(flags, {requireProject: false})

    if (!flags.yes && process.stdout.isTTY) {
      const ok = await confirm({message: `Revoke key ${args.keyId}? It stops working at once.`, default: false})
      if (!ok) return this.print('Cancelled.')
    }

    const res = await client.hub.account.revokeAiServiceUserKey({id: args.id, keyId: args.keyId})

    this.print(`Key ${args.keyId} revoked.`)
    return res
  }
}
