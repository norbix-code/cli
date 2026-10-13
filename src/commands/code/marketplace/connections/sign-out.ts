import {Args} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'
import {revokeOutcome} from '../../../../lib/marketplace.js'

export default class CodeMarketplaceConnectionsSignOut extends BaseCommand {
  static description = `Sign an MCP connection out of OAuth

Deletes the stored sign-in (the vendor tokens) of the connection and asks the vendor to revoke the token when it can. Prints whether the connection was signed in and what happened to the token: revoked, no revocation endpoint at the vendor, or the revoke failed (the token is deleted here in every case). Calls that need the sign-in fail until \`connections sign-in\` is run again.`

  static examples = [
    '<%= config.bin %> code marketplace connections sign-out int_7Hq2mcpServerGh1Xz9Lw',
    '<%= config.bin %> code marketplace connections sign-out int_7Hq2mcpServerGh1Xz9Lw --dry-run',
    '<%= config.bin %> code marketplace connections sign-out int_7Hq2mcpServerGh1Xz9Lw --json',
  ]

  static args = {
    id: Args.string({required: true, description: 'MCP connection ID (int_…)'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeMarketplaceConnectionsSignOut)
    const client = this.client(flags)

    const res = await client.hub.code.signOutMarketplaceIntegration({integrationViewId: args.id})

    const out = (res ?? {}) as {wasSignedIn?: boolean; revoke?: string | null}
    this.print(
      out.wasSignedIn
        ? `Connection ${args.id} signed out: ${revokeOutcome(out.revoke)}.`
        : `Connection ${args.id} was not signed in; nothing to sign out.`,
    )
    return res
  }
}
