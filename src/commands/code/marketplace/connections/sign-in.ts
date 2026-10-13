import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'
import {canOpenBrowser, openBrowser} from '../../../../lib/device-login.js'

export default class CodeMarketplaceConnectionsSignIn extends BaseCommand {
  static description = `Start the OAuth sign-in of an MCP connection

Prints the vendor's sign-in link (authorizeUrl). Open it, approve the app, and the vendor sends the browser back to the gateway, which stores the tokens on the connection. --open also opens the link in this machine's browser (never over SSH or without a desktop). The link works once and only until the time shown. Then run \`connections get\` to see signedIn, or \`connections validate\`. The vendor app must allow the redirect URL shown.`

  static examples = [
    '<%= config.bin %> code marketplace connections sign-in int_7Hq2mcpServerGh1Xz9Lw',
    '<%= config.bin %> code marketplace connections sign-in int_7Hq2mcpServerGh1Xz9Lw --open',
    '<%= config.bin %> code marketplace connections sign-in int_7Hq2mcpServerGh1Xz9Lw --json',
  ]

  static args = {
    id: Args.string({required: true, description: 'MCP connection ID (int_…)'}),
  }

  static flags = {
    open: Flags.boolean({default: false, description: 'Also open the sign-in link in the browser'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeMarketplaceConnectionsSignIn)
    const client = this.client(flags)

    const res = await client.hub.code.startMarketplaceIntegrationSignIn({integrationViewId: args.id})

    const start = (res ?? {}) as {authorizeUrl?: string; redirectUrl?: string; expiresAt?: string}
    const lines = [
      'Open this link to sign in:',
      start.authorizeUrl ?? '(the gateway sent no link)',
      '',
      ...(start.expiresAt ? [`The link works once, until ${start.expiresAt}.`] : []),
      ...(start.redirectUrl ? [`Redirect URL (the vendor app must allow it): ${start.redirectUrl}`] : []),
      `Then check it: norbix code marketplace connections get ${args.id}`,
    ]
    this.print(lines.join('\n'))
    if (flags.open && start.authorizeUrl && canOpenBrowser()) openBrowser(start.authorizeUrl)
    return res
  }
}
