import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {parseTokens, readJsonObject, SMS_AUDIENCES, TIME_ZONE_RULES, toUnixSeconds} from '../../../lib/sms.js'

export default class SmsCampaignCreate extends BaseCommand {
  static description = `Create an SMS campaign

--audience picks who receives it:
  all-users      every user with a phone; narrow with --role / --tag
  users          the users named with --user
  collection     the records of --schema whose --field holds the recipient
  phone-numbers  raw phone numbers, --phone +37060000000 (international format)

--integration is required: name the SMS provider the campaign sends through
(list them with \`norbix sms integrations\`). The server never falls back to
the project default. --language forces one language; it must be one of the
project's languages (Project settings). The template must have a translation for
every project language, or the server refuses the campaign. --initiator sends on
behalf of another project user (default: you).

Without --at the campaign is sent right away. Anything the flags do not cover
goes in --config as a JSON object and is merged into the delivery settings.`

  static examples = [
    '<%= config.bin %> sms campaign create --template 66b2f0a1c3d4e5f6a7b8c9d0 --integration 66c1a2b3c4d5e6f7a8b9c0d1 --audience all-users --tag beta',
    '<%= config.bin %> sms campaign create --template 66b2f0a1c3d4e5f6a7b8c9d0 --integration 66c1a2b3c4d5e6f7a8b9c0d1 --audience users --user usr_1 --user usr_2',
    '<%= config.bin %> sms campaign create --template 66b2f0a1c3d4e5f6a7b8c9d0 --integration 66c1a2b3c4d5e6f7a8b9c0d1 --audience phone-numbers --phone +37060000000 --at 2026-10-01T09:00:00Z',
    '<%= config.bin %> sms campaign create --template 66b2f0a1c3d4e5f6a7b8c9d0 --integration 66c1a2b3c4d5e6f7a8b9c0d1 --audience all-users --tag beta --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    template: Flags.string({required: true, description: 'Template ID'}),
    audience: Flags.string({required: true, description: 'Who receives it', options: Object.keys(SMS_AUDIENCES)}),
    user: Flags.string({description: 'User ID (users; repeat for several)', multiple: true}),
    role: Flags.string({description: 'Role name (all-users / collection; repeat for several)', multiple: true}),
    tag: Flags.string({description: 'User tag (all-users; repeat for several)', multiple: true}),
    schema: Flags.string({description: 'Collection name (collection)'}),
    field: Flags.string({description: 'Field that holds the recipient (collection; repeat for several)', multiple: true}),
    'field-type': Flags.string({description: 'What --field holds (collection)', options: ['User', 'Email']}),
    phone: Flags.string({description: 'Phone number in international format (phone-numbers; repeat for several)', multiple: true}),
    integration: Flags.string({
      required: true,
      description: 'SMS integration ID the campaign sends through; list them with `norbix sms integrations`',
    }),
    language: Flags.string({
      description: "Send every message in this language. Must be one of the project's languages (Project settings); default: each recipient's own language, else the project default",
    }),
    initiator: Flags.string({
      description: 'Send on behalf of this project user ID — their details fill the Initiator.User.* tokens (default: you, the caller)',
    }),
    at: Flags.string({description: 'Send later: ISO 8601 date-time or Unix seconds'}),
    'respect-time-zone': Flags.string({
      description: "Send --at in each recipient's own time zone, taken from this source",
      options: Object.keys(TIME_ZONE_RULES),
    }),
    token: Flags.string({description: 'Token value as key=value (repeat for several)', multiple: true}),
    'database-integration': Flags.string({description: 'Database integration ID (defaults to the project default)'}),
    config: Flags.string({description: 'Extra delivery-settings fields as a JSON object, @file or -'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(SmsCampaignCreate)
    const client = this.client(flags)

    const audience = SMS_AUDIENCES[flags.audience]!
    const extra = flags.config ? await readJsonObject(flags.config, 'config') : {}
    const settings: Record<string, unknown> = {
      ...extra,
      recipientsSourceType: audience.deliveryType,
      campaignTime: flags.at ? toUnixSeconds(flags.at) : undefined,
      respectTimeZoneSettings: flags['respect-time-zone'] ? TIME_ZONE_RULES[flags['respect-time-zone']] : undefined,
      mappedTokens: parseTokens(flags.token),
      ...this.audienceFields(flags),
    }

    // The server reads `deliveryType` and then exactly the matching settings
    // block (allUsers / specifiedUsers / collection / phoneNumbers).
    const res = await client.hub.notifications.createSmsCampaign({
      templateId: flags.template,
      databaseIntegrationId: flags['database-integration'],
      integrationId: flags.integration,
      language: flags.language,
      initiatorId: flags.initiator,
      deliveryType: audience.deliveryType,
      [audience.block]: settings,
    } as unknown as Parameters<typeof client.hub.notifications.createSmsCampaign>[0])

    this.print(res)
    return res
  }

  private audienceFields(flags: {
    audience: string
    user?: string[]
    role?: string[]
    tag?: string[]
    schema?: string
    field?: string[]
    'field-type'?: string
    phone?: string[]
  }): Record<string, unknown> {
    switch (flags.audience) {
      case 'all-users':
        return {rolesNames: flags.role, userTags: flags.tag}
      case 'users':
        if (!flags.user?.length) this.error('--audience users needs at least one --user')
        return {recipients: flags.user}
      case 'collection':
        if (!flags.schema || !flags.field?.length) this.error('--audience collection needs --schema and --field')
        return {schemaName: flags.schema, fields: flags.field, fieldType: flags['field-type'], roleNames: flags.role}
      default:
        if (!flags.phone?.length) this.error('--audience phone-numbers needs at least one --phone')
        return {phoneNumbers: flags.phone}
    }
  }
}
