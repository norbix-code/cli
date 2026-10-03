import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {EMAIL_AUDIENCES, parseTokens, readJsonObject, toUnixSeconds} from '../../../lib/email.js'

export default class EmailCampaignCreate extends BaseCommand {
  static description = `Create an email campaign

--audience picks who receives it:
  all-users      every user with an e-mail; narrow with --role / --tag
  users          the users named with --user (copies with --cc / --bcc user IDs)
  account-users  the account users named with --user
  emails         raw addresses, --email (copies with --cc / --bcc addresses)
  collection     the recipients in --field of the --schema collection

Without --at the campaign is sent right away. --integration picks the sending
integration (default: the project default); --validation-integration checks
every address first. Anything the flags do not cover goes in --config as a JSON
object and is merged into the campaign.`

  static examples = [
    '<%= config.bin %> email campaign create --template 66b2f0a1... --audience all-users --tag beta',
    '<%= config.bin %> email campaign create --template 66b2f0a1... --audience emails --email ada@example.com --at 2026-10-01T09:00:00Z',
    '<%= config.bin %> email campaign create --template 66b2f0a1... --audience collection --schema subscribers --field email --field-type Email',
  ]

  static flags = {
    template: Flags.string({required: true, description: 'Template ID'}),
    audience: Flags.string({required: true, description: 'Who receives it', options: Object.keys(EMAIL_AUDIENCES)}),
    user: Flags.string({description: 'User ID (users / account-users; repeat for several)', multiple: true}),
    email: Flags.string({description: 'E-mail address (emails; repeat for several)', multiple: true}),
    cc: Flags.string({description: 'Copy to — a user ID (users / account-users) or address (emails); repeat', multiple: true}),
    bcc: Flags.string({description: 'Blind copy — a user ID or address, like --cc; repeat', multiple: true}),
    'one-each': Flags.boolean({
      description: 'Send every recipient a separate e-mail instead of one e-mail to all (users / account-users / emails)',
      default: false,
    }),
    role: Flags.string({description: 'Role name (all-users / collection; repeat for several)', multiple: true}),
    tag: Flags.string({description: 'User tag (all-users; repeat for several)', multiple: true}),
    schema: Flags.string({description: 'Collection name (collection)'}),
    field: Flags.string({description: 'Field that holds the recipient (collection; repeat for several)', multiple: true}),
    'field-type': Flags.string({description: 'What --field holds (collection)', options: ['User', 'Email'], default: 'User'}),
    integration: Flags.string({description: 'Email integration ID (defaults to the project default)'}),
    'validation-integration': Flags.string({description: 'Email-validation integration ID — check every address first'}),
    language: Flags.string({description: 'Template language to send'}),
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
      source: EMAIL_AUDIENCES[flags.audience],
      templateId: flags.template,
      integrationId: flags.integration,
      validationIntegrationId: flags['validation-integration'],
      language: flags.language,
      notes: flags.notes,
      campaignTime: flags.at ? toUnixSeconds(flags.at) : undefined,
      mappedTokens: parseTokens(flags.token),
      ...this.audienceFields(flags),
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

  private audienceFields(flags: {
    audience: string
    user?: string[]
    email?: string[]
    cc?: string[]
    bcc?: string[]
    'one-each': boolean
    role?: string[]
    tag?: string[]
    schema?: string
    field?: string[]
    'field-type': string
  }): Record<string, unknown> {
    switch (flags.audience) {
      case 'all-users': {
        return {rolesNames: flags.role, userTags: flags.tag}
      }

      case 'users':
      case 'account-users': {
        if (!flags.user?.length) this.error(`--audience ${flags.audience} needs at least one --user`)
        return {userRecipients: flags.user, userCc: flags.cc, userBcc: flags.bcc, singleEmailStrategy: flags['one-each']}
      }

      case 'emails': {
        if (!flags.email?.length) this.error('--audience emails needs at least one --email')
        return {
          recipients: flags.email,
          recipientsCc: flags.cc,
          recipientsBcc: flags.bcc,
          singleEmailStrategy: flags['one-each'],
        }
      }

      default: {
        if (!flags.schema || !flags.field?.length) this.error('--audience collection needs --schema and --field')
        return {schemaName: flags.schema, fields: flags.field, fieldType: flags['field-type'], roleNames: flags.role}
      }
    }
  }
}
