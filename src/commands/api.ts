import {Flags} from '@oclif/core'

import {BaseCommand} from '../base.js'
import {NamespaceCommand} from '../lib/namespace-command.js'

export default class ApiNs extends NamespaceCommand {
  protected readonly target = 'api' as const

  static description = `Call any data-plane API endpoint with plain words.

Grammar: norbix api <module> <words...> [id] [--field value | --body '<json>']
Same engine as \`norbix hub\` — see \`norbix hub --help\`. For raw HTTP paths
use \`norbix raw\`.`

  static strict = false

  static flags = {
    ...BaseCommand.mutatingFlags,
    body: Flags.string({
      description: 'The whole request as a JSON object (or `-` for stdin); cannot be mixed with --field flags',
    }),
  }

  static examples = [
    '<%= config.bin %> api                          # list modules',
    '<%= config.bin %> api database                 # list database methods',
    '<%= config.bin %> api database find --collectionName orders --pageSize 20',
    '<%= config.bin %> api membership users get',
    '<%= config.bin %> api membership user delete 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
    '<%= config.bin %> api membership user delete 66b2f0a1c3d4e5f6a7b8c9d0 --yes --json',
    `<%= config.bin %> api database insert --body '{"collectionName":"orders","document":"{\\"status\\":\\"new\\"}"}'`,
  ]

  async run(): Promise<unknown> {
    const {flagArgv, rest, help} = this.splitArgv()
    const {flags} = await this.parse(ApiNs, flagArgv)
    return this.dispatch(rest, flags, help)
  }
}
