import {BaseCommand} from '../base.js'
import {PROFILES_PATH, SESSIONS_DIR, isSessionRefreshable, isSessionValid, listSessions, readProfiles, sessionPath} from '../lib/profiles.js'
import {redact} from '../lib/store.js'

export default class Profiles extends BaseCommand {
  static description = 'List profiles from ~/.norbix/config (keys redacted) and every sign-in on this machine — which Hub and project each is for'

  static examples = ['<%= config.bin %> profiles', '<%= config.bin %> profiles --json']

  static discoversHost = false

  async run(): Promise<unknown> {
    await this.parse(Profiles)
    const profiles = readProfiles()

    const display = Object.fromEntries(
      Object.entries(profiles).map(([name, p]) => [
        name,
        {...p, host: p.host ?? (p.hub_url ? undefined : 'hub.norbix.ai'), api_key: redact(p.api_key)},
      ]),
    )

    // One browser sign-in per Hub and project; never its tokens.
    const signedIn = listSessions().map(({key, hubKey, projectId, session}) => ({
      hub: hubKey,
      host: session.host ?? hubKey,
      hubUrl: session.hubUrl,
      user: session.displayName ?? session.userName ?? session.userId,
      /** The project the sign-in is for (none: made with no project, usable for any). */
      projectId: projectId ?? session.projectId,
      file: sessionPath(key),
      valid: isSessionValid(session),
      refreshes: isSessionRefreshable(session),
      expiresAt: session.expiresAt,
    }))

    this.print({
      file: PROFILES_PATH,
      profiles: display,
      signedIn: signedIn.length > 0 ? signedIn : `(none — run \`norbix login\`; sessions live in ${SESSIONS_DIR})`,
    })
    return {profiles: display, signedIn}
  }
}
