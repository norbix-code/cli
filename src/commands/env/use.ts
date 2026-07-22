import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {isSessionValid, readProfiles, readSession, writeProfile, writeSession} from '../../lib/profiles.js'
import {writeStore} from '../../lib/store.js'

export default class EnvUse extends BaseCommand {
  static description = `Set the default environment for future commands.

Written to the active session when you are logged in; with --profile it is
written into that profile in ~/.norbix/config; otherwise to the [default]
profile. Override per command with --env.`

  static examples = [
    '<%= config.bin %> env use TEST',
    '<%= config.bin %> env use PROD',
    '<%= config.bin %> env use STAGING --profile fitskin-prod',
  ]

  static args = {
    name: Args.string({required: true, description: 'Environment name (e.g. PROD, TEST)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EnvUse)

    if (flags.profile) {
      const prof = readProfiles()[flags.profile]
      if (!prof) this.error(`Profile "${flags.profile}" not found. Run \`norbix configure --profile ${flags.profile}\` first.`)
      writeProfile(flags.profile, {...prof, env: args.name})
      this.print(`Profile [${flags.profile}] now defaults to environment ${args.name}.`)
      return {env: args.name, profile: flags.profile}
    }

    const session = readSession()
    if (isSessionValid(session)) {
      writeSession({...session, env: args.name})
      this.print(`Session now targets environment ${args.name}.`)
      return {env: args.name, target: 'session'}
    }

    const prof = readProfiles().default
    if (prof) {
      writeProfile('default', {...prof, env: args.name})
      this.print(`Profile [default] now defaults to environment ${args.name}.`)
      return {env: args.name, profile: 'default'}
    }

    // Last resort: legacy config location.
    writeStore(this.config.configDir, {...this.readStore(), env: args.name})
    this.print(`Default environment set to ${args.name}.`)
    return {env: args.name, target: 'legacy'}
  }
}
