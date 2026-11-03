import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'
import {parseInputs} from '../../../../lib/integrations.js'

/** The gateway's answer, as the CLI reads it (every field may be missing). */
export interface ConnectStart {
  authorizeUrl?: string
  connectId?: string
  redirectUrl?: string
  expiresAt?: string
}

export default class PaymentsIntegrationConnectStart extends BaseCommand {
  static description = `Start the quick connect of a payments integration ("Connect with <provider>")

Quick connect (one-click OAuth) saves a payments integration without pasting
keys: the provider's page asks the person to approve, sends them back to Norbix,
and the integration is saved from the account they pick. This prints the
provider's page to open in a browser (valid 10 minutes) and the connect id.
Once the person approved: \`norbix integrations connect targets <connectId>\`
lists the accounts, \`norbix payments integration connect complete <connectId>
--target <id>\` saves the integration.

Which providers can quick-connect on this install, the inputs they need before
their page opens (e.g. storeUrl) and their modes: \`norbix integrations connect
providers --module payments\`. --integration reconnects an existing integration
instead of creating one.`

  static examples = [
    '<%= config.bin %> payments integration connect start --provider woocommerce --name Shop --input storeUrl=https://shop.example.com',
    '<%= config.bin %> payments integration connect start --provider woocommerce --name Shop --input storeUrl=https://shop.example.com --mode test',
    '<%= config.bin %> payments integration connect start --provider woocommerce --name Shop --integration int_1 --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    provider: Flags.string({required: true, description: 'Provider key from `integrations connect providers`, e.g. woocommerce'}),
    name: Flags.string({required: true, description: 'The name the new integration gets'}),
    mode: Flags.string({description: "The provider's mode (test or live) when the provider has modes"}),
    input: Flags.string({
      multiple: true,
      description: 'An input the provider needs before its page opens, key=value (repeatable), e.g. storeUrl=https://shop.example.com',
    }),
    integration: Flags.string({description: 'Reconnect: the id of the integration the new connection replaces'}),
  }

  async run(): Promise<ConnectStart> {
    const {flags} = await this.parse(PaymentsIntegrationConnectStart)
    const client = this.client(flags)

    const input = parseInputs(flags.input)
    const res = (await client.hub.payments.startPaymentsIntegrationConnect({
      provider: flags.provider,
      integrationName: flags.name,
      ...(flags.mode === undefined ? {} : {mode: flags.mode}),
      ...(input === undefined ? {} : {input}),
      ...(flags.integration === undefined ? {} : {integrationId: flags.integration}),
    })) as ConnectStart

    if (!this.jsonEnabled()) {
      for (const line of render(res)) this.log(line)
    }

    return res
  }
}

/** The human view: where to go, and what to run once the person is back. */
export function render(res: ConnectStart): string[] {
  const lines = [
    `Open in a browser: ${res.authorizeUrl ?? ''}`,
    `Connect id:        ${res.connectId ?? ''}`,
    `Expires at:        ${res.expiresAt ?? ''}`,
  ]
  if (res.connectId) {
    lines.push(
      '',
      'Once approved, pick the account:',
      `  norbix integrations connect targets ${res.connectId}`,
      `  norbix payments integration connect complete ${res.connectId} --target <id>`,
    )
  }

  return lines
}
