import {Flags} from '@oclif/core'

import {BaseCommand} from '../base.js'
import {NamespaceCommand} from '../lib/namespace-command.js'

export default class Hub extends NamespaceCommand {
  protected readonly target = 'hub' as const

  static description = `Call any Hub endpoint with plain words.

Grammar: norbix hub <module> <words...> [id] [--field value | --body '<json>']
The method is resolved from the words — plural means "list", singular (or a
positional id) means one item.

Four kinds of call ask first: a call that changes what the account pays
(bundle change, cluster upgrade, Stripe checkout, AI credit checkout); every
delete (any endpoint sent with the HTTP verb DELETE, whatever its name:
discard, cancel, revoke, forget, clear; plus logs clean and a passkey
revoke); a method whose first word is delete, remove, clean, stop,
disable, block, regenerate or rotate; and a method the CLI cannot classify
(it does not know what kind of request the method sends). In a terminal you answer y/N; without
one (a script, CI, --json) the command exits 3 and sends nothing unless you
pass --yes. Check first, then apply: --dry-run shows the exact request (it
resolves auth, region and project but sends nothing, so the server does
not check the values, and it never asks), then run it again with --yes. One exception: \`database schema bundle apply
--dry-run\` also sends the bundleJson to the Hub's read-only schema check
(account.validateSchema) and prints its issues; an invalid bundle exits 6.
Field values are typed from the SDK's request type; force one with
--field:str / :num / :bool / :json, or pass the whole request with --body.
\`norbix hub <module> --help\` lists every method with its fields.`

  static strict = false

  static flags = {
    ...BaseCommand.mutatingFlags,
    body: Flags.string({
      description: 'The whole request as a JSON object (or `-` for stdin); cannot be mixed with --field flags',
    }),
  }

  static examples = [
    '<%= config.bin %> hub                              # list modules',
    '<%= config.bin %> hub database                     # list database methods',
    '<%= config.bin %> hub database aggregates get',
    '<%= config.bin %> hub database aggregates delete maggr_123 --schemaId sch_456',
    '<%= config.bin %> hub scheduler tasks get --pageSize 100',
    '<%= config.bin %> hub logs get --level Error',
    '<%= config.bin %> hub scheduler task delete 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
    '<%= config.bin %> hub scheduler task delete 66b2f0a1c3d4e5f6a7b8c9d0 --yes --json',
    '<%= config.bin %> hub account changeManagedServiceBundle --bundle Growth --billingPeriod Annual --dry-run   # billing: preview',
    '<%= config.bin %> hub account changeManagedServiceBundle --bundle Growth --billingPeriod Annual --yes       # then apply',
    `<%= config.bin %> hub scheduler task save --body '{"name":"nightly","cronExpression":"0 2 * * *"}'`,
    '<%= config.bin %> hub membership user get --userId:str 0042',
    '<%= config.bin %> hub membership role 66b2f0a1c3d4e5f6a7b8c9d0      # no verb: get one; without an id, the list',
    '<%= config.bin %> hub database schema bundle apply --bundleJson \"$(cat bundle.json)\" --dry-run   # the Hub validates the bundle',
  ]

  async run(): Promise<unknown> {
    const {flagArgv, rest, help} = this.splitArgv()
    const {flags} = await this.parse(Hub, flagArgv)
    return this.dispatch(rest, flags, help)
  }
}
