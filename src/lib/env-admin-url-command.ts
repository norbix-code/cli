import {BaseCommand, type GlobalFlags} from '../base.js'
import {
  describeEnvAdminUrl,
  type EnvironmentAdminUrl,
  envAdminUrlCall,
  sendEnvAdminUrlCall,
  targetEnv,
} from './env-admin-url.js'

/** Base of `env admin-url set|clear|show`: the env is --env / --prod / the saved default, else PROD. */
export abstract class EnvAdminUrlCommand extends BaseCommand {
  /** Reads the env's admin URL (own / effective / source). */
  protected async readAdminUrl(flags: GlobalFlags): Promise<EnvironmentAdminUrl> {
    const {ctx, token, env} = await this.target(flags)
    try {
      const item = (await sendEnvAdminUrlCall(envAdminUrlCall(ctx, token, env, 'GET'))).item
      if (item) return item
    } catch (error) {
      this.error((error as Error).message)
    }

    this.error(`The hub answered no admin URL for ${env}.`)
  }

  /** Sets (url) or clears ('') the env's admin URL, then reads it back. */
  protected async writeAdminUrl(flags: GlobalFlags, url: string): Promise<unknown> {
    const {ctx, token, env} = await this.target(flags)
    const call = envAdminUrlCall(ctx, token, env, 'PATCH', url)

    if (flags['dry-run']) {
      return this.dryRun({
        method: url ? 'env admin-url set' : 'env admin-url clear',
        request: call.body,
        http: {method: call.method, url: call.url, headers: {...call.headers, Authorization: 'Bearer ***'}, body: call.body},
      })
    }

    try {
      await sendEnvAdminUrlCall(call)
    } catch (error) {
      this.error((error as Error).message)
    }

    // Read it back: the answer says where the links point now (and why).
    const now = await this.readAdminUrl(flags)
    this.show(now)
    return now
  }

  protected show(item: EnvironmentAdminUrl): void {
    this.print(this.jsonEnabled() ? item : describeEnvAdminUrl(item))
  }

  private async target(flags: GlobalFlags) {
    const ctx = await this.freshContext(flags)
    this.assertEndpoints(ctx)
    if (!ctx.projectId) this.error('No project ID configured. Run `norbix login` or pass --project.')
    const token = ctx.bearerToken ?? ctx.apiKey
    if (!token) this.error('Not authenticated. Run `norbix login` or pass --api-key.')
    return {ctx, token, env: targetEnv(ctx)}
  }
}
