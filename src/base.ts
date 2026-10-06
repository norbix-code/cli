import {Norbix} from '@norbix.ai/ts'
import {Command, Flags, ux} from '@oclif/core'

import {CliError, formatErrorText, toEnvelope, usageError} from './lib/cli-error.js'
import {EXIT} from './lib/exit-codes.js'
import {cleanVersion, resolveHubEndpoint, splitVersionedUrl, type HubEndpoint} from './lib/hub-version.js'
import {
  DEFAULT_API_URL,
  DEFAULT_HUB_URL,
  isSessionRefreshable,
  isSessionUsable,
  readProfiles,
  readSession,
  type Profile,
  type Session,
} from './lib/profiles.js'
import {SessionRefresher} from './lib/session-auth.js'
import {readStore, type StoredConfig} from './lib/store.js'

/** One link of the SDK's transport middleware chain. */
type NorbixMiddleware = (ctx: {
  url: string
  init: RequestInit
  attempt: number
  next: () => Promise<Response>
}) => Promise<Response>

/** Stands in for a projectId the SDK constructor insists on; never sent. */
const NO_PROJECT_PLACEHOLDER = 'no-project'

/** Removes the project headers the SDK adds for the placeholder projectId. */
export const dropProjectHeaders = async (ctx: {
  init: RequestInit
  next: () => Promise<Response>
}): Promise<Response> => {
  const headers = new Headers(ctx.init.headers)
  headers.delete('norbix-project-id')
  headers.delete('X-CM-ProjectId')
  ctx.init.headers = headers
  return ctx.next()
}

export interface GlobalFlags {
  project?: string
  env?: string
  region?: string
  'api-key'?: string
  account?: string
  profile?: string
  'dry-run'?: boolean
  yes?: boolean
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
  /**
   * The login session in use (authSource 'session'). Holds tokens: read
   * fields from it, never print or return it whole.
   */
  session?: Session
  /**
   * Hub version set by hand (`NORBIX_HUB_VERSION`, profile `hub_version`) or
   * taken from a Hub URL that ends in `/vN`; else undefined (discovered from /echo).
   */
  hubVersion?: string
  /** API version from an API URL that ends in `/vN`; else undefined (the SDK default). */
  apiVersion?: string
  /** The Hub / API base URL when it is not the default norbix.ai one (no region, no version). */
  customEndpoints: {api?: string; hub?: string}
  stored: StoredConfig
}

/** The HTTP request a dry run would have sent (Authorization redacted). */
export interface DryRunRequest {
  method: string
  url: string
  headers: Record<string, string>
  body?: unknown
}

/** What `--dry-run` prints: the SDK call and the HTTP request behind it. */
export interface DryRunReport {
  dryRun: true
  /** `api.membership.deleteUser` — or a local action like `config.set`. */
  method: string
  request: unknown
  http?: DryRunRequest
}

/** Thrown by the dry-run middleware instead of sending; caught in `catch`. */
class DryRunStop extends Error {
  constructor(readonly http: DryRunRequest) {
    super('dry run')
    this.name = 'DryRunStop'
  }
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
 *
 * Agent contract (docs/agent-contract.md): never hang, never act silently,
 * one JSON document on stdout with --json, documented exit codes.
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

  /** Flags of a command that changes something but needs no confirmation (create, update, archive). */
  static dryRunFlags = {
    'dry-run': Flags.boolean({
      description: 'Resolve context and print the request that would be sent; send nothing',
      default: false,
    }),
  }

  /** Flags of a destructive command (delete, stop, regenerate, block, disable): confirmation + dry run. */
  static mutatingFlags = {
    yes: Flags.boolean({
      char: 'y',
      description: 'Skip the confirmation prompt (required in non-interactive shells)',
      default: false,
    }),
    ...BaseCommand.dryRunFlags,
  }

  /** The SDK call captured by a dry run, filled by the client proxy. */
  private dryRunCall?: {method: string; request: unknown}

  protected readStore(): StoredConfig {
    return readStore(this.config.configDir)
  }

  /** The id of this command as the user types it: `users delete`. */
  protected get commandName(): string {
    return (this.id ?? '').replaceAll(':', ' ')
  }

  /**
   * True only when a human can answer a prompt: both stdout and stdin are a
   * terminal, not CI, not --json. Anything else is an agent or a script.
   */
  protected isInteractive(): boolean {
    return Boolean(process.stdout.isTTY && process.stdin.isTTY) && !process.env.CI && !this.jsonEnabled()
  }

  /**
   * Ask before a destructive call. `--yes` skips it; a dry run needs none;
   * a non-interactive shell without `--yes` fails with exit 3 and sends
   * nothing; "no" at the prompt exits 9.
   */
  protected async confirmOrFail(message: string, flags: {yes?: boolean; 'dry-run'?: boolean}): Promise<void> {
    if (flags.yes || flags['dry-run']) return
    if (!this.isInteractive()) {
      throw new CliError({
        exit: EXIT.CONFIRMATION_REQUIRED,
        code: 'CONFIRMATION_REQUIRED',
        message: `Confirmation required: ${message}`,
        hint: 'Re-run with --yes. Preview first with --dry-run.',
        docs: `norbix ${this.commandName} --help`,
      })
    }

    const {confirm} = await import('@inquirer/prompts')
    if (!(await confirm({message, default: false}))) {
      throw new CliError({exit: EXIT.CANCELLED, code: 'CANCELLED', message: 'Cancelled.'})
    }
  }

  /**
   * Report a dry run of a LOCAL action (config write, file write) — SDK calls
   * are captured automatically by `client()`. Prints the report and returns
   * it, so the command can `return this.dryRun(...)`.
   */
  protected dryRun(call: {method: string; request: unknown; http?: DryRunRequest}): DryRunReport {
    const report: DryRunReport = {dryRun: true, method: call.method, request: call.request}
    if (call.http) report.http = call.http
    this.printDryRun(report)
    return report
  }

  private printDryRun(report: DryRunReport): void {
    if (this.jsonEnabled()) return // oclif prints the returned value
    const lines = [`Dry run — nothing was sent.`, `Would call: ${report.method}`]
    if (report.http) {
      lines.push(`  ${report.http.method} ${report.http.url}`)
      if (report.http.body !== undefined) lines.push(`  body: ${JSON.stringify(report.http.body)}`)
    }

    lines.push(`Request: ${JSON.stringify(report.request, null, 2)}`)
    this.log(lines.join('\n'))
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
        throw usageError(
          `Profile "${explicitProfile}" not found in ~/.norbix/config.`,
          `Run \`norbix configure --profile ${explicitProfile}\` to create it, or \`norbix profiles\` to list existing ones.`,
          'norbix profiles --help',
        )
      }
    } else {
      prof = profiles.default ?? {}
      profileName = profiles.default ? 'default' : undefined
      const s = readSession()
      // An expired access token is still usable when it can be refreshed.
      if (isSessionUsable(s)) session = s
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

    // Endpoints: an explicit --profile's own URL wins; then NORBIX_API_URL /
    // NORBIX_HUB_URL; then (no --profile) the URL a browser sign-in was made
    // against, the [default] profile, the legacy config; then norbix.ai.
    const envApiUrl = process.env.NORBIX_API_URL?.trim() || undefined
    const envHubUrl = process.env.NORBIX_HUB_URL?.trim() || undefined
    const apiUrlRaw = explicitProfile
      ? (prof.api_url ?? envApiUrl ?? DEFAULT_API_URL)
      : (envApiUrl ?? session?.apiUrl ?? prof.api_url ?? legacy.apiUrl ?? DEFAULT_API_URL)
    const hubUrlRaw = explicitProfile
      ? (prof.hub_url ?? envHubUrl ?? DEFAULT_HUB_URL)
      : (envHubUrl ?? session?.hubUrl ?? prof.hub_url ?? legacy.hubUrl ?? DEFAULT_HUB_URL)

    // A URL may be given with its version (`https://hub.example.com/v3`) or
    // without; the SDK adds the version itself, so it is split off here.
    const {base: apiUrlBase, version: apiUrlVersion} = splitVersionedUrl(apiUrlRaw)
    const {base: hubUrlBase, version: hubUrlVersion} = splitVersionedUrl(hubUrlRaw)

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
      session: bearerToken ? session : undefined,
      hubVersion: cleanVersion(process.env.NORBIX_HUB_VERSION) ?? cleanVersion(prof.hub_version) ?? hubUrlVersion,
      apiVersion: apiUrlVersion,
      customEndpoints: {
        api: apiUrlBase === DEFAULT_API_URL ? undefined : apiUrlBase,
        hub: hubUrlBase === DEFAULT_HUB_URL ? undefined : hubUrlBase,
      },
      stored: legacy,
    }
  }

  private hubEndpoints = new Map<string, Promise<HubEndpoint>>()
  private refresher?: SessionRefresher

  /** The Hub base + version for calls the CLI makes without the SDK (sign-in, refresh, revoke). */
  protected hubEndpoint(ctx: ResolvedContext): Promise<HubEndpoint> {
    const key = `${ctx.hubUrl}|${ctx.hubVersion ?? ''}|${ctx.session?.hubVersion ?? ''}`
    let hub = this.hubEndpoints.get(key)
    if (!hub) {
      hub = resolveHubEndpoint(ctx.hubUrl, {explicit: ctx.hubVersion, stored: ctx.session?.hubVersion})
      this.hubEndpoints.set(key, hub)
    }

    return hub
  }

  /** One refresher per run, when the session in use can refresh its token. */
  protected sessionRefresher(ctx: ResolvedContext): SessionRefresher | undefined {
    if (ctx.authSource !== 'session' || !isSessionRefreshable(ctx.session)) return undefined
    this.refresher ??= new SessionRefresher(ctx.session, () => this.hubEndpoint(ctx))
    return this.refresher
  }

  /**
   * `resolveContext` for commands that call `fetch` themselves: the session
   * token is refreshed first when it is about to expire. A dry run sends
   * nothing, so it refreshes nothing.
   */
  protected async freshContext(flags: GlobalFlags): Promise<ResolvedContext> {
    const ctx = this.resolveContext(flags)
    const refresher = flags['dry-run'] ? undefined : this.sessionRefresher(ctx)
    return refresher ? {...ctx, bearerToken: await refresher.ensureFresh()} : ctx
  }

  /**
   * Rule: with the default *.norbix.ai endpoints a region is REQUIRED (the
   * real endpoint is <region>.api.norbix.ai). With custom endpoints
   * (localhost, self-hosted, custom domain) a region is optional.
   */
  protected assertEndpoints(ctx: ResolvedContext): void {
    if (ctx.usesDefaultEndpoints && !ctx.region) {
      throw usageError(
        'Region is required when using the default norbix.ai endpoints.',
        'Set it with `norbix configure` (region field), pass --region <code> (e.g. nb-eu-germany), ' +
          'or set custom api_url / hub_url in the profile for self-hosted installations.',
        'norbix configure --help',
      )
    }
  }

  /**
   * Build an SDK client from the resolved context. Errors politely when auth is missing.
   *
   * `requireAuth: false` — the call may go out without a login (a signed link is the key);
   * a login, when there is one, is still used.
   * `requireProject: false` — the call does not need a project (a signed link carries it).
   * The SDK constructor still demands a projectId, so a placeholder is passed and the
   * project headers are taken off the wire again: the gateway never sees a fake project.
   *
   * With `--dry-run` the client is real up to the socket: auth, region and
   * project are resolved exactly as for a live call, the SDK builds the
   * request, and a middleware stops it just before `fetch`. `catch` then
   * prints the request and exits 0.
   */
  protected client(
    flags: GlobalFlags,
    opts: {requireAuth?: boolean; requireProject?: boolean} = {},
  ): Norbix {
    const ctx = this.resolveContext(flags)
    this.assertEndpoints(ctx)
    const noProject = !ctx.projectId && opts.requireProject === false
    if (!ctx.projectId && !noProject) {
      throw usageError(
        'No project ID configured.',
        'Run `norbix configure` (or `norbix login`), pass --project <id>, or set NORBIX_PROJECT_ID.',
        'norbix configure --help',
      )
    }

    if (opts.requireAuth !== false && !ctx.apiKey && !ctx.bearerToken) {
      throw new CliError({
        exit: EXIT.AUTH,
        code: 'UNAUTHENTICATED',
        message: 'Not authenticated.',
        hint: 'Run `norbix login` (browser/user session) or `norbix configure` (API key profile), pass --api-key, or set NORBIX_API_KEY.',
        docs: 'norbix login --help',
      })
    }

    // The last middleware runs first: a dry run stops before any refresh.
    const middleware: NorbixMiddleware[] = noProject ? [dropProjectHeaders] : []
    const refresher = this.sessionRefresher(ctx)
    if (refresher) middleware.push(sessionMiddleware(refresher))
    if (flags['dry-run']) middleware.push(dryRunMiddleware)

    const client = new Norbix(
      {
        projectId: noProject ? NO_PROJECT_PLACEHOLDER : ctx.projectId,
        middleware,
        accountId: ctx.accountId,
        apiKey: ctx.apiKey,
        bearerToken: ctx.bearerToken,
        env: ctx.env,
        region: ctx.region,
        // Always explicit: CLI defaults are api/hub.norbix.ai (the SDK's own
        // defaults still point at .dev — tracked as an SDK bug).
        baseUrl: {api: ctx.apiUrl, hub: ctx.hubUrl},
        // Only when known (a /vN in the URL, NORBIX_HUB_VERSION, hub_version);
        // otherwise the SDK default, unchanged.
        ...(ctx.hubVersion ? {hubVersion: ctx.hubVersion} : {}),
        ...(ctx.apiVersion ? {apiVersion: ctx.apiVersion} : {}),
        // A dry run stops in the middleware; the SDK must not retry it.
        ...(flags['dry-run'] ? {retry: {maxRetries: 0}} : {}),
        // A 401 on a browser sign-in: refresh once and retry the call.
        ...(refresher && !flags['dry-run'] ? {refreshBearerToken: () => refresher.afterUnauthorized()} : {}),
      },
      // The CLI already resolved env vars itself — don't let the SDK re-read them.
      {envSource: {}},
    )

    return flags['dry-run'] ? this.recordingClient(client) : client
  }

  /** Wrap `client.api.*` / `client.hub.*` so a dry run knows which SDK method was called. */
  private recordingClient(client: Norbix): Norbix {
    const record = (target: 'api' | 'hub') =>
      new Proxy(client[target] as unknown as Record<string, unknown>, {
        get: (namespace, moduleName: string) => {
          const mod = namespace[moduleName]
          if (typeof mod !== 'object' || mod === null) return mod
          return new Proxy(mod as Record<string, unknown>, {
            get: (m, methodName: string) => {
              const fn = m[methodName]
              if (typeof fn !== 'function') return fn
              return (request: unknown = {}, ...rest: unknown[]) => {
                this.dryRunCall = {method: `${target}.${moduleName}.${methodName}`, request}
                return (fn as (...a: unknown[]) => unknown)(request, ...rest)
              }
            },
          })
        },
      })

    return new Proxy(client, {
      get: (c, prop: string | symbol) => {
        if (prop === 'api' || prop === 'hub') return record(prop)
        return (c as unknown as Record<string | symbol, unknown>)[prop]
      },
    })
  }

  /** Pretty-print a result unless --json is active (oclif prints the return value then). */
  protected print(data: unknown): void {
    if (!this.jsonEnabled()) {
      this.log(typeof data === 'string' ? data : JSON.stringify(data, null, 2))
    }
  }

  /** Plain JSON on stdout: no theme, no ANSI codes, one document. */
  protected logJson(json: unknown): void {
    ux.stdout(JSON.stringify(json, null, 2))
  }

  /**
   * Every failure ends here and becomes the one error envelope
   * (docs/agent-contract.md): `{"error": {...}}` on stdout with --json,
   * `Error: ... / Hint: ...` on stderr otherwise. The exit code is the same
   * in both modes. A dry run is "caught" here too: it is the middleware
   * stopping the request, and exits 0.
   */
  protected async catch(error: Error & {exitCode?: number}): Promise<unknown> {
    // The SDK wraps whatever its middleware throws into a network error, so
    // the dry-run stop arrives as `raw` of that wrapper.
    const stop = error instanceof DryRunStop ? error : dryRunStopOf(error)
    if (stop) {
      const report: DryRunReport = {
        dryRun: true,
        method: this.dryRunCall?.method ?? 'unknown',
        request: this.dryRunCall?.request ?? {},
        http: stop.http,
      }
      if (this.jsonEnabled()) this.logJson(report)
      else this.printDryRun(report)
      return report
    }

    // `this.exit(n)` — already decided, nothing to print.
    if ((error as {code?: string}).code === 'EEXIT') throw error

    // A CLI error raised inside the SDK's middleware (an ended sign-in)
    // arrives wrapped as a network error: report the CLI error itself.
    const raw = (error as {raw?: unknown}).raw
    const envelope = toEnvelope(raw instanceof CliError ? raw : error, {command: this.commandName})
    if (this.jsonEnabled()) {
      this.logJson({error: envelope})
    } else {
      process.stderr.write(formatErrorText(envelope) + '\n')
    }

    // Rethrow the original error with the exit code attached: oclif's
    // handler then exits with it and prints nothing more (the envelope was
    // the output), and a test still sees the real error.
    const marked = error as Error & {oclif?: {exit?: number}; skipOclifErrorHandling?: boolean}
    marked.oclif = {...marked.oclif, exit: envelope.exit}
    marked.skipOclifErrorHandling = true
    throw marked
  }
}

function dryRunStopOf(error: unknown): DryRunStop | undefined {
  const raw = (error as {raw?: unknown} | undefined)?.raw
  return raw instanceof DryRunStop ? raw : undefined
}

/** Sends the session's current token, refreshed first when it is about to expire. */
function sessionMiddleware(refresher: SessionRefresher): NorbixMiddleware {
  return async (ctx) => {
    const headers = new Headers(ctx.init.headers)
    if (headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${await refresher.ensureFresh()}`)
      ctx.init.headers = headers
    }

    return ctx.next()
  }
}

/** Stops the SDK just before `fetch` and hands the request back to `catch`. */
async function dryRunMiddleware(ctx: {url: string; init: RequestInit; next: () => Promise<Response>}): Promise<Response> {
  const headers: Record<string, string> = {}
  new Headers(ctx.init.headers).forEach((value, key) => {
    headers[key] = key.toLowerCase() === 'authorization' ? 'Bearer ***' : value
  })
  let body: unknown
  if (typeof ctx.init.body === 'string') {
    try {
      body = JSON.parse(ctx.init.body)
    } catch {
      body = ctx.init.body
    }
  }

  throw new DryRunStop({method: ctx.init.method ?? 'GET', url: ctx.url, headers, body})
}
