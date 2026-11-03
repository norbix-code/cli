import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {integrationBody} from '../../../lib/integrations.js'

/** The provider names the server's integration converter accepts. */
const PROVIDERS = ['AppleSignIn', 'GoogleSignIn', 'Google', 'Facebook', 'X', 'GitHub', 'LinkedIn', 'Okta', 'Microsoft']

export default class MembershipIntegrationSave extends BaseCommand {
  static description = `Create or update a membership integration

--provider picks the body shape. Put the provider-specific fields in --config (inline JSON,
@file.json, or - for stdin): the client id, the client secret and the other provider fields.
Pass --id to update an existing integration. The output of \`membership integration
<id>\` can be fed back as --config (bare or wrapped in {"integration": …}): its
viewId picks the integration to update, so no second one is created.`

  static examples = [
    '<%= config.bin %> membership integration save --provider GitHub --name GitHub --config @github.json',
    '<%= config.bin %> membership integration save --provider Google --name Google --id int_1 --config @google.json --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    provider: Flags.string({required: true, description: 'Membership provider', options: PROVIDERS}),
    name: Flags.string({description: 'Integration name'}),
    id: Flags.string({description: 'Integration ID — set it to update instead of create'}),
    disabled: Flags.boolean({description: 'Save it turned off', default: false}),
    config: Flags.string({description: 'Provider-specific fields as a JSON object, @file or -'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(MembershipIntegrationSave)
    const client = this.client(flags)

    const integration = await integrationBody(flags)

    // The provider-specific fields are not on the generated base type, so the
    // body is cast: the server picks the shape from `provider`.
    const res = await client.hub.membership.saveMembershipIntegration({integration} as unknown as Parameters<
      typeof client.hub.membership.saveMembershipIntegration
    >[0])

    this.print(res)
    return res
  }
}
