import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {parseTokens, readJsonObject} from '../../../lib/push.js'

/** --audience value → the `source` discriminator the server routes the body by. */
const AUDIENCES: Record<string, string> = {
  'all-users': 'allUsers',
  users: 'specifiedUsers',
  'account-users': 'accountUsers',
  collection: 'collection',
  devices: 'devices',
}

export default class PushCampaignCreate extends BaseCommand {
  static description = `Create a push campaign

--audience picks who receives it:
  all-users      every user; narrow with --role / --tag
  users          the users named with --user
  account-users  the account users named with --user
  collection     the users referenced by --field in the --schema collection
  devices        raw device tokens, --device <token>:<family> (Ios, Android, Chrome, Safari, Expo)

Without --at the campaign is sent right away. Anything the flags do not cover
goes in --config as a JSON object and is merged into the campaign.`

  static examples = [
    '<%= config.bin %> push campaign create --template 66b2f0a1... --audience all-users --tag beta',
    '<%= config.bin %> push campaign create --template 66b2f0a1... --audience users --user usr_1 --user usr_2',
    '<%= config.bin %> push campaign create --template 66b2f0a1... --audience devices --device dGVzdA==:Ios',
  ]

  static flags = {
    template: Flags.string({required: true, description: 'Template ID'}),
    audience: Flags.string({required: true, description: 'Who receives it', options: Object.keys(AUDIENCES)}),
    user: Flags.string({description: 'User ID (users / account-users; repeat for several)', multiple: true}),
    role: Flags.string({description: 'Role name (all-users / collection; repeat for several)', multiple: true}),
    tag: Flags.string({description: 'User tag (all-users; repeat for several)', multiple: true}),
    schema: Flags.string({description: 'Collection name (collection)'}),
    field: Flags.string({description: 'Field that holds the recipient (collection; repeat for several)', multiple: true}),
    'field-type': Flags.string({description: 'What --field holds (collection)', options: ['User', 'Email']}),
    device: Flags.string({description: 'Device as <token>:<family> (devices; repeat for several)', multiple: true}),
    integration: Flags.string({description: 'Push integration ID (defaults to the project default)'}),
    language: Flags.string({description: 'Template language to send'}),
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
      source: AUDIENCES[flags.audience],
      templateId: flags.template,
      integrationId: flags.integration,
      language: flags.language,
      notes: flags.notes,
      campaignTime: flags.at ? toUnixSeconds(flags.at) : undefined,
      mappedTokens: parseTokens(flags.token),
      ...this.audienceFields(flags),
    }

    const res = await client.hub.notifications.createPushCampaign({
      campaign,
      databaseIntegrationId: flags['database-integration'],
    } as unknown as Parameters<typeof client.hub.notifications.createPushCampaign>[0])

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
    device?: string[]
  }): Record<string, unknown> {
    switch (flags.audience) {
      case 'all-users':
        return {rolesNames: flags.role, userTags: flags.tag}
      case 'users':
      case 'account-users':
        if (!flags.user?.length) this.error(`--audience ${flags.audience} needs at least one --user`)
        return {userRecipients: flags.user}
      case 'collection':
        if (!flags.schema || !flags.field?.length) this.error('--audience collection needs --schema and --field')
        return {schemaName: flags.schema, fields: flags.field, fieldType: flags['field-type'], roleNames: flags.role}
      default:
        if (!flags.device?.length) this.error('--audience devices needs at least one --device <token>:<family>')
        return {devices: flags.device.map((d) => this.device(d))}
    }
  }

  private device(value: string): {token: string; deliveryFamily: string} {
    const at = value.lastIndexOf(':')
    if (at < 1) this.error(`--device must look like <token>:<family>, got "${value}"`)
    return {token: value.slice(0, at), deliveryFamily: value.slice(at + 1)}
  }
}

function toUnixSeconds(value: string): number {
  if (/^\d+$/.test(value)) return Number(value)
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) throw new Error(`--at is not a date: "${value}"`)
  return Math.floor(ms / 1000)
}
