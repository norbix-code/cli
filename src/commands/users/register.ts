import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {usageError} from '../../lib/cli-error.js'
import {listOf, profileFlags, profileOf} from '../../lib/membership.js'

/** Which `register/*` route a set of flags means: the SDK method and the path it sends to. */
export type RegisterKind = 'email' | 'phone' | 'user-name' | 'guest' | 'service'

export const REGISTER_ROUTES: Record<string, {method: string; path: string}> = {
  email: {method: 'saveEmailUser', path: 'register/email'},
  'email+permissions': {method: 'saveEmailUserNameWithPermissions', path: 'register/email-with-permissions'},
  phone: {method: 'savePhoneUser', path: 'register/phone'},
  'phone+permissions': {method: 'savePhoneUserNameWithPermissions', path: 'register/phone-with-permissions'},
  'user-name': {method: 'saveUserNameUser', path: 'register/user-name'},
  'user-name+permissions': {method: 'saveUserNameWithPermissions', path: 'register/user-name-with-permissions'},
  guest: {method: 'saveGuestUser', path: 'register/guest'},
  service: {method: 'saveSystemUserWithPermissions', path: 'register/service'},
}

export default class UsersRegister extends BaseCommand {
  static description = `Create a login (a user who can sign in) with no invitation email

Pick one kind: --email, --phone, --user-name, --guest or --service.

  --email / --user-name need --password. Without --with-permissions it is the
    same sign-up an app does: the project's default role, or the --role roles
    the project allows at registration.
  --with-permissions (email, phone, user name): the admin route; the login
    gets exactly the --role roles (at least one) and the --tag tags.
  --service: a service user for scripts and integrations (at least one --role).
    Give it an API key with \`norbix users api-keys issue\`.
  --guest: an anonymous guest login.

The password is never printed, also not by --dry-run. To send an invitation
email instead, use \`norbix users invite\`.`

  static examples = [
    '<%= config.bin %> users register --email alice@example.com --password "$NEW_PASSWORD" --name "Alice Smith"',
    '<%= config.bin %> users register --email ops@example.com --password "$NEW_PASSWORD" --with-permissions --role Admin --tag staff',
    '<%= config.bin %> users register --phone +37060000000 --with-permissions --role Customer',
    '<%= config.bin %> users register --user-name alice --password "$NEW_PASSWORD" --dry-run',
    '<%= config.bin %> users register --service --name "Orders bot" --role Editor',
    '<%= config.bin %> users register --guest',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    email: Flags.string({description: 'Email login', exclusive: ['phone', 'user-name', 'guest', 'service']}),
    phone: Flags.string({description: 'Phone login, in international format', exclusive: ['email', 'user-name', 'guest', 'service']}),
    'user-name': Flags.string({description: 'User-name login', exclusive: ['email', 'phone', 'guest', 'service']}),
    guest: Flags.boolean({description: 'An anonymous guest login', default: false, exclusive: ['email', 'phone', 'user-name', 'service']}),
    service: Flags.boolean({description: 'A service user (no password; give it an API key)', default: false, exclusive: ['email', 'phone', 'user-name', 'guest']}),
    password: Flags.string({description: 'Password for --email or --user-name (or set NORBIX_USER_PASSWORD)', env: 'NORBIX_USER_PASSWORD'}),
    'with-permissions': Flags.boolean({description: 'Admin route: give exactly the --role roles and the --tag tags', default: false}),
    role: Flags.string({description: 'Role name or role ID (repeat for several, or a comma list)', multiple: true}),
    tag: Flags.string({description: 'Tag (with --with-permissions or --service; repeat for several)', multiple: true}),
    'skip-default-role': Flags.boolean({description: "Do not add the project's default registration role", default: false}),
    ...profileFlags,
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(UsersRegister)
    const kind: RegisterKind | undefined = flags.email
      ? 'email'
      : flags.phone
        ? 'phone'
        : flags['user-name']
          ? 'user-name'
          : flags.guest
            ? 'guest'
            : flags.service
              ? 'service'
              : undefined
    if (!kind) throw usageError('Pass one of --email, --phone, --user-name, --guest or --service.')

    const roles = listOf(flags.role)
    const tags = listOf(flags.tag)
    const admin = kind === 'service' || flags['with-permissions']
    if (flags['with-permissions'] && (kind === 'guest' || kind === 'service')) {
      throw usageError(`--with-permissions works with --email, --phone or --user-name, not --${kind}.`)
    }

    if (admin && !roles) throw usageError(`${kind === 'service' ? '--service' : '--with-permissions'} needs at least one --role.`)
    if (!admin && tags) throw usageError('--tag needs --with-permissions or --service.')
    if (!admin && roles && (kind === 'phone' || kind === 'guest')) {
      throw usageError(`--role with --${kind} needs --with-permissions.`, kind === 'guest' ? 'A guest gets the project\'s guest role.' : undefined)
    }

    if ((kind === 'email' || kind === 'user-name') && !flags.password) {
      throw usageError(`--${kind} needs --password (or NORBIX_USER_PASSWORD).`)
    }

    const profile = profileOf(flags)
    const request: Record<string, unknown> = {
      ignoreUserRegistersAsRole: flags['skip-default-role'],
      ...(Object.keys(profile).length > 0 ? {userGeneralInfo: profile} : {}),
      ...(kind === 'email' ? {email: flags.email, password: flags.password} : {}),
      ...(kind === 'user-name' ? {userName: flags['user-name'], password: flags.password} : {}),
      ...(kind === 'phone' ? {phone: flags.phone} : {}),
      ...(roles ? {roles} : {}),
      ...(tags ? {tags} : {}),
    }

    const route = REGISTER_ROUTES[admin && kind !== 'service' ? `${kind}+permissions` : kind]
    const client = this.client(flags)
    const membership = client.api.membership as unknown as Record<string, (r: unknown) => Promise<unknown>>
    const res = (await membership[route.method](request)) as {id?: string} | undefined

    this.print(res?.id ? `Login ${res.id} created.` : 'Login created.')
    return res
  }
}
