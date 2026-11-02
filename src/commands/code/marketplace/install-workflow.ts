import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {CliError, toEnvelope} from '../../../lib/cli-error.js'
import {parseReferences, REFERENCE_REFUSED, wantedReferences} from '../../../lib/marketplace.js'
import {formatWorkflow} from '../../../lib/workflows.js'

export default class CodeMarketplaceInstallWorkflow extends BaseCommand {
  static description = `Beta: install a workflow listing as a draft

Fills the listing's references and saves a new workflow's draft in the current environment: nothing runs and nothing is published. Give one --ref key=value for every reference the listing declares (read them with code marketplace listings <ml_…>): a collection name, a template id, an integration id. A --ref that is not key=value is refused before anything is sent. When the gateway refuses a missing or undeclared reference (CM-ERRORS-MARKETPLACE-036) the listing is read once and the hint names what it wants. A connector listing is CM-ERRORS-MARKETPLACE-035: enable it instead.`

  static examples = [
    '<%= config.bin %> code marketplace install-workflow ml_workflow_order_thanks_v1 --ref orders=orders --ref thanks=tmpl_3TKDGIwDEpWXROwKr2PBut --ref emailIntegration=int_1R5izfi0g6MuSGs4VnUMnp',
    '<%= config.bin %> code marketplace install-workflow ml_workflow_order_thanks_v1 --ref orders=orders --name "Thank customers" --identity usr_2R5So1Lbfc7MNr5lkY522S --env TEST --dry-run',
  ]

  static args = {
    listing: Args.string({required: true, description: 'Listing ID (ml_…) of kind Workflow'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    ref: Flags.string({description: 'A reference the listing declares: key=value (repeat for each)', multiple: true}),
    name: Flags.string({description: "The new workflow's name; default: the listing's"}),
    identity: Flags.string({description: "The execution identity (usr_…); default: the environment's"}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeMarketplaceInstallWorkflow)
    const references = parseReferences(flags.ref)
    const client = this.client(flags)

    try {
      const res = await client.hub.code.installMarketplaceWorkflow({
        listingViewId: args.listing,
        name: flags.name,
        executionIdentityId: flags.identity,
        references,
      } as Parameters<typeof client.hub.code.installMarketplaceWorkflow>[0])

      const id = res?.workflow?.workflowId
      this.print(`${formatWorkflow('installed as a draft', res)}\nNothing ran. When it is ready: norbix code workflows publish ${id}`)
      return res
    } catch (error) {
      const envelope = toEnvelope(error, {command: 'code marketplace install-workflow'})
      if (envelope.code !== REFERENCE_REFUSED) throw error

      // Only here, after a refusal, is the listing read: a successful install is one call.
      const hint = await client.hub.code
        .getMarketplaceListing({listingViewId: args.listing})
        .then((found) => wantedReferences(found?.listing))
        .catch(() => undefined)
      throw hint ? new CliError({...envelope, hint}) : error
    }
  }
}
