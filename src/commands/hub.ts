import {NamespaceCommand} from '../lib/namespace-command.js'

export default class Hub extends NamespaceCommand {
  protected readonly target = 'hub' as const

  static description = `Call any Hub endpoint with plain words.

Grammar: norbix hub <module> <words...> [id] [--field value]
The method is resolved from the words — plural means "list", singular (or a
positional id) means one item. Destructive verbs ask for confirmation
(skip with --yes). Add --dry-run to see what would be called.`

  static strict = false

  static examples = [
    '<%= config.bin %> hub                              # list modules',
    '<%= config.bin %> hub database                     # list database methods',
    '<%= config.bin %> hub database aggregates get',
    '<%= config.bin %> hub database aggregates delete maggr_123 --schemaId sch_456',
    '<%= config.bin %> hub scheduler tasks get --pageSize 100',
    '<%= config.bin %> hub logs get --level Error',
  ]

  async run(): Promise<unknown> {
    const {flagArgv, rest, help} = this.splitArgv()
    const {flags} = await this.parse(Hub, flagArgv)
    return this.dispatch(rest, flags, help)
  }
}
