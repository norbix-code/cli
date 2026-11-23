import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {usageError} from '../../../lib/cli-error.js'

export default class IntegrationsSecretsRemove extends BaseCommand {
  static description = `Remove saved optional secrets of an integration

Give the key names as \`norbix integrations secrets <integrationId>\` shows
them. Only optional secrets can be removed. A secret the integration needs is
refused (CM-ERRORS-SECRETS-012) and nothing is removed. A key that is not
saved is skipped.`

  static examples = [
    '<%= config.bin %> integrations secrets remove int_3vpkyO4MyVs5Yn4yTlEHCr webhookSigningSecret --yes',
    '<%= config.bin %> integrations secrets remove int_3vpkyO4MyVs5Yn4yTlEHCr webhookSigningSecret eventGridKey --env TEST --dry-run',
  ]

  static strict = false

  static args = {
    integrationId: Args.string({required: true, description: 'Integration id (int_…), of any module'}),
    key: Args.string({required: true, description: 'Secret key to remove; give more than one to remove several'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, argv, flags} = await this.parse(IntegrationsSecretsRemove)
    const keys = (argv as string[]).slice(1).map((k) => k.trim()).filter(Boolean)
    if (keys.length === 0) {
      throw usageError('No secret key given.', 'Name at least one key after the integration id.', 'norbix integrations secrets remove --help')
    }

    const client = this.client(flags)
    await this.confirmOrFail(`Remove ${keys.join(', ')} from integration ${args.integrationId}? This cannot be undone.`, flags)
    const res = await client.hub.integrations.removeIntegrationSecrets({integrationId: args.integrationId, keys})
    this.print(`Removed ${keys.join(', ')} from ${args.integrationId}.`)
    return res
  }
}
