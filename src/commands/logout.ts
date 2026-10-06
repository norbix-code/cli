import {BaseCommand} from '../base.js'
import {SESSION_PATH, clearSession, readSession} from '../lib/profiles.js'
import {revokeRequest, revokeSession, type RevokeOutcome} from '../lib/session-auth.js'
import {configFilePath, writeStore} from '../lib/store.js'

export default class Logout extends BaseCommand {
  static description = `Remove the login session from this machine.

After a browser sign-in the refresh token is also revoked on the Hub, so the
session cannot be used anywhere. The AI service user itself stays under
Account → AI service users in the dashboard; remove it there.

Profiles in ~/.norbix/config (API keys) are NOT touched — manage those with
\`norbix configure\` or by editing the file.`

  static examples = ['<%= config.bin %> logout', '<%= config.bin %> logout --dry-run']

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(Logout)
    const session = readSession()
    const ctx = session ? this.resolveContext({...flags, profile: undefined}) : undefined
    const hub = session?.refreshToken && session.clientId && ctx ? await this.hubEndpoint({...ctx, session}) : undefined

    if (flags['dry-run']) {
      const revoke = session && hub ? revokeRequest(session, hub) : undefined
      return this.dryRun({
        method: 'logout',
        request: {removes: SESSION_PATH, clearsTokensIn: configFilePath(this.config.configDir)},
        ...(revoke ? {http: {method: revoke.method, url: revoke.url, headers: {}, body: revoke.body}} : {}),
      })
    }

    // Revoke first, while the token is still on disk; a failure never blocks
    // the local logout.
    const revoked: RevokeOutcome = session && hub ? await revokeSession(session, hub) : 'skipped'
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

    this.print(['Logged out. Session removed.', revokeNote(revoked)].filter(Boolean).join('\n'))
    return {loggedOut: true, revoked}
  }
}

function revokeNote(outcome: RevokeOutcome): string | undefined {
  switch (outcome) {
    case 'revoked':
      return 'The sign-in was revoked on the Hub. The AI service user stays in the dashboard (Account → AI service users) until you remove it.'
    case 'unsupported':
      return 'This Hub cannot revoke a sign-in; it ends when its refresh token runs out. Remove the AI service user in the dashboard (Account → AI service users) to end it now.'
    case 'failed':
      return 'Could not revoke the sign-in on the Hub. Remove the AI service user in the dashboard (Account → AI service users) to end it now.'
    default:
      return undefined
  }
}
