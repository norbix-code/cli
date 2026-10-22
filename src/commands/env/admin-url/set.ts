import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {EnvAdminUrlCommand} from '../../../lib/env-admin-url-command.js'

export default class EnvAdminUrlSet extends EnvAdminUrlCommand {
  static description = `Give the --env environment its own admin portal address

Use it when each environment runs its own admin portal (the portal started with
ENV=TEST on test-admin.…, ENV=PROD on admin.…). Password-reset, magic-link and
invitation e-mails sent in that environment then open this address, so the
portal confirms in the environment the link was made in. The address must be
https with a host and an optional path (no query). Its origin is allowed
through CORS automatically — do not add it to the project origins. Promotion
never copies it. \`env admin-url clear\` goes back to the project admin URL.`

  static examples = [
    '<%= config.bin %> env admin-url set https://test-admin.example.com --env TEST',
    '<%= config.bin %> env admin-url set https://admin.example.com --prod',
    '<%= config.bin %> env admin-url set https://test-admin.example.com --env TEST --dry-run',
  ]

  static args = {
    url: Args.string({required: true, description: 'Admin portal address, e.g. https://test-admin.example.com'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EnvAdminUrlSet)
    return this.writeAdminUrl(flags, args.url)
  }
}
