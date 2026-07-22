import {confirm} from '@inquirer/prompts'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {integrationFlag, resolveIntegration} from '../../lib/files.js'

export default class FilesDelete extends BaseCommand {
  static description = 'Delete one file'

  static examples = ['<%= config.bin %> files delete invoices/2026/invoice.pdf --yes']

  static args = {
    remote: Args.string({required: true, description: 'Remote file path'}),
  }

  static flags = {
    integration: integrationFlag,
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt', default: false}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(FilesDelete)
    const client = this.client(flags)
    const integration = resolveIntegration(flags.integration, this.resolveContext(flags).filesIntegrationId)
    if (!integration) {
      this.error('No files integration ID. Pass --integration or run `norbix config set filesIntegrationId <id>`.')
    }

    if (!flags.yes && process.stdout.isTTY) {
      const ok = await confirm({message: `Delete file "${args.remote}"?`, default: false})
      if (!ok) return this.print('Cancelled.')
    }

    const res = await client.api.files.deleteFileApi({
      filesIntegrationId: integration,
      path: args.remote,
    })

    this.print(`Deleted ${args.remote}.`)
    return res
  }
}
