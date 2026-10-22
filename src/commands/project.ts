import {Args} from '@oclif/core'

import {describeEnvAdminUrl, type EnvironmentAdminUrl, envAdminUrlCall, sendEnvAdminUrlCall, targetEnv} from '../lib/env-admin-url.js'
import {ProjectCommand} from '../lib/project.js'

export default class Project extends ProjectCommand {
  static description = `Show a project: name, languages, regions, CORS origins, admin portal, modules

Shows the configured project unless you pass another project ID. List every
project of the account with \`account projects\`. With --env (or --prod) it also
shows the admin portal address that environment's e-mail links open and where
it came from (environmentAdminUrl: environment / project / hosted / cloud).`

  static examples = [
    '<%= config.bin %> project',
    '<%= config.bin %> project --env TEST',
    '<%= config.bin %> project 66b2f0a1c3d4e5f6a7b8c9d0 --json',
  ]

  static args = {
    id: Args.string({description: 'Project ID (defaults to the configured project)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(Project)
    const {client, projectId} = this.projectClient(flags, args.id)

    const res = await client.hub.account.getProject({projectId})

    // N49 — the effective admin portal URL of the chosen environment. Only when
    // an env was asked for, so a plain `project` answers exactly as before.
    const ctx = await this.freshContext(flags)
    if (ctx.env && !flags['dry-run']) {
      const token = ctx.bearerToken ?? ctx.apiKey
      let environmentAdminUrl: EnvironmentAdminUrl | {env: string; error: string} | undefined
      if (token) {
        try {
          environmentAdminUrl = (await sendEnvAdminUrlCall(
            envAdminUrlCall({...ctx, projectId}, token, targetEnv(ctx), 'GET'),
          )).item
        } catch (error) {
          environmentAdminUrl = {env: targetEnv(ctx), error: (error as Error).message}
        }
      }

      const out = {...(res as object), environmentAdminUrl}
      this.print(out)
      if (environmentAdminUrl && !('error' in environmentAdminUrl) && !this.jsonEnabled()) {
        process.stderr.write(`${describeEnvAdminUrl(environmentAdminUrl)}\n`)
      }

      return out
    }

    this.print(res)
    return res
  }
}
