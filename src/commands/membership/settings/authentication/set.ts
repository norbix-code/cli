import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'
import {usageError} from '../../../../lib/cli-error.js'
import {boolFlag, boolOf} from '../../../../lib/membership.js'

/** `Name=https://…` → `{name, logoutUrl}`; a usage error otherwise. */
export function parseMode(value: string): {name: string; logoutUrl: string} {
  const at = value.indexOf('=')
  if (at <= 0) throw usageError(`--mode-logout-url must look like Name=URL, got "${value}".`)
  return {name: value.slice(0, at).trim(), logoutUrl: value.slice(at + 1).trim()}
}

export default class MembershipSettingsAuthenticationSet extends BaseCommand {
  static description = `Change the sign-in settings

The gateway replaces all of them at once, so the command reads them first and
changes only what you pass. A --mode-logout-url changes that one mode; the
other modes keep their URLs.`

  static examples = [
    '<%= config.bin %> membership settings authentication set --logout-url https://app.example.com/bye',
    '<%= config.bin %> membership settings authentication set --allow-usernames true --dry-run',
    '<%= config.bin %> membership settings authentication set --mode-logout-url Passkey=https://app.example.com/bye',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    'logout-url': Flags.string({description: 'Where users go after they log out'}),
    'allow-usernames': boolFlag('Let users sign in with a user name as well as an email'),
    'mode-logout-url': Flags.string({description: 'Logout URL of one sign-in mode, as Name=URL (repeatable)', multiple: true}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(MembershipSettingsAuthenticationSet)
    const allowUsernames = boolOf(flags['allow-usernames'])
    const modes = (flags['mode-logout-url'] ?? []).map((m) => parseMode(m))
    if (flags['logout-url'] === undefined && allowUsernames === undefined && modes.length === 0) {
      throw usageError('Pass --logout-url, --allow-usernames or --mode-logout-url.')
    }

    // Read with a live client: a dry run must still show the merged settings.
    const reader = this.client({...flags, 'dry-run': false})
    const current = (await reader.hub.membership.getAuthenticationSettings({})).result?.credentialsSettings
    const merged = new Map((current?.modes ?? []).map((m) => [m.name ?? '', {name: m.name, logoutUrl: m.logoutUrl}]))
    for (const m of modes) merged.set(m.name, m)

    const client = this.client(flags)
    const logoutUrl = flags['logout-url'] ?? current?.logoutUrl
    const res = await client.hub.membership.updateAuthenticationSettings({
      ...(logoutUrl === undefined ? {} : {logoutUrl}),
      allowUsernames: allowUsernames ?? current?.allowUsernames ?? false,
      modes: [...merged.values()],
    })
    this.print('Sign-in settings saved.')
    return res
  }
}
