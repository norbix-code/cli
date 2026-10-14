import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class UsersRepairRoles extends BaseCommand {
  static description = `Give contacts with no role the roles their logins hold (repair of the [null] roles of sign-ups before 2.2.0, client finding N20)

Counts by default and writes nothing; add --apply to repair. Works in the
environment of the call: --apply needs a named environment (--env TEST, or
--env PROD on purpose). Project or account administrators only.`

  static examples = [
    '<%= config.bin %> users repair-roles --env TEST',
    '<%= config.bin %> users repair-roles --apply --env TEST --dry-run',
    '<%= config.bin %> users repair-roles --env PROD --apply',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    apply: Flags.boolean({description: 'Repair (default: count and write nothing)', default: false}),
  }

  /** The env rule applies to --apply only; the count is a read. */
  static envWrite = false

  async run(): Promise<unknown> {
    const {flags} = await this.parse(UsersRepairRoles)
    if (flags.apply) await this.assertWriteEnv(flags)
    // Typed SDK call once @norbix.ai/ts has the route.
    const res = await this.hubRequest<{result?: Record<string, unknown>}>(flags, {
      method: 'POST',
      path: '/membership/users/repair-roles',
      name: 'hub POST /membership/users/repair-roles',
      body: {dryRun: !flags.apply},
    })
    const result = res.result ?? {}
    this.print(
      [
        ...'contactsWithoutRoles contactsToRepair contactsRepaired contactsWithoutLoginRoleIds legacyRoleNamesIgnored'.split(' ').map((k) => `${k.padEnd(28)} ${String(result[k] ?? 0)}`),
        '',
        flags.apply ? 'Repaired.' : 'Counted — nothing written. Repair with the same command and --apply.',
      ].join('\n'),
    )
    return result
  }
}
