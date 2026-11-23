import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {formatIntegrationSecrets} from '../../lib/integration-secrets.js'

export default class IntegrationsSecrets extends BaseCommand {
  static description = `Show which secrets of an integration are saved

Works for an integration of any module. Shows each secret's key, whether it
is saved, and whether it is optional. Never shows a value, not even part of
one. An optional secret can be removed with \`norbix integrations secrets
remove\`; a needed one can only be replaced by saving the integration with a
new value. To keep a saved secret when you save the integration again, leave
that secret empty.`

  static examples = [
    '<%= config.bin %> integrations secrets int_3vpkyO4MyVs5Yn4yTlEHCr',
    '<%= config.bin %> integrations secrets int_3vpkyO4MyVs5Yn4yTlEHCr --env TEST',
    '<%= config.bin %> integrations secrets int_3vpkyO4MyVs5Yn4yTlEHCr --json',
  ]

  static args = {
    integrationId: Args.string({required: true, description: 'Integration id (int_…), of any module'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(IntegrationsSecrets)
    const res = await this.client(flags).hub.integrations.getIntegrationSecrets({integrationId: args.integrationId})
    this.print(formatIntegrationSecrets(res))
    return res
  }
}
