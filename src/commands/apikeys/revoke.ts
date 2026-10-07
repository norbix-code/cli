import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class ApikeysRevoke extends BaseCommand {
  static description = `Revoke one API key of a service user; it stops working at once

Key ids come from \`norbix apikeys list\`.`

  static examples = [
    '<%= config.bin %> apikeys revoke aisu_66b2f0a1c3d4 aisk_1a2b3c --yes',
    '<%= config.bin %> apikeys revoke aisu_66b2f0a1c3d4 aisk_1a2b3c --dry-run',
  ]

  static args = {
    serviceUserId: Args.string({required: true, description: 'Service user ID (aisu_…)'}),
    keyId: Args.string({required: true, description: 'The key to revoke (aisk_…)'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(ApikeysRevoke)
    const client = this.client(flags, {requireProject: false})

    await this.confirmOrFail(`Revoke key ${args.keyId}? It stops working at once.`, flags)

    const res = await client.hub.account.revokeAiServiceUserKey({id: args.serviceUserId, keyId: args.keyId})
    this.print(`Key ${args.keyId} revoked.`)
    return res
  }
}
