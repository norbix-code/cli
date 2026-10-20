import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {REPAIR_PATH, renderRepair, type BuiltInRepairEnv, type RepairBody} from '../../../lib/promotion.js'

/** The SDK transport of a module (the repair route is not in the SDK yet; same auth, env rule and retry). */
type Transport = {send: (call: Record<string, unknown>) => Promise<unknown>}

export default class EnvBuiltInsRepair extends BaseCommand {
  static description = `Give every environment PROD's built-in e-mail / push / SMS templates and the "Default" footer and signature, under PROD's ids

Run it when a promotion preview shows built-in templates (Password reset, New user verification, …) as added, deleted or matched by name. Idempotent: built-ins already there are "present"; an environment's own copy with the same name takes PROD's id ("realigned", its content is kept); a missing one is copied from PROD ("created").

A PREVIEW is the default (--dry-run says it explicitly). A real run needs --yes. Without --target every environment except PROD is repaired.`

  static examples = [
    '<%= config.bin %> env built-ins repair',
    '<%= config.bin %> env built-ins repair --target TEST --dry-run --json',
    '<%= config.bin %> env built-ins repair --yes',
  ]

  static flags = {
    target: Flags.string({description: 'Repair only this environment (default: every environment except PROD)'}),
    'dry-run': Flags.boolean({
      description: 'Preview only (the default): nothing changes',
      default: false,
      exclusive: ['yes'],
    }),
    yes: Flags.boolean({char: 'y', description: 'Repair for real (without it you get the preview)', default: false}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(EnvBuiltInsRepair)
    const dryRun = !flags.yes
    const body: RepairBody = {dryRun, ...(flags.target ? {environmentName: flags.target.trim().toUpperCase()} : {})}
    const client = this.client({...flags, 'dry-run': false})
    const transport = (client.hub.environments as unknown as {transport: Transport}).transport
    const res = (await transport.send({
      target: 'hub',
      path: REPAIR_PATH,
      method: 'POST',
      request: body,
      pathParams: [],
      scope: 'project',
    })) as {items?: BuiltInRepairEnv[]}

    if (!this.jsonEnabled()) this.log(renderRepair(res.items ?? [], dryRun))
    return res
  }
}
