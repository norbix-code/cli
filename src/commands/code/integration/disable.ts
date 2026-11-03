import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class CodeIntegrationDisable extends BaseCommand {
  static description = 'Turn a code integration off'

  static examples = [
    '<%= config.bin %> code integration disable 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    '<%= config.bin %> code integration disable 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Integration ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeIntegrationDisable)
    const client = this.client(flags)
    await this.confirmOrFail(`Turn off code integration ${args.id}?`, flags)

    // The route token is `{Id}`; the SDK fills it from `id` (the lookup is
    // case-insensitive), so the generated field is enough.
    const res = await client.hub.code.disableCodeIntegration({id: args.id})

    this.print(`Integration ${args.id} disabled.`)
    return res
  }
}
