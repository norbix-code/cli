import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {PAYMENT_PROVIDERS, readJsonObject} from '../../../lib/payments.js'

export default class PaymentsIntegrationSave extends BaseCommand {
  static description = `Create or update a payments integration

--provider picks the body shape. Put the provider-specific fields in --config
(inline JSON, @file.json, or - for stdin) — for Stripe: secretKey,
publishableKey and webhookSigningSecret (the whsec_… of the Stripe webhook
endpoint that points at Norbix). Use test-mode keys while you develop. Pass
--id to update an existing integration.`

  static examples = [
    '<%= config.bin %> payments integration save --provider Stripe --name Stripe --config @stripe.json',
    '<%= config.bin %> payments integration save --provider AppleInApp --name "App Store" --config @apple.json',
    '<%= config.bin %> payments integration save --provider Stripe --name Stripe --config @stripe.json --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    provider: Flags.string({required: true, description: 'Payment provider', options: PAYMENT_PROVIDERS}),
    name: Flags.string({description: 'Integration name'}),
    id: Flags.string({description: 'Integration ID — set it to update instead of create'}),
    disabled: Flags.boolean({description: 'Save it turned off', default: false}),
    config: Flags.string({description: 'Provider-specific fields as a JSON object, @file or -'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(PaymentsIntegrationSave)
    const client = this.client(flags)

    const extra = flags.config ? await readJsonObject(flags.config, 'config') : {}
    const integration = {
      ...extra,
      provider: flags.provider,
      integrationId: flags.id,
      integrationName: flags.name ?? '',
      isEnabled: !flags.disabled,
    }

    // The provider-specific fields are not on the generated base type, so the
    // body is cast: the server picks the shape from `provider`.
    const res = await client.hub.payments.savePaymentsIntegration({integration} as unknown as Parameters<
      typeof client.hub.payments.savePaymentsIntegration
    >[0])

    this.print(res)
    return res
  }
}
