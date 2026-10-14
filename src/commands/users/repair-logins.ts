import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class UsersRepairLogins extends BaseCommand {
  static description = `Give logins stored without a project id the id of this project (when a role id or a contact of this project shows they belong to it)

Counts by default and writes nothing; add --apply to repair. Works in the
environment of the call: --apply needs a named environment (--env TEST, or
--env PROD on purpose). Project or account administrators only.`

  static examples = [
    '<%= config.bin %> users repair-logins --env TEST',
    '<%= config.bin %> users repair-logins --apply --env TEST --dry-run',
    '<%= config.bin %> users repair-logins --env PROD --apply',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    apply: Flags.boolean({description: 'Repair (default: count and write nothing)', default: false}),
  }

  /** The env rule applies to --apply only; the count is a read. */
  static envWrite = false

  async run(): Promise<unknown> {
    const {flags} = await this.parse(UsersRepairLogins)
    if (flags.apply) await this.assertWriteEnv(flags)
    // Typed SDK call once @norbix.ai/ts has the route.
    const res = await this.hubRequest<{result?: Record<string, unknown>}>(flags, {
      method: 'POST',
      path: '/membership/users/repair-logins',
      name: 'hub POST /membership/users/repair-logins',
      body: {dryRun: !flags.apply},
    })
    const result = res.result ?? {}
    this.print(
      [
        ...'loginsWithoutProject loginsToRepair loginsRepaired accountLoginsSkipped otherProjectLoginsSkipped loginsWithoutEvidence'.split(' ').map((k) => `${k.padEnd(28)} ${String(result[k] ?? 0)}`),
        '',
        flags.apply ? 'Repaired.' : 'Counted — nothing written. Repair with the same command and --apply.',
      ].join('\n'),
    )
    return result
  }
}
