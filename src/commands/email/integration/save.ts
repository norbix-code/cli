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
Pass --id to update an existing integration.`

  static examples = [
    '<%= config.bin %> email integration save --provider Fake',
    '<%= config.bin %> email integration save --provider SendGrid --name SendGrid --from hello@example.com --config @sendgrid.json',
  ]

  static flags = {
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

    const extra = flags.config ? await readJsonObject(flags.config, 'config') : {}
    const integration = {
      ...extra,
      provider: flags.provider,
      integrationId: flags.id,
      integrationName: flags.name ?? '',
      emailAddress: flags.from ?? (extra.emailAddress as string | undefined),
      emailSenderName: flags['sender-name'] ?? (extra.emailSenderName as string | undefined),
      isEnabled: !flags.disabled,
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
