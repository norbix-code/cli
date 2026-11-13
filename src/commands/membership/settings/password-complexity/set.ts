import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'
import {usageError} from '../../../../lib/cli-error.js'
import {READ_FIRST_DRY_RUN, nothingRead} from '../../../../lib/membership.js'

const LIMITS = [
  ['min-length', 'minLength', 'Shortest password'],
  ['max-length', 'maxLength', 'Longest password'],
  ['min-numbers', 'minNumbers', 'Fewest digits'],
  ['max-numbers', 'maxNumbers', 'Most digits'],
  ['min-upper', 'minUpper', 'Fewest capital letters'],
  ['max-upper', 'maxUpper', 'Most capital letters'],
  ['min-lower', 'minLower', 'Fewest small letters'],
  ['max-lower', 'maxLower', 'Most small letters'],
  ['min-special', 'minSpecial', 'Fewest symbols'],
  ['max-special', 'maxSpecial', 'Most symbols'],
] as const

export default class MembershipSettingsPasswordComplexitySet extends BaseCommand {
  static description = `Change the password rules

The gateway replaces all the rules at once, so the command reads them first
and changes only what you pass. New rules apply at once to every sign-up and
password change.

${READ_FIRST_DRY_RUN}`

  static examples = [
    '<%= config.bin %> membership settings password-complexity set --min-length 12',
    '<%= config.bin %> membership settings password-complexity set --min-upper 1 --min-numbers 1 --min-special 1 --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    ...Object.fromEntries(LIMITS.map(([flag, , description]) => [flag, Flags.integer({description, min: 0})])),
    'allowed-special': Flags.string({description: 'The symbols a password may use, e.g. "!@#$%"'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(MembershipSettingsPasswordComplexitySet)
    const values = flags as unknown as Record<string, number | string | undefined>
    const changes: Record<string, number | string> = {}
    for (const [flag, field] of LIMITS) if (values[flag] !== undefined) changes[field] = values[flag] as number
    if (flags['allowed-special'] !== undefined) changes.allowedSpecial = flags['allowed-special']
    if (Object.keys(changes).length === 0) throw usageError('Pass at least one rule to change, e.g. --min-length 12.')

    const client = this.client(flags)
    let current: Record<string, unknown> = {}
    if (!flags['dry-run']) {
      const read = await client.hub.membership.getAuthorizationSettings({})
      if (!read?.result) throw nothingRead('password rules', 'Check the project and --env, then try again.')
      // No rules saved yet: the gateway's default is a minimum length of 8.
      current = {minLength: 8, ...read.result.passwordComplexity}
    }

    const res = await client.hub.membership.updatePasswordComplexity({...current, ...changes} as never)
    this.print('Password rules saved.')
    return res
  }
}
