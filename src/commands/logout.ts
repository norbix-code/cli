import {BaseCommand} from '../base.js'
import {resolveHubEndpoint} from '../lib/hub-version.js'
import {
  clearPending,
  clearSession,
  listPendingKeys,
  listSessions,
  readSession,
  sessionPath,
  type Session,
} from '../lib/profiles.js'
import {revokeRequest, revokeSession, type RevokeOutcome} from '../lib/session-auth.js'
import {configFilePath, writeStore} from '../lib/store.js'

export default class Logout extends BaseCommand {
  static description = `Sign out: revoke and remove browser sign-ins from this machine.

Without flags every host's sign-in is revoked on its Hub and removed
(~/.norbix/sessions). With --host or --profile only the sign-in of that
host's Hub is. The AI service user itself stays under Account → AI service
users in the dashboard; remove it there.

Profiles in ~/.norbix/config (API keys) are NEVER touched — manage those
with \`norbix configure\`, \`norbix config unset\` or by editing the file.`

  static examples = [
    '<%= config.bin %> logout',
    '<%= config.bin %> logout --host cloud.example.com',
    '<%= config.bin %> logout --profile finlo',
    '<%= config.bin %> logout --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  /** Signing out of everything needs no network discovery; one host does (in `run`). */
  static discoversHost = false

  async run(): Promise<unknown> {
    const {flags} = await this.parse(Logout)
    const oneHost = Boolean(flags.host || flags.profile)

    let targets: Array<{hubKey: string; session?: Session}>
    if (oneHost) {
      await this.prepareHost(flags)
      const {hubKey} = this.resolveContext(flags)
      targets = [{hubKey, session: readSession(hubKey)}]
    } else {
      const sessions = listSessions()
      const pendingOnly = listPendingKeys().filter((k) => !sessions.some((s) => s.hubKey === k))
      targets = [...sessions, ...pendingOnly.map((hubKey) => ({hubKey}))]
    }

    // Refresh and revoke go to the Hub that issued the token, stored with it.
    const hubs = await Promise.all(
      targets.map(async (t) =>
        t.session?.refreshToken && t.session.clientId && t.session.hubUrl
          ? resolveHubEndpoint(t.session.hubUrl, {stored: t.session.hubVersion})
          : undefined,
      ),
    )

    if (flags['dry-run']) {
      const revokes = targets.flatMap((t, i) => {
        const hub = hubs[i]
        const r = t.session && hub ? revokeRequest(t.session, hub) : undefined
        return r ? [r] : []
      })
      return this.dryRun({
        method: 'logout',
        request: {
          removes: targets.map((t) => sessionPath(t.hubKey)),
          revokes,
          ...(oneHost ? {} : {clearsTokensIn: configFilePath(this.config.configDir)}),
        },
        ...(revokes[0] ? {http: {method: revokes[0].method, url: revokes[0].url, headers: {}, body: revokes[0].body}} : {}),
      })
    }

    // Revoke first, while the token is still on disk; a failure never blocks
    // the local logout.
    const results: Array<{hub: string; host?: string; revoked: RevokeOutcome}> = []
    for (const [i, t] of targets.entries()) {
      const hub = hubs[i]
      const revoked: RevokeOutcome = t.session && hub ? await revokeSession(t.session, hub) : 'skipped'
      clearSession(t.hubKey)
      clearPending(t.hubKey)
      results.push({hub: t.hubKey, host: t.session?.host, revoked})
    }

    if (!oneHost) this.clearLegacyTokens()

    const lines =
      results.length === 0
        ? ['Not signed in anywhere — nothing to remove.']
        : results.map((r) => [`Signed out of ${r.host ?? r.hub}.`, revokeNote(r.revoked)].filter(Boolean).join(' '))
    this.print(lines.join('\n'))
    return {loggedOut: true, sessions: results, revoked: results[0]?.revoked ?? 'skipped'}
  }

  /** Tokens of CLI 1.16 and older in the per-OS config file. */
  private clearLegacyTokens(): void {
    const stored = this.readStore()
    if (!stored.bearerToken && !stored.refreshToken && !stored.userId && !stored.userName) return
    writeStore(this.config.configDir, {
      ...stored,
      bearerToken: undefined,
      refreshToken: undefined,
      userId: undefined,
      userName: undefined,
    })
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
