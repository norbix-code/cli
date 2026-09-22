import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {readJsonObject} from '../../../lib/push.js'

/** The provider names the server's integration converter accepts. */
const PROVIDERS = ['Fake', 'AppleApns', 'AndroidFirebase', 'SafariPush', 'ChromeWeb', 'FirefoxWeb', 'EdgeWeb', 'ChromePush']

export default class PushIntegrationSave extends BaseCommand {
  static description = `Create or update a push integration

--provider picks the body shape. Fake needs nothing else: it accepts every send
and contacts no push service, so use it while you develop. The real providers
need their credentials — put the provider-specific fields in --config (inline
JSON, @file.json, or - for stdin). Pass --id to update an existing integration.`

  static examples = [
    '<%= config.bin %> push integration save --provider Fake',
    '<%= config.bin %> push integration save --provider AndroidFirebase --name Android --config @firebase.json',
  ]

  static flags = {
    provider: Flags.string({required: true, description: 'Push provider', options: PROVIDERS}),
    name: Flags.string({description: 'Integration name (Fake ignores it and uses its own)'}),
    id: Flags.string({description: 'Integration ID — set it to update instead of create'}),
    disabled: Flags.boolean({description: 'Save it turned off', default: false}),
    config: Flags.string({description: 'Provider-specific fields as a JSON object, @file or -'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(PushIntegrationSave)
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
    const res = await client.hub.notifications.savePushIntegration({integration} as unknown as Parameters<
      typeof client.hub.notifications.savePushIntegration
    >[0])

    this.print(res)
    return res
  }
}
