import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {providerFlag} from '../../../lib/providers.js'
import {readJsonObject} from '../../../lib/sms.js'

/** The real provider names the server's integration converter accepts (Sandbox is added by providerFlag). */
const PROVIDERS = ['Twilio', 'Vonage', 'Plivo', 'Telnyx', 'Bird', 'Telesign', 'Sinch']

export default class SmsIntegrationSave extends BaseCommand {
  static description = `Create or update an SMS integration

--provider picks the body shape. Sandbox needs nothing else: it accepts every send
and contacts no SMS service, so use it while you develop (one Sandbox per project,
no update — delete and add it again). The real providers need their
credentials — put the provider-specific fields in --config (inline JSON,
@file.json, or - for stdin). Pass --id to update an existing integration.`

  static examples = [
    '<%= config.bin %> sms integration save --provider Sandbox',
    '<%= config.bin %> sms integration save --provider Twilio --name Twilio --config @twilio.json',
    '<%= config.bin %> sms integration save --provider Sandbox --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    provider: providerFlag('SMS', PROVIDERS),
    name: Flags.string({description: 'Integration name (Sandbox ignores it and uses its own)'}),
    id: Flags.string({description: 'Integration ID — set it to update instead of create'}),
    disabled: Flags.boolean({description: 'Save it turned off', default: false}),
    config: Flags.string({description: 'Provider-specific fields as a JSON object, @file or -'}),
    'delivery-events': Flags.boolean({description: 'Twilio: let Twilio report each message\'s status (delivered / undelivered / failed) to the hub, which settles the recipient rows; needs --status-callback-url', default: false}),
    'status-callback-url': Flags.string({description: 'Twilio delivery events: the absolute https URL Twilio calls — https://<hub>/v3/sms/webhooks/twilio/<projectId>/<integrationId>?env=<env>; paste the same URL here and in Twilio (signature verified)'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(SmsIntegrationSave)
    const client = this.client(flags)

    const extra = flags.config ? await readJsonObject(flags.config, 'config') : {}
    const deliveryEvents = flags['delivery-events'] ? true : (extra.deliveryEventsEnabled as boolean | undefined)
    const integration = {
      ...extra,
      ...(deliveryEvents === undefined ? {} : {deliveryEventsEnabled: deliveryEvents}),
      ...(flags['status-callback-url'] === undefined ? {} : {statusCallbackUrl: flags['status-callback-url']}),
      provider: flags.provider,
      integrationId: flags.id,
      integrationName: flags.name ?? '',
      isEnabled: !flags.disabled,
    }

    // The provider-specific fields are not on the generated base type, so the
    // body is cast: the server picks the shape from `provider`.
    const res = await client.hub.notifications.saveSmsIntegration({integration} as unknown as Parameters<
      typeof client.hub.notifications.saveSmsIntegration
    >[0])

    this.print(res)
    return res
  }
}
