import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class EnvDelete extends BaseCommand {
  static description = 'Delete a non-PROD environment (cascades its integrations)'

  static examples = [
    '<%= config.bin %> env delete STAGING --yes',
    '<%= config.bin %> env delete STAGING --dry-run',
  ]

  static args = {
    name: Args.string({required: true, description: 'Environment name (PROD cannot be deleted)'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EnvDelete)
    const client = this.client(flags)

    await this.confirmOrFail(`Delete environment "${args.name}" and everything inside it?`, flags)

    const res = await client.hub.environments.delete({environmentName: args.name})
    this.print(`Environment ${args.name} deleted.`)
    return res
  }
}
