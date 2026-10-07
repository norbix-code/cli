import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {readJsonObject} from '../../../lib/email.js'

/** The provider names the server's integration converter accepts. */
const PROVIDERS = ['Fake', 'Smtp', 'SendGrid', 'MailGun', 'AwsSes']

export default class EmailIntegrationSave extends BaseCommand {
  static description = `Create or update an email integration

--provider picks the body shape. Fake needs nothing else: it accepts every send
and contacts no mail service, so nothing reaches a real inbox — use it while you
develop (one Fake per project, no update — delete and add it again). The real
providers need a sender (--from) and their credentials: put the
provider-specific fields in --config (inline JSON, @file.json, or - for stdin).
Pass --id to update an existing integration. The output of \`email integration
get\` can be fed back as --config (bare or wrapped in {"integration": …}): its
viewId picks the integration to update, so no second one is created.`

  static examples = [
    '<%= config.bin %> email integration save --provider Fake',
    '<%= config.bin %> email integration save --provider SendGrid --name SendGrid --from hello@example.com --config @sendgrid.json',
    '<%= config.bin %> email integration save --provider Fake --dry-run',
    '<%= config.bin %> email integration save --provider SendGrid --config @integration-from-get.json',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    provider: Flags.string({required: true, description: 'Email provider', options: PROVIDERS}),
    name: Flags.string({description: 'Integration name (Fake ignores it and uses its own)'}),
    id: Flags.string({description: 'Integration ID — set it to update instead of create'}),
    from: Flags.string({description: 'Sender e-mail address (Fake ignores it)'}),
    'sender-name': Flags.string({description: 'Sender display name'}),
    disabled: Flags.boolean({description: 'Save it turned off', default: false}),
    config: Flags.string({description: 'Provider-specific fields as a JSON object, @file or -'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(EmailIntegrationSave)
    const client = this.client(flags)

    const config = flags.config ? await readJsonObject(flags.config, 'config') : {}
    const {id, extra} = splitConfig(config)
    const integration = {
      ...extra,
      provider: flags.provider,
      integrationId: flags.id ?? id,
      integrationName: flags.name ?? (extra.integrationName as string | undefined) ?? '',
      emailAddress: flags.from ?? (extra.emailAddress as string | undefined),
      emailSenderName: flags['sender-name'] ?? (extra.emailSenderName as string | undefined),
      isEnabled: flags.disabled ? false : ((extra.isEnabled as boolean | undefined) ?? true),
    }

    // The provider-specific fields are not on the generated base type, so the
    // body is cast: the server picks the shape from `provider`.
    const res = await client.hub.notifications.saveEmailIntegration({integration} as unknown as Parameters<
      typeof client.hub.notifications.saveEmailIntegration
    >[0])

    this.print(res)
    return res
  }
}

/** Fields `email integration get` returns that the server sets itself; never sent back. */
const READ_ONLY = [
  'viewId',
  'id',
  'env',
  'lastIntegrationTestAtUtc',
  'lastIntegrationTestSucceeded',
  'lastIntegrationTestErrors',
  'humanDeliveryConfirmedAtUtc',
  'requiresHumanDeliveryConfirmation',
]

/**
 * --config may be a bare integration or `{"integration": {...}}`, and may come
 * straight from `email integration get`. The server reads only
 * `integrationId`: a `viewId` (or `id`) would be dropped and a second
 * integration created, so it becomes the integrationId here.
 */
function splitConfig(config: Record<string, unknown>): {id?: string; extra: Record<string, unknown>} {
  const inner =
    typeof config.integration === 'object' && config.integration !== null && !Array.isArray(config.integration)
      ? (config.integration as Record<string, unknown>)
      : config
  const id = [inner.integrationId, inner.viewId, inner.id].find((v): v is string => typeof v === 'string' && v !== '')
  const extra = Object.fromEntries(Object.entries(inner).filter(([k]) => !READ_ONLY.includes(k) && k !== 'integrationId'))
  return {id, extra}
}
