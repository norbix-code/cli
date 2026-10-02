
import {BaseCommand} from '../../base.js'

export default class ApikeysRegenerate extends BaseCommand {
  static description = 'Regenerate the API keys for the current environment (old keys stop working!)'

  static examples = ['<%= config.bin %> apikeys regenerate --yes']

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ApikeysRegenerate)
    const client = this.client(flags)

    await this.confirmOrFail('Regenerate API keys? Every service using the old keys will lose access.', flags)

    const res = await client.api.apikeys.regenerateApiKeys({environment: flags.env})
    this.print(res)
    return res
  }
}
