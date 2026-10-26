import {Flags} from '@oclif/core'

import {BaseCommand} from '../base.js'
import {resolveHubEndpoint} from '../lib/hub-version.js'
import {
  clearPending,
  clearSession,
  findSession,
  listPendingKeys,
  listSessions,
  parseSessionKey,
  sessionPath,
  type Session,
} from '../lib/profiles.js'
import {revokeRequest, revokeSession, type RevokeOutcome} from '../lib/session-auth.js'
import {configFilePath, writeStore} from '../lib/store.js'

export default class Logout extends BaseCommand {
  static description = `Sign out: revoke and remove a browser sign-in from this machine.

Without --all only the sign-in this command would use is removed: the one of
the Hub and project named by --host / --profile / --project (or NORBIX_*),
else the [default] profile — a sign-in for another project or Hub stays.
--all revokes and removes every sign-in (~/.norbix/sessions). The AI service
user itself stays under Account → AI service users in the dashboard; remove
it there.

Profiles in ~/.norbix/config (API keys) are NEVER touched — manage those
with \`norbix configure\`, \`norbix config unset\` or by editing the file.`

  static examples = [
    '<%= config.bin %> logout',
    '<%= config.bin %> logout --project 66b2f0a1c3d4e5f6a7b8c9d0',
    '<%= config.bin %> logout --host cloud.example.com',
    '<%= config.bin %> logout --profile finlo',
    '<%= config.bin %> logout --all',
    '<%= config.bin %> logout --dry-run',
  ]

  static flags = {
    all: Flags.boolean({
      description: 'Sign out of every Hub and project on this machine',
      default: false,
    }),
    ...BaseCommand.dryRunFlags,
  }

  /** Signing out of everything needs no network discovery; one sign-in does (in `run`). */
  static discoversHost = false

  async run(): Promise<unknown> {
    const {flags} = await this.parse(Logout)

    let targets: Array<{key: string; hubKey: string; projectId?: string; session?: Session}>
    let where: string | undefined
    if (flags.all) {
      const sessions = listSessions()
      const pendingOnly = listPendingKeys().filter((k) => !sessions.some((s) => s.key === k))
      targets = [...sessions, ...pendingOnly.map((key) => ({key, ...parseSessionKey(key)}))]
    } else {
      await this.prepareHost(flags)
      const ctx = this.resolveContext(flags)
      const found = findSession(ctx.hubKey, ctx.requestedProjectId)
      const key = found?.key ?? ctx.sessionKey
      const projectId = found ? (found.projectId ?? found.session.projectId) : ctx.requestedProjectId
      where = `${new URL(ctx.host).host}${projectId ? ` for project ${projectId}` : ''}`
      targets = [{key, hubKey: ctx.hubKey, projectId, session: found?.session}]
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
          removes: targets.map((t) => sessionPath(t.key)),
          revokes,
          ...(flags.all ? {clearsTokensIn: configFilePath(this.config.configDir)} : {}),
        },
        ...(revokes[0] ? {http: {method: revokes[0].method, url: revokes[0].url, headers: {}, body: revokes[0].body}} : {}),
      })
    }

    // Revoke first, while the token is still on disk; a failure never blocks
    // the local logout.
    const results: Array<{hub: string; host?: string; projectId?: string; revoked: RevokeOutcome}> = []
    for (const [i, t] of targets.entries()) {
      const hub = hubs[i]
      if (!flags.all && !t.session && !listPendingKeys().includes(t.key)) continue
      const revoked: RevokeOutcome = t.session && hub ? await revokeSession(t.session, hub) : 'skipped'
      clearSession(t.key)
      clearPending(t.key)
      results.push({hub: t.hubKey, host: t.session?.host, projectId: t.projectId ?? t.session?.projectId, revoked})
    }

    if (flags.all) this.clearLegacyTokens()

    const lines =
      results.length === 0
        ? [
            flags.all
              ? 'Not signed in anywhere — nothing to remove.'
              : `Not signed in to ${where} — nothing to remove. Other sign-ins: \`norbix profiles\`; sign out of all of them: \`norbix logout --all\`.`,
          ]
        : results.map((r) =>
            [`Signed out of ${r.host ?? r.hub}${r.projectId ? ` (project ${r.projectId})` : ''}.`, revokeNote(r.revoked)]
              .filter(Boolean)
              .join(' '),
          )
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
