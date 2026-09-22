import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class PushIntegrationAppRequest extends BaseCommand {
  static description = `Register a Norbix app push integration request (managed service)

This is one step of the managed-app pairing flow: the Norbix mobile app shows
a request ID, a PIN and a public key, and this call registers them for the
account. It is account-scoped, so an account ID must be configured or passed
with --account.`

  static examples = [
    '<%= config.bin %> push integration app-request --user usr_1 --request-id req_1 --pin 123456 --valid-till 2026-09-20T12:00:00Z --public-key MIIB...',
  ]

  static flags = {
    user: Flags.string({required: true, description: 'User ID the app is paired to'}),
    'request-id': Flags.string({required: true, description: 'Request ID shown by the app'}),
    pin: Flags.integer({required: true, description: 'PIN shown by the app'}),
    'valid-till': Flags.string({required: true, description: 'When the request expires (ISO 8601)'}),
    'public-key': Flags.string({required: true, description: "The app's public key"}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(PushIntegrationAppRequest)
    const client = this.client(flags)

    const res = await client.hub.notifications.registerCodeMashAppPushIntegration({
      accountId: this.resolveContext(flags).accountId,
      userId: flags.user,
      requestId: flags['request-id'],
      pin: flags.pin,
      validTill: flags['valid-till'],
      publicKey: flags['public-key'],
    })

    this.print('App push integration request registered.')
    return res
  }
}
