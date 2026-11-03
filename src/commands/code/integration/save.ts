import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {integrationBody, KEYLESS_HELP} from '../../../lib/integrations.js'
import {providerFlag} from '../../../lib/providers.js'

/** The real provider names the server's integration converter accepts (Sandbox is added by providerFlag). */
const PROVIDERS = ['AwsLambda', 'AzureFunctions', 'GoogleCloudFunctions', 'Pipedream', 'Zapier', 'CloudflareWorkers', 'Vercel', 'Netlify', 'SupabaseEdge', 'Modal']

export default class CodeIntegrationSave extends BaseCommand {
  static description = `Create or update a code integration

--provider picks the body shape. Sandbox needs nothing else: it runs no real function and contacts no cloud, so use
it while you develop. Put the provider-specific fields in --config (inline JSON,
@file.json, or - for stdin): the region and — keyless — the role ARN (AWS), the tenant and client id (Azure) or the service-account e-mail (Google); see \`norbix integrations keyless-setup code <cloud>\`.
Pass --id to update an existing integration. The output of \`code integration
<id>\` can be fed back as --config (bare or wrapped in {"integration": …}): its
viewId picks the integration to update, so no second one is created.

${KEYLESS_HELP}`

  static examples = [
    '<%= config.bin %> code integration save --provider Sandbox',
    '<%= config.bin %> code integration save --provider AwsLambda --name Lambda --config @lambda.json',
    '<%= config.bin %> code integration save --provider AzureFunctions --name Functions --id int_1 --config @functions.json --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    provider: providerFlag('Code', PROVIDERS),
    name: Flags.string({description: 'Integration name'}),
    id: Flags.string({description: 'Integration ID — set it to update instead of create'}),
    disabled: Flags.boolean({description: 'Save it turned off', default: false}),
    config: Flags.string({description: 'Provider-specific fields as a JSON object, @file or -'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(CodeIntegrationSave)
    const client = this.client(flags)

    const integration = await integrationBody(flags)

    // The provider-specific fields are not on the generated base type, so the
    // body is cast: the server picks the shape from `provider`.
    const res = await client.hub.code.saveCodeIntegration({integration} as unknown as Parameters<
      typeof client.hub.code.saveCodeIntegration
    >[0])

    this.print(res)
    return res
  }
}
