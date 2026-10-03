import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {readJsonObject} from '../../../lib/email.js'

/** The provider names the server's validation-integration converter accepts. */
const PROVIDERS = ['ZeroBounce', 'NeverBounce', 'Bouncer', 'MailgunValidate']

export default class EmailValidationSave extends BaseCommand {
  static description = `Create or update an email-validation integration

A campaign can check every address with it before sending
(\`email campaign create --validation-integration <id>\`). Put the provider's
credentials (for example {"apiKey": "..."}) in --config — inline JSON,
@file.json, or - for stdin — so the key does not land in your shell history.
Pass --id to update an existing integration.`

  static examples = ['<%= config.bin %> email validation save --provider ZeroBounce --name ZeroBounce --config @zerobounce.json']

  static flags = {
    provider: Flags.string({required: true, description: 'Validation provider', options: PROVIDERS}),
    name: Flags.string({required: true, description: 'Integration name'}),
    id: Flags.string({description: 'Integration ID — set it to update instead of create'}),
    disabled: Flags.boolean({description: 'Save it turned off', default: false}),
    config: Flags.string({description: 'Provider-specific fields as a JSON object, @file or -'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(EmailValidationSave)
    const client = this.client(flags)

    const extra = flags.config ? await readJsonObject(flags.config, 'config') : {}
    // The server reads `provider` as a name ("ZeroBounce"), not as the number
    // the generated TypeScript enum holds — so the body is cast.
    const integration = {
      ...extra,
      provider: flags.provider,
      integrationId: flags.id,
      integrationName: flags.name,
      isEnabled: !flags.disabled,
    }

    const res = await client.hub.notifications.saveEmailValidationIntegration({integration} as unknown as Parameters<
      typeof client.hub.notifications.saveEmailValidationIntegration
    >[0])

    this.print(res)
    return res
  }
}
