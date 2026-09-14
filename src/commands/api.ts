import {NamespaceCommand} from '../lib/namespace-command.js'

export default class ApiNs extends NamespaceCommand {
  protected readonly target = 'api' as const

  static description = `Call any data-plane API endpoint with plain words.

Grammar: norbix api <module> <words...> [id] [--field value]
Same engine as \`norbix hub\` — see \`norbix hub --help\`. For raw HTTP paths
use \`norbix raw\`.`

  static strict = false

  static examples = [
    '<%= config.bin %> api                          # list modules',
    '<%= config.bin %> api database                 # list database methods',
    '<%= config.bin %> api database find --collectionName orders --pageSize 20',
    '<%= config.bin %> api membership users get',
  ]

  async run(): Promise<unknown> {
    const {flagArgv, rest, help} = this.splitArgv()
    const {flags} = await this.parse(ApiNs, flagArgv)
    return this.dispatch(rest, flags, help)
  }
}
