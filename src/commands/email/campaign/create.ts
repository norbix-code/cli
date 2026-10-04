import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {
  EMAIL_AUDIENCE_HELP,
  emailAudienceFields,
  emailAudienceFlags,
  parseTokens,
  readJsonObject,
  toUnixSeconds,
} from '../../../lib/email.js'

export default class EmailCampaignCreate extends BaseCommand {
  static description = `Create an email campaign

${EMAIL_AUDIENCE_HELP}

--integration is required: name the email provider the campaign sends through
(list them with \`norbix email integrations\`). The server never falls back to
the project default. --language forces one language; it must be one of the
project's languages (Project settings). The template must have a translation for
every project language, or the server refuses the campaign. --initiator sends on
behalf of another project user (default: you).

Without --at the campaign is sent right away. --validation-integration checks
every address first. Anything the flags do not cover goes in --config as a JSON
object and is merged into the campaign.`

  static examples = [
    '<%= config.bin %> email campaign create --template 66b2f0a1c3d4e5f6a7b8c9d0 --integration 66c1a2b3c4d5e6f7a8b9c0d1 --audience all-users --tag beta',
    '<%= config.bin %> email campaign create --template 66b2f0a1c3d4e5f6a7b8c9d0 --integration 66c1a2b3c4d5e6f7a8b9c0d1 --audience emails --email ada@example.com --at 2026-10-01T09:00:00Z',
    '<%= config.bin %> email campaign create --template 66b2f0a1c3d4e5f6a7b8c9d0 --integration 66c1a2b3c4d5e6f7a8b9c0d1 --audience collection --schema subscribers --field email --field-type Email',
    '<%= config.bin %> email campaign create --template 66b2f0a1c3d4e5f6a7b8c9d0 --integration 66c1a2b3c4d5e6f7a8b9c0d1 --audience all-users --tag beta --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    template: Flags.string({required: true, description: 'Template ID'}),
    ...emailAudienceFlags,
    integration: Flags.string({
      required: true,
      description: 'Email integration ID the campaign sends through; list them with `norbix email integrations`',
    }),
    'validation-integration': Flags.string({description: 'Email-validation integration ID — check every address first'}),
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
    const {flags} = await this.parse(EmailCampaignCreate)
    const client = this.client(flags)

    const extra = flags.config ? await readJsonObject(flags.config, 'config') : {}
    const campaign: Record<string, unknown> = {
      ...extra,
      templateId: flags.template,
      integrationId: flags.integration,
      validationIntegrationId: flags['validation-integration'],
      language: flags.language,
      initiatorId: flags.initiator ?? extra.initiatorId,
      notes: flags.notes,
      campaignTime: flags.at ? toUnixSeconds(flags.at) : undefined,
      mappedTokens: parseTokens(flags.token),
      ...emailAudienceFields(flags, (message) => this.error(message)),
    }

    // `campaign` is one of five request subclasses picked by `source`; the
    // generated type is the base, so the body is cast.
    const res = await client.hub.notifications.createEmailCampaign({
      campaign,
      databaseIntegrationId: flags['database-integration'],
    } as unknown as Parameters<typeof client.hub.notifications.createEmailCampaign>[0])

    this.print(res)
    return res
  }
}
