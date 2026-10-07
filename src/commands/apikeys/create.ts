import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class ApikeysCreate extends BaseCommand {
  static description = `Create a new API key for a service user

The key is shown once — store it now (a secret store, NORBIX_API_KEY, or
\`norbix login --api-key <key> --profile ci\`). The service user's other keys
keep working. Find service user ids with \`norbix ai service-users\`.`

  static examples = [
    '<%= config.bin %> apikeys create aisu_66b2f0a1c3d4',
    '<%= config.bin %> apikeys create aisu_66b2f0a1c3d4 --dry-run',
  ]

  static args = {
    serviceUserId: Args.string({required: true, description: 'Service user ID (aisu_…)'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(ApikeysCreate)
    const client = this.client(flags, {requireProject: false})

    const res = await client.hub.account.rotateAiServiceUserKey({id: args.serviceUserId})

    this.print(res)
    return res
  }
}
