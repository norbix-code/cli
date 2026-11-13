import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'
import {usageError} from '../../../../lib/cli-error.js'
import {boolFlag, boolOf, listOf} from '../../../../lib/membership.js'

export default class MembershipSettingsAuthorizationSet extends BaseCommand {
  static description = `Change the registration settings

Only the settings you pass change; the gateway keeps the others. A role list
replaces the old list; --clear-default-roles / --clear-registration-roles empty
it. When you pass --allow-guests alone, the current guest clean-up days are
sent with it, so they do not change (not on --dry-run, which sends nothing).`

  static examples = [
    '<%= config.bin %> membership settings authorization set --default-role Customer',
    '<%= config.bin %> membership settings authorization set --invite-only true --anyone-can-sign-up false',
    '<%= config.bin %> membership settings authorization set --allow-guests true --guest-cleanup-days 30 --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    'default-role': Flags.string({description: 'Role a new user gets when they name none (repeat, or a comma list)', multiple: true, exclusive: ['clear-default-roles']}),
    'clear-default-roles': Flags.boolean({description: 'New users get no role by default', default: false}),
    'registration-role': Flags.string({description: 'Role a user may pick at sign-up (repeat, or a comma list)', multiple: true, exclusive: ['clear-registration-roles']}),
    'clear-registration-roles': Flags.boolean({description: 'Users may pick no role at sign-up', default: false}),
    'allow-guests': boolFlag('Allow guest (anonymous) users'),
    'guest-cleanup-days': Flags.integer({description: 'Remove inactive guests after this many days (0 = never)', min: 0}),
    'email-registration': boolFlag('Let people sign up with an email on the public route'),
    'invite-only': boolFlag('Refuse public sign-up; only invitations make users'),
    'anyone-can-sign-up': boolFlag('Let anyone sign up (the Guest role may register)'),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(MembershipSettingsAuthorizationSet)
    const request: Record<string, unknown> = {}
    const defaultRoles = flags['clear-default-roles'] ? [] : listOf(flags['default-role'])
    const registrationRoles = flags['clear-registration-roles'] ? [] : listOf(flags['registration-role'])
    if (defaultRoles) request.defaultRoles = defaultRoles
    if (registrationRoles) request.allowedRegistrationRoles = registrationRoles
    const allowGuests = boolOf(flags['allow-guests'])
    if (allowGuests !== undefined) request.allowGuestUsers = allowGuests
    if (flags['guest-cleanup-days'] !== undefined) request.guestCleanupPeriodDays = flags['guest-cleanup-days']
    for (const [flag, field] of [
      ['email-registration', 'allowEmailRegistration'],
      ['invite-only', 'inviteOnly'],
      ['anyone-can-sign-up', 'allowAnyoneToSignUp'],
    ] as const) {
      const value = boolOf(flags[flag])
      if (value !== undefined) request[field] = value
    }

    if (Object.keys(request).length === 0) throw usageError('Pass at least one setting to change, e.g. --invite-only true.')

    const client = this.client(flags)
    if (allowGuests !== undefined && flags['guest-cleanup-days'] === undefined && !flags['dry-run']) {
      // The gateway takes the clean-up days together with allowGuestUsers (none = never): keep the current value.
      const days = (await client.hub.membership.getAuthorizationSettings({})).result?.guestCleanupPeriodDays
      if (days !== undefined && days !== null) request.guestCleanupPeriodDays = days
    }

    // The SDK types needVerification, allowInviteUsers, allowDeactivateUsers, defaultSubscribeToNews and
    // minLength as required; the gateway ignores them when no `setting` is sent, so none is sent.
    const res = await client.hub.membership.updateAuthorizationSettings(request as never)
    this.print('Registration settings saved.')
    return res
  }
}
