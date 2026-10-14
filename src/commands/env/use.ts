import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {writeProjectConfig} from '../../lib/project-config.js'
import {PROFILES_PATH, isSessionUsable, readProfiles, readSession, sessionPath, writeProfile, writeSession} from '../../lib/profiles.js'

export default class EnvUse extends BaseCommand {
  static description = `Set the default environment for future commands.

Written, in this order of preference: with --profile into that profile in
~/.norbix/config; inside a repo set up by \`norbix ai init\` into its
.norbix/project.json (so the repo remembers it — commit it); else into the
browser session of the host when you are signed in there; otherwise into the
[default] profile (created when missing). Override per command with --env.`

  static examples = [
    '<%= config.bin %> env use TEST',
    '<%= config.bin %> env use PROD',
    '<%= config.bin %> env use STAGING --profile fitskin-prod',
    '<%= config.bin %> env use TEST --dry-run',
  ]

  static args = {
    name: Args.string({required: true, description: 'Environment name (e.g. PROD, TEST)'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EnvUse)
    const dry = (target: string, file: string) =>
      this.dryRun({method: 'env.use', request: {env: args.name, target, file}})

    if (flags.profile) {
      const prof = readProfiles()[flags.profile]
      if (!prof) this.error(`Profile "${flags.profile}" not found. Run \`norbix configure --profile ${flags.profile}\` first.`)
      if (flags['dry-run']) return dry(`profile [${flags.profile}]`, PROFILES_PATH)
      writeProfile(flags.profile, {...prof, env: args.name})
      this.print(`Profile [${flags.profile}] now defaults to environment ${args.name}.`)
      return {env: args.name, profile: flags.profile}
    }

    const {hubKey, projectFile} = this.resolveContext(flags)
    if (projectFile) {
      if (flags['dry-run']) return dry('project file', projectFile.path)
      writeProjectConfig(projectFile.path, {...projectFile.config, env: args.name.toUpperCase()})
      this.print(`This repo (${projectFile.path}) now targets environment ${args.name.toUpperCase()}.`)
      return {env: args.name.toUpperCase(), target: 'project file', file: projectFile.path}
    }

    const session = readSession(hubKey)
    if (isSessionUsable(session)) {
      if (flags['dry-run']) return dry('session', sessionPath(hubKey))
      writeSession(hubKey, {...session, env: args.name})
      this.print(`Session now targets environment ${args.name}.`)
      return {env: args.name, target: 'session'}
    }

    if (flags['dry-run']) return dry('profile [default]', PROFILES_PATH)
    writeProfile('default', {...readProfiles().default, env: args.name})
    this.print(`Profile [default] now defaults to environment ${args.name}.`)
    return {env: args.name, profile: 'default'}
  }
}
