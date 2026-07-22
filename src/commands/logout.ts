import {BaseCommand} from '../base.js'
import {clearSession} from '../lib/profiles.js'
import {writeStore} from '../lib/store.js'

export default class Logout extends BaseCommand {
  static description = `Remove the login session from this machine.

Profiles in ~/.norbix/config (API keys) are NOT touched — manage those with
\`norbix configure\` or by editing the file.`

  static examples = ['<%= config.bin %> logout']

  async run(): Promise<unknown> {
    await this.parse(Logout)

    clearSession()

    // Also clear tokens from the legacy per-OS config location.
    const stored = this.readStore()
    writeStore(this.config.configDir, {
      ...stored,
      bearerToken: undefined,
      refreshToken: undefined,
      userId: undefined,
      userName: undefined,
    })

    this.print('Logged out. Session removed.')
    return {loggedOut: true}
  }
}
