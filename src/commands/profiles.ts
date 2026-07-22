import {BaseCommand} from '../base.js'
import {PROFILES_PATH, isSessionValid, readProfiles, readSession} from '../lib/profiles.js'
import {redact} from '../lib/store.js'

export default class Profiles extends BaseCommand {
  static description = 'List profiles from ~/.norbix/config (keys redacted) and the active session'

  static examples = ['<%= config.bin %> profiles']

  async run(): Promise<unknown> {
    await this.parse(Profiles)
    const profiles = readProfiles()
    const session = readSession()

    const display = Object.fromEntries(
      Object.entries(profiles).map(([name, p]) => [
        name,
        {...p, api_key: redact(p.api_key)},
      ]),
    )

    const sessionInfo = session
      ? {
          user: session.userName ?? session.userId,
          projectId: session.projectId,
          valid: isSessionValid(session),
        }
      : undefined

    this.print({file: PROFILES_PATH, profiles: display, session: sessionInfo ?? '(none — run `norbix login`)'})
    return {profiles: display, session: sessionInfo}
  }
}
