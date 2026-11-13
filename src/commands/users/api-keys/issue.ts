import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {listOf} from '../../../lib/membership.js'

export default class UsersApiKeysIssue extends BaseCommand {
  static description = `Make a new API key for a project service user and show it

The key is shown ONCE, in this answer: store it now (a secret store or your
app's settings). It works in the --env environment. The service user's other
keys keep working.`

  static examples = [
    '<%= config.bin %> users api-keys issue usr_66b2f0a1c3d4 --name "Orders sync"',
    '<%= config.bin %> users api-keys issue usr_66b2f0a1c3d4 --name CI --expires-in-days 90 --scope read --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Service user login ID (usr_…)'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    name: Flags.string({required: true, description: 'A name that says where the key is used'}),
    scope: Flags.string({description: 'Scope to limit the key to (repeat for several, or a comma list)', multiple: true}),
    'expires-in-days': Flags.integer({description: 'Days until the key stops working; none = it does not expire', min: 1}),
    notes: Flags.string({description: 'Notes about the key'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersApiKeysIssue)
    const scopes = listOf(flags.scope)
    const client = this.client(flags)

    const res = await client.hub.membership.issueServiceUserApiKey({
      id: args.id,
      name: flags.name,
      ...(scopes ? {scopes} : {}),
      ...(flags['expires-in-days'] ? {expiresInDays: flags['expires-in-days']} : {}),
      ...(flags.notes ? {notes: flags.notes} : {}),
    })

    if (!this.jsonEnabled()) {
      this.log(`Key ${res.id} (${res.name}) made${res.environment ? ` for ${res.environment}` : ''}. It is shown once — store it now:`)
      this.log(res.key)
    }

    return res
  }
}
