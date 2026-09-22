import {Norbix, NorbixError} from '@norbix.ai/ts'
import {Command, Flags} from '@oclif/core'

import {
  DEFAULT_API_URL,
  DEFAULT_HUB_URL,
  isSessionValid,
  readProfiles,
  readSession,
  type Profile,
} from './lib/profiles.js'
import {readStore, type StoredConfig} from './lib/store.js'

export interface GlobalFlags {
  project?: string
  env?: string
  region?: string
  'api-key'?: string
  account?: string
  profile?: string
}

export interface ResolvedContext {
  projectId?: string
  accountId?: string
  env?: string
  region?: string
  apiKey?: string
  bearerToken?: string
  apiUrl: string
  hubUrl: string
  /** True when api/hub use the default *.norbix.ai domains (then region is required). */
  usesDefaultEndpoints: boolean
  filesIntegrationId?: string
  /** Where the auth came from — shown by `whoami` so there is never mystery. */
  authSource: 'flag/env api key' | 'session' | `profile [${string}]` | 'legacy config' | 'none'
  profileName?: string
  userName?: string
  stored: StoredConfig
}

/**
 * Base class for every Norbix CLI command.
 *
 * Resolution order (most specific wins):
 *   1. command-line flags
 *   2. environment variables (NORBIX_*)
 *   3a. --profile / NORBIX_PROFILE set  → that profile from ~/.norbix/config
 *       ONLY. The login session is intentionally ignored: --profile means
 *       "act as exactly this identity", good for scripts.
 *   3b. no profile chosen → active login session (~/.norbix/session.json)
 *       wins; the [default] profile fills anything the session doesn't have;
 *       the legacy per-OS config.json is the last fallback.
 *
 * Default endpoints are https://api.norbix.ai and https://hub.norbix.ai;
 * a profile can override them (self-hosted, localhost, custom domain).
 */
export abstract class BaseCommand extends Command {
  static enableJsonFlag = true

  static baseFlags = {
    project: Flags.string({
      description: 'Project ID',
      env: 'NORBIX_PROJECT_ID',
      helpGroup: 'GLOBAL',
    }),
    env: Flags.string({
      description: 'Project environment (e.g. PROD, TEST)',
      env: 'NORBIX_ENV',
      helpGroup: 'GLOBAL',
    }),
    region: Flags.string({
      description: 'Region code (e.g. nb-eu-germany)',
      env: 'NORBIX_REGION',
      helpGroup: 'GLOBAL',
    }),
    'api-key': Flags.string({
      description: 'API key (overrides profile and session)',
      env: 'NORBIX_API_KEY',
      helpGroup: 'GLOBAL',
    }),
    account: Flags.string({
      description: 'Account ID (needed for account-scoped hub endpoints)',
      env: 'NORBIX_ACCOUNT_ID',
      helpGroup: 'GLOBAL',
    }),
    profile: Flags.string({
      description: 'Use this profile from ~/.norbix/config (ignores the login session)',
      env: 'NORBIX_PROFILE',
      helpGroup: 'GLOBAL',
    }),
  }

  protected readStore(): StoredConfig {
    return readStore(this.config.configDir)
  }

  protected resolveContext(flags: GlobalFlags): ResolvedContext {
    const profiles = readProfiles()
    const legacy = this.readStore()
    const explicitProfile = flags.profile

    let prof: Profile = {}
    let profileName: string | undefined
    let session: ReturnType<typeof readSession>

    if (explicitProfile) {
      prof = profiles[explicitProfile] ?? {}
      profileName = explicitProfile
      if (!profiles[explicitProfile]) {
        this.error(
          `Profile "${explicitProfile}" not found in ~/.norbix/config.\n` +
            `Run \`norbix configure --profile ${explicitProfile}\` to create it, or \`norbix profiles\` to list existing ones.`,
        )
      }
    } else {
      prof = profiles.default ?? {}
      profileName = profiles.default ? 'default' : undefined
      const s = readSession()
      if (isSessionValid(s)) session = s
    }

    const apiKeyOverride = flags['api-key']
    const bearerToken = apiKeyOverride ? undefined : session?.bearerToken
    const apiKey = apiKeyOverride ?? (bearerToken ? undefined : (prof.api_key ?? legacy.apiKey))

    const authSource: ResolvedContext['authSource'] = apiKeyOverride
      ? 'flag/env api key'
      : bearerToken
        ? 'session'
        : prof.api_key
          ? `profile [${profileName ?? 'default'}]`
          : legacy.apiKey
            ? 'legacy config'
            : 'none'

    const apiUrlBase =
      prof.api_url ?? (explicitProfile ? undefined : legacy.apiUrl) ?? DEFAULT_API_URL
    const hubUrlBase =
      prof.hub_url ?? (explicitProfile ? undefined : legacy.hubUrl) ?? DEFAULT_HUB_URL

    const region =
      flags.region ?? (explicitProfile ? prof.region : (session?.region ?? prof.region ?? legacy.region))

    // Region subdomain (api.norbix.ai → nb-eu-germany.api.norbix.ai) is only
    // composed for the default domains — a custom URL is never rewritten.
    const withRegion = (url: string, isDefault: boolean) =>
      isDefault && region ? url.replace('://', `://${region}.`) : url

    const usesDefaultEndpoints =
      apiUrlBase === DEFAULT_API_URL || hubUrlBase === DEFAULT_HUB_URL

    return {
      usesDefaultEndpoints,
      projectId:
        flags.project ??
        (explicitProfile ? prof.project_id : (session?.projectId ?? prof.project_id ?? legacy.projectId)),
      accountId:
        flags.account ??
        (explicitProfile ? prof.account_id : (session?.accountId ?? prof.account_id ?? legacy.accountId)),
      env: flags.env ?? (explicitProfile ? prof.env : (session?.env ?? prof.env ?? legacy.env)),
      region,
      apiKey,
      bearerToken,
      apiUrl: withRegion(apiUrlBase, apiUrlBase === DEFAULT_API_URL),
      hubUrl: withRegion(hubUrlBase, hubUrlBase === DEFAULT_HUB_URL),
      filesIntegrationId:
        prof.files_integration_id ?? (explicitProfile ? undefined : legacy.filesIntegrationId),
      authSource,
      profileName,
      userName: session?.userName,
      stored: legacy,
    }
  }

  /**
   * Rule: with the default *.norbix.ai endpoints a region is REQUIRED (the
   * real endpoint is <region>.api.norbix.ai). With custom endpoints
   * (localhost, self-hosted, custom domain) a region is optional.
   */
  protected assertEndpoints(ctx: ResolvedContext): void {
    if (ctx.usesDefaultEndpoints && !ctx.region) {
      this.error(
        'Region is required when using the default norbix.ai endpoints.\n' +
          'Set it with `norbix configure` (region field), pass --region <code> (e.g. nb-eu-germany),\n' +
          'or set custom api_url / hub_url in the profile for self-hosted installations.',
      )
    }
  }

  /** Build an SDK client from the resolved context. Errors politely when auth is missing. */
  protected client(flags: GlobalFlags, opts: {requireAuth?: boolean} = {}): Norbix {
    const ctx = this.resolveContext(flags)
    this.assertEndpoints(ctx)
    if (!ctx.projectId) {
      this.error(
        'No project ID configured.\nRun `norbix configure` (or `norbix login`), or pass --project.',
      )
    }

    if (opts.requireAuth !== false && !ctx.apiKey && !ctx.bearerToken) {
      this.error(
        'Not authenticated.\nRun `norbix login` (browser/user session) or `norbix configure` (API key profile), or pass --api-key.',
      )
    }

    return new Norbix(
      {
        projectId: ctx.projectId,
        accountId: ctx.accountId,
        apiKey: ctx.apiKey,
        bearerToken: ctx.bearerToken,
        env: ctx.env,
        region: ctx.region,
        // Always explicit: CLI defaults are api/hub.norbix.ai (the SDK's own
        // defaults still point at .dev — tracked as an SDK bug).
        baseUrl: {api: ctx.apiUrl, hub: ctx.hubUrl},
      },
      // The CLI already resolved env vars itself — don't let the SDK re-read them.
      {envSource: {}},
    )
  }

  /** Pretty-print a result unless --json is active (oclif prints the return value then). */
  protected print(data: unknown): void {
    if (!this.jsonEnabled()) {
      this.log(typeof data === 'string' ? data : JSON.stringify(data, null, 2))
    }
  }

  /**
   * One line for a failed call: `<errorCode>: <message> (HTTP <status>)`.
   *
   * The code comes first because it is the part a reader can search for and a
   * script can match on. It is the gateway's own code — the SDK reads it out
   * of `responseStatus.errors[]`, where the gateway puts it (10b-files slice
   * ERRORS, issue #66). The exit codes do not change.
   */
  protected async catch(error: Error & {exitCode?: number}): Promise<unknown> {
    if (error instanceof NorbixError) {
      const {code, status} = error as {code?: string; status?: number}
      const prefix = code ? `${code}: ` : ''
      // The SDK's last-resort message already ends in "(HTTP <status>)" —
      // do not say it twice.
      const suffix =
        status && !error.message.includes(`(HTTP ${status})`) ? ` (HTTP ${status})` : ''
      const hint =
        status === 401 ? '\nYour session may have expired. Run `norbix login` again.' : ''
      return this.error(`${prefix}${error.message}${suffix}${hint}`)
    }

    return super.catch(error)
  }
}
