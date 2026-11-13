import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {usageError} from '../../../lib/cli-error.js'

export default class UsersApiKeysDelete extends BaseCommand {
  static description = `Delete one API key of a project service user; it stops working at once

Key IDs come from \`norbix users api-keys <id>\`.`

  static examples = [
    '<%= config.bin %> users api-keys delete usr_66b2f0a1c3d4 3 --yes',
    '<%= config.bin %> users api-keys delete usr_66b2f0a1c3d4 3 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Service user login ID (usr_…)'}),
    keyId: Args.string({required: true, description: 'Key ID (a number)'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersApiKeysDelete)
    const keyId = Number(args.keyId)
    if (!Number.isInteger(keyId) || keyId < 0) throw usageError(`Key ID must be a number, got "${args.keyId}".`, 'See the IDs with: norbix users api-keys <id>')
    const client = this.client(flags)
    await this.confirmOrFail(`Delete key ${keyId} of ${args.id}? Everything that uses it loses access at once.`, flags)

    const res = await client.hub.membership.deleteServiceUserApiKey({id: args.id, keyId})
    this.print(`Key ${keyId} deleted.`)
    return res
  }
}
