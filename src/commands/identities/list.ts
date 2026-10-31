import {BaseCommand} from '../../base.js'
import {formatIdentities} from '../../lib/triggers.js'

export default class IdentitiesList extends BaseCommand {
  static description = `List the execution identities of the environment

Every service user a trigger, a scheduled task or a workflow can run as, the
default identity first, with whether you may assign it and what uses it. Pass
the id to --execution-identity on a save.`

  static examples = ['<%= config.bin %> identities list', '<%= config.bin %> identities list --env TEST --json']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(IdentitiesList)
    const client = this.client(flags)

    const res = await client.hub.membership.getExecutionIdentities({})

    this.print(formatIdentities(res))
    return res
  }
}
