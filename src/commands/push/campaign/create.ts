import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {audienceFields, audienceFlags, parseTokens, readJsonObject} from '../../../lib/push.js'

export default class PushCampaignCreate extends BaseCommand {
  static description = `Create a push campaign

--audience picks who receives it:
  all-users      every user; narrow with --role / --tag
  users          the users named with --user
  account-users  the account users named with --user
  collection     the users referenced by --field in the --schema collection
  devices        raw device tokens, --device <token>:<family> (Ios, Android, Chrome, Safari, Expo)

--integration is required: name the push provider the campaign sends through
(list them with \`norbix push integrations\`). The server never falls back to
the project default. --language forces one language; it must be one of the
project's languages (Project settings). The template must have a translation for
every project language, or the server refuses the campaign. --initiator sends on
behalf of another project user (default: you).

Without --at the campaign is sent right away. Anything the flags do not cover
goes in --config as a JSON object and is merged into the campaign. To see how
many devices an audience reaches before sending, run
\`norbix push campaign audience-count\` with the same audience flags.`

  static examples = [
    '<%= config.bin %> push campaign create --template 66b2f0a1c3d4e5f6a7b8c9d0 --integration 66c1a2b3c4d5e6f7a8b9c0d1 --audience all-users --tag beta',
    '<%= config.bin %> push campaign create --template 66b2f0a1c3d4e5f6a7b8c9d0 --integration 66c1a2b3c4d5e6f7a8b9c0d1 --audience users --user usr_1 --user usr_2',
    '<%= config.bin %> push campaign create --template 66b2f0a1c3d4e5f6a7b8c9d0 --integration 66c1a2b3c4d5e6f7a8b9c0d1 --audience devices --device dGVzdA==:Ios',
    '<%= config.bin %> push campaign create --template 66b2f0a1c3d4e5f6a7b8c9d0 --integration 66c1a2b3c4d5e6f7a8b9c0d1 --audience all-users --tag beta --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    template: Flags.string({required: true, description: 'Template ID'}),
    ...audienceFlags,
    integration: Flags.string({
      required: true,
      description: 'Push integration ID the campaign sends through; list them with `norbix push integrations`',
    }),
    language: Flags.string({
      description: "Send every message in this language. Must be one of the project's languages (Project settings); default: each recipient's own language, else the project default",
    }),
    initiator: Flags.string({
      description: 'Send on behalf of this project user ID — their details fill the Initiator.User.* tokens (default: you, the caller)',
    }),
    notes: Flags.string({description: 'Internal notes'}),
    at: Flags.string({description: 'Send later: ISO 8601 date-time or Unix seconds'}),
    token: Flags.string({description: 'Token value as key=value (repeat for several)', multiple: true}),
    'database-integration': Flags.string({description: 'Database integration ID (defaults to the project default)'}),
    config: Flags.string({description: 'Extra campaign fields as a JSON object, @file or -'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(PushCampaignCreate)
    const client = this.client(flags)

    const extra = flags.config ? await readJsonObject(flags.config, 'config') : {}
    const campaign: Record<string, unknown> = {
      ...extra,
      ...this.audience(flags),
      templateId: flags.template,
      integrationId: flags.integration,
      language: flags.language,
      initiatorId: flags.initiator ?? extra.initiatorId,
      notes: flags.notes,
      campaignTime: flags.at ? toUnixSeconds(flags.at) : undefined,
      mappedTokens: parseTokens(flags.token),
    }

    const res = await client.api.notifications.createPushCampaign({
      campaign,
      databaseIntegrationId: flags['database-integration'],
    } as unknown as Parameters<typeof client.api.notifications.createPushCampaign>[0])

    this.print(res)
    return res
  }

  private audience(flags: Parameters<typeof audienceFields>[0]): Record<string, unknown> {
    try {
      return audienceFields(flags)
    } catch (error) {
      return this.error((error as Error).message)
    }
  }
}

function toUnixSeconds(value: string): number {
  if (/^\d+$/.test(value)) return Number(value)
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) throw new Error(`--at is not a date: "${value}"`)
  return Math.floor(ms / 1000)
}
