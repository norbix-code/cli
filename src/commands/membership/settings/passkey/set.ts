import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'
import {usageError} from '../../../../lib/cli-error.js'
import {READ_FIRST_DRY_RUN, boolFlag, boolOf, nothingRead} from '../../../../lib/membership.js'

export default class MembershipSettingsPasskeySet extends BaseCommand {
  static description = `Change the passkey sign-in settings

The gateway replaces all of them at once, so the command reads them first and
changes only what you pass. Changing --rp-id makes every passkey already made
stop working, so it asks first.

${READ_FIRST_DRY_RUN}`

  static examples = [
    '<%= config.bin %> membership settings passkey set --enabled true',
    '<%= config.bin %> membership settings passkey set --code-ttl-minutes 10 --magic-link-recovery true --dry-run',
    '<%= config.bin %> membership settings passkey set --rp-id app.example.com --yes',
  ]

  static flags = {
    ...BaseCommand.mutatingFlags,
    enabled: boolFlag('Turn email + passkey sign-in on or off'),
    'code-ttl-minutes': Flags.integer({description: 'How long an email code works, in minutes (3-15)', min: 3, max: 15}),
    'max-credentials': Flags.integer({description: 'Most passkeys one user may have (1-20)', min: 1, max: 20}),
    'recovery-codes': Flags.integer({description: 'Recovery codes made at sign-up (5-20)', min: 5, max: 20}),
    'recovery-codes-at-signup': boolFlag('Make recovery codes at sign-up'),
    authenticator: Flags.string({description: 'Which authenticators are accepted', options: ['Any', 'Platform', 'CrossPlatform']}),
    'magic-link-recovery': boolFlag('Let users get back in with an email link'),
    'refresh-token-days': Flags.integer({description: 'How long a sign-in lasts, in days (7-90)', min: 7, max: 90}),
    'rp-id': Flags.string({description: 'WebAuthn RP ID, a bare host name such as app.example.com'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(MembershipSettingsPasskeySet)
    const changes: Record<string, unknown> = {}
    const bools = [
      ['enabled', 'enabled'],
      ['recovery-codes-at-signup', 'generateRecoveryCodesAtSignup'],
      ['magic-link-recovery', 'allowMagicLinkRecovery'],
    ] as const
    for (const [flag, field] of bools) {
      const value = boolOf(flags[flag])
      if (value !== undefined) changes[field] = value
    }

    const others = [
      ['code-ttl-minutes', 'codeTtlMinutes'],
      ['max-credentials', 'maxCredentialsPerUser'],
      ['recovery-codes', 'recoveryCodeCount'],
      ['authenticator', 'authenticatorAttachment'],
      ['refresh-token-days', 'refreshTokenTtlDays'],
      ['rp-id', 'rpId'],
    ] as const
    for (const [flag, field] of others) if (flags[flag] !== undefined) changes[field] = flags[flag]
    if (Object.keys(changes).length === 0) throw usageError('Pass at least one setting to change, e.g. --enabled true.')

    const client = this.client(flags)
    let current: Record<string, unknown> = {}
    if (!flags['dry-run']) {
      const read = await client.hub.membership.getPasskeySettings({})
      if (!read?.result) throw nothingRead('passkey settings', 'Check the project and --env, then try again.')
      current = read.result as unknown as Record<string, unknown>
    }

    if (flags['rp-id'] !== undefined && flags['rp-id'] !== (current as {rpId?: string}).rpId) {
      await this.confirmOrFail(`Change the RP ID to ${flags['rp-id']}? Every passkey made so far stops working.`, flags)
    }

    const res = await client.hub.membership.savePasskeySettings({...current, ...changes} as never)
    this.print('Passkey settings saved.')
    return res
  }
}
