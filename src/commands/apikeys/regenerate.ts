import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class ApikeysRegenerate extends BaseCommand {
  static description = `Replace one API key of a service user: a new key is issued and the old one stops working

The new key is shown once — store it now. Everything that still uses the old
key loses access at once. Key ids come from \`norbix apikeys list\`.`

  static examples = [
    '<%= config.bin %> apikeys regenerate aisu_66b2f0a1c3d4 aisk_1a2b3c --yes',
    '<%= config.bin %> apikeys regenerate aisu_66b2f0a1c3d4 aisk_1a2b3c --dry-run',
  ]

  static args = {
    serviceUserId: Args.string({required: true, description: 'Service user ID (aisu_…)'}),
    keyId: Args.string({required: true, description: 'The key to replace (aisk_…)'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(ApikeysRegenerate)
    const client = this.client(flags, {requireProject: false})

    await this.confirmOrFail(`Replace key ${args.keyId}? Every service using it loses access.`, flags)

    const res = await client.hub.account.rotateAiServiceUserKey({id: args.serviceUserId, revokeKeyId: args.keyId})
    this.print(res)
    return res
  }
}
