import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class UsersRepairRoles extends BaseCommand {
  static description = `Give contacts with no roles the roles their logins have

Run it once per environment (--env). A PREVIEW is the default: the gateway
only counts what would change. Only --yes writes. Safe to run again.`

  static examples = [
    '<%= config.bin %> users repair roles --env TEST',
    '<%= config.bin %> users repair roles --env TEST --dry-run --json',
    '<%= config.bin %> users repair roles --env TEST --yes',
  ]

  static flags = {
    'dry-run': Flags.boolean({description: 'Preview only (the default): nothing changes', default: false, exclusive: ['yes']}),
    yes: Flags.boolean({char: 'y', description: 'Repair for real (without it you get the preview)', default: false}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(UsersRepairRoles)
    const dryRun = !flags.yes
    const client = this.client({...flags, 'dry-run': false})

    const res = await client.hub.membership.repairContactRoles({dryRun})
    this.print(res)
    if (dryRun && !this.jsonEnabled()) this.log('Preview — nothing was written. Run again with --yes to repair.')
    return res
  }
}
