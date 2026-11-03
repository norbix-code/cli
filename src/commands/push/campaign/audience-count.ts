import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {audienceFields, audienceFlags} from '../../../lib/push.js'

export default class PushCampaignAudienceCount extends BaseCommand {
  static description = `Count the devices a push campaign audience would reach (nothing is sent)

Takes the same --audience flags as \`push campaign create\` — no template and no
provider, the server only reads the audience. Answers the number of devices and
of recipients, how many user ids were skipped (no device), and \`isCapped\` when
the count stopped at the server's limit. Run it before \`campaign create\` to
check an audience.

--audience picks who it counts:
  all-users      every user; narrow with --role / --tag
  users          the users named with --user
  account-users  the account users named with --user
  collection     the users referenced by --field in the --schema collection
  devices        raw device tokens, --device <token>:<family> (Ios, Android, Chrome, Safari, Expo)`

  static examples = [
    '<%= config.bin %> push campaign audience-count --audience all-users --tag beta',
    '<%= config.bin %> push campaign audience-count --audience users --user usr_1 --user usr_2',
    '<%= config.bin %> push campaign audience-count --audience collection --schema subscribers --field owner --field-type User',
    '<%= config.bin %> push campaign audience-count --audience all-users --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    ...audienceFlags,
    'database-integration': Flags.string({description: 'Database integration ID (defaults to the project default)'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(PushCampaignAudienceCount)
    const client = this.client(flags)

    let campaign: Record<string, unknown>
    try {
      campaign = audienceFields(flags)
    } catch (error) {
      return this.error((error as Error).message)
    }

    const res = await client.api.notifications.getPushCampaignAudienceCount({
      campaign,
      databaseIntegrationId: flags['database-integration'],
    } as unknown as Parameters<typeof client.api.notifications.getPushCampaignAudienceCount>[0])

    this.print(res)
    return res
  }
}
