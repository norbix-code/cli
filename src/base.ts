import {Norbix} from '@norbix.ai/ts'
import {Command, Flags, ux} from '@oclif/core'

import {CliError, formatErrorText, toEnvelope, usageError} from './lib/cli-error.js'
import {EXIT} from './lib/exit-codes.js'
import {
  DEFAULT_HOST,
  cachedHost,
  cachedProjectRegion,
  fetchProjectRegion,
  saveProjectRegion,
  forgetHost,
  hostKey,
  isDefaultHost,
  normalizeHost,
  regionalEndpoints,
  resolveHost,
  type HostInfo,
} from './lib/hosts.js'
import {cleanVersion, resolveHubEndpoint, splitVersionedUrl, type HubEndpoint} from './lib/hub-version.js'
import {
  DEFAULT_API_URL,
  DEFAULT_HUB_URL,
  isSessionRefreshable,
  isSessionUsable,
  readProfiles,
  readSession,
  writeSession,
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

/** One project of the account, as the "no project" hint and `login` show it. */
export interface ProjectChoice {
  id: string
  name?: string
  /** The project's primary region code (e.g. nb-eu-germany), when the Hub sent it. */
  region?: string
}

/** What `adoptOnlyProject` did: saved the one project, or found none / several. */
export interface ProjectAdoption {
  state: 'saved' | 'one' | 'several' | 'none' | 'not checked'
  projects: ProjectChoice[]
  projectId?: string
  /** The saved project's region (norbix.ai only). */
  region?: string
}

/** "No project ID configured" — `catch` adds the account's projects to its hint. */
class NoProjectError extends CliError {
  constructor(readonly flags: GlobalFlags) {
    super({
      exit: EXIT.USAGE,
      code: 'USAGE_ERROR',
      message: 'No project ID configured.',
      hint: 'Run `norbix login` (or `norbix configure`), pass --project <id>, set NORBIX_PROJECT_ID, or save one: norbix config set project_id <id>.',
      docs: 'norbix account projects --help',
    })
  }
}

/** Stands in for a projectId the SDK constructor insists on; never sent. */
const NO_PROJECT_PLACEHOLDER = 'no-project'

/** Removes the project headers the SDK adds for the placeholder projectId. */
export const dropProjectHeaders = async (ctx: {
  init: RequestInit
  next: () => Promise<Response>
}): Promise<Response> => {
  const headers = new Headers(ctx.init.headers)
  headers.delete('norbix-project-id')
  ctx.init.headers = headers
  return ctx.next()
}

export interface GlobalFlags {
  host?: string
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
  /** Api / Hub base URLs for the calls (regional when a region is set), no version. */
  apiUrl: string
  hubUrl: string
  /** The host the CLI was pointed at, as an origin: `https://cloud.finlo.space`. */
  host: string
  /** Where the host came from. */
  hostSource: 'flag/env' | `profile [${string}]` | 'deprecated url' | 'default'
  /** The Hub's key — the name of its session file: `hub.finlo.space`. */
  hubKey: string
  /** What discovery learned about the Hub; undefined when nothing is known yet. */
  hostInfo?: HostInfo
  /** The Hub that signs in, refreshes and revokes (not regional), no version. */
  authHubUrl: string
  /** Deprecated settings in use (profile api_url / hub_url, NORBIX_API_URL / NORBIX_HUB_URL). */
  deprecations: string[]
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
  /** Only for commands whose input the Hub can check without writing (schema bundles). */
  validation?: DryRunValidation
}

/** The Hub's read-only check of a dry run's input (`validateSchema`). */
export interface DryRunValidation {
  /** `hub.account.validateSchema` — or why nothing was checked. */
  checkedWith?: string
  checked: boolean
  valid?: boolean
  issues?: Array<{where?: string; code?: string; message?: string}>
  collections?: string[]
  /** Why the input was not checked (no bundleJson, the check failed). */
  note?: string
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
 * Resolution (AUTH_DESIGN.md):
 *   profile  --profile / NORBIX_PROFILE, else [default] (when it is for the
 *            same host).
 *   host     --host / NORBIX_HOST → profile `host` → deprecated api_url /
 *            hub_url → hub.norbix.ai. Discovery (lib/hosts.ts) turns it into
 *            the Hub and Api addresses; it runs in `init`, so `resolveContext`
 *            stays synchronous.
 *   auth     --api-key / NORBIX_API_KEY → profile api_key → the browser
 *            session of that host's Hub (~/.norbix/sessions/<hub>.json) →
 *            the old per-OS config.json.
 *   values   flags / NORBIX_* → profile → session → old config.json.
 *
 * Agent contract (docs/agent-contract.md): never hang, never act silently,
 * one JSON document on stdout with --json, documented exit codes.
 */
export abstract class BaseCommand extends Command {
  static enableJsonFlag = true

  static baseFlags = {
    host: Flags.string({
      description: 'Norbix host: your dashboard or Hub address (default hub.norbix.ai)',
      env: 'NORBIX_HOST',
      helpGroup: 'GLOBAL',
    }),
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
      description: 'Use this profile from ~/.norbix/config',
      env: 'NORBIX_PROFILE',
      helpGroup: 'GLOBAL',
    }),
  }

  /** Flags of a command that changes something but needs no confirmation (create, update, archive). */
  static dryRunFlags = {
    'dry-run': Flags.boolean({
      description: 'Resolve auth, region and project and print the request that would be sent; send nothing. The server does not check the values',
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
  /** A dry run's input check, set by the command before the stopped call. */
  protected dryRunValidation?: DryRunValidation

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
    const v = report.validation
    if (v) {
      if (!v.checked) lines.push(`Not checked by the Hub: ${v.note ?? 'no input to check'}`)
      else if (v.valid) lines.push(`Checked by the Hub (${v.checkedWith}): valid${v.collections?.length ? ` — collections: ${v.collections.join(', ')}` : ''}.`)
      else {
        lines.push(`Checked by the Hub (${v.checkedWith}): NOT valid — the real call would fail:`)
        for (const i of v.issues ?? []) lines.push(`  - ${[i.where, i.code].filter(Boolean).join(' ')}${i.where || i.code ? ': ' : ''}${i.message ?? ''}`)
      }
    }

    this.log(lines.join('\n'))
  }

  /** Commands that never reach a Norbix server (config, profiles) set this to false: no discovery in `init`. */
  static discoversHost = true

  /** Discovery answers of this run, by host origin. */
  private hostInfos = new Map<string, {hubKey: string; info: HostInfo; from: string}>()
  /** Deprecation warnings already printed in this run. */
  private warned = new Set<string>()

  /**
   * Before `run`: find the Hub behind the host (cache, else network). A
   * parse error is left for `run` to report.
   */
  async init(): Promise<void> {
    await super.init()
    const ctor = this.constructor as typeof BaseCommand
    if (!ctor.discoversHost) return
    let flags: GlobalFlags
    try {
      flags = (await this.parse(ctor as unknown as Parameters<typeof this.parse>[0])).flags as GlobalFlags
    } catch {
      return
    }

    await this.prepareHost(flags)
  }

  /** Discover the host `flags` point at, so `resolveContext` knows its Hub. */
  protected async prepareHost(flags: GlobalFlags, opts: {refresh?: boolean} = {}): Promise<void> {
    const target = this.pickTarget(flags)
    // Both addresses set by the deprecated settings: nothing to discover.
    if (target.hubOverride && target.apiOverride) return
    this.hostInfos.set(target.origin, await resolveHost(target.origin, opts))
    await this.prepareRegion(flags)
  }

  /**
   * On norbix.ai a region is required. When none is set, the project's
   * primary region is asked from the Hub once and cached, so --region is
   * optional there. Any failure keeps the old rule (assertEndpoints).
   */
  private async prepareRegion(flags: GlobalFlags): Promise<void> {
    const ctx = this.resolveContext(flags)
    if (!ctx.usesDefaultEndpoints || ctx.region || !ctx.projectId || !(ctx.apiKey || ctx.bearerToken)) return
    if (ctx.hostInfo?.source !== 'discovered' || flags['dry-run']) return
    let bearerToken = ctx.bearerToken
    try {
      bearerToken = (await this.sessionRefresher(ctx)?.ensureFresh()) ?? bearerToken
    } catch {
      return // the command itself reports an ended sign-in
    }

    const region = await fetchProjectRegion(await this.hubEndpoint(ctx), ctx.projectId, {...ctx, bearerToken})
    if (region) saveProjectRegion(ctx.hubKey, ctx.projectId, region)
  }

  /** Which profile applies: --profile, else [default]. */
  private selectProfile(flags: GlobalFlags): {prof: Profile; profileName?: string; explicit: boolean} {
    const profiles = readProfiles()
    if (flags.profile) {
      if (!profiles[flags.profile]) {
        throw usageError(
          `Profile "${flags.profile}" not found in ~/.norbix/config.`,
          `Run \`norbix configure --profile ${flags.profile}\` to create it, or \`norbix profiles\` to list existing ones.`,
          'norbix profiles --help',
        )
      }

      return {prof: profiles[flags.profile], profileName: flags.profile, explicit: true}
    }

    return profiles.default ? {prof: profiles.default, profileName: 'default', explicit: false} : {prof: {}, explicit: false}
  }

  /**
   * The host and the profile that go with it. A profile is only used for
   * its own host: its API key is never sent to another one.
   */
  private pickTarget(flags: GlobalFlags): {
    origin: string
    hostSource: ResolvedContext['hostSource']
    prof: Profile
    profileName?: string
    explicit: boolean
    hubOverride?: string
    apiOverride?: string
    deprecations: string[]
  } {
    let {prof, profileName, explicit} = this.selectProfile(flags)
    const flagHost = flags.host?.trim() || undefined

    if (flagHost) {
      const origin = normalizeHost(flagHost)
      if (profileName) {
        const profOrigin = prof.host
          ? normalizeHost(prof.host)
          : prof.hub_url
            ? originOf(prof.hub_url)
            : normalizeHost(DEFAULT_HOST)
        if (!sameHub(origin, profOrigin)) {
          if (explicit) {
            throw usageError(
              `Profile "${profileName}" is for ${new URL(profOrigin).host}, but --host / NORBIX_HOST names ${new URL(origin).host}.`,
              `Drop one of them, or change the profile: norbix config set host ${new URL(origin).host} --profile ${profileName}.`,
              'norbix config --help',
            )
          }

          prof = {}
          profileName = undefined
        }
      }

      return {origin, hostSource: 'flag/env', prof, profileName, explicit, deprecations: []}
    }

    if (prof.host) {
      return {origin: normalizeHost(prof.host), hostSource: `profile [${profileName}]`, prof, profileName, explicit, deprecations: []}
    }

    // Deprecated for one release: full Api / Hub URLs instead of a host.
    const legacy = this.readStore()
    const envApi = process.env.NORBIX_API_URL?.trim() || undefined
    const envHub = process.env.NORBIX_HUB_URL?.trim() || undefined
    const pick = (fromProfile?: string, fromEnv?: string, fromLegacy?: string) =>
      explicit ? (fromProfile ?? fromEnv) : (fromEnv ?? fromProfile ?? fromLegacy)
    const hubOverride = pick(prof.hub_url, envHub, legacy.hubUrl)
    const apiOverride = pick(prof.api_url, envApi, legacy.apiUrl)

    const deprecations: string[] = []
    if (hubOverride && hubOverride === envHub) deprecations.push('NORBIX_HUB_URL')
    if (apiOverride && apiOverride === envApi) deprecations.push('NORBIX_API_URL')
    if ((hubOverride && hubOverride === prof.hub_url) || (apiOverride && apiOverride === prof.api_url)) {
      deprecations.push(`api_url / hub_url in profile [${profileName}]`)
    }

    if ((hubOverride && hubOverride === legacy.hubUrl) || (apiOverride && apiOverride === legacy.apiUrl)) {
      deprecations.push('apiUrl / hubUrl in the old config.json')
    }

    return {
      origin: hubOverride ? originOf(hubOverride) : normalizeHost(DEFAULT_HOST),
      hostSource: hubOverride ? 'deprecated url' : 'default',
      prof,
      profileName,
      explicit,
      hubOverride,
      apiOverride,
      deprecations,
    }
  }

  protected resolveContext(flags: GlobalFlags): ResolvedContext {
    const target = this.pickTarget(flags)
    const {prof, profileName, explicit} = target
    const legacy = this.readStore()
    this.warnDeprecated(target.deprecations, target.origin)

    // What discovery learned (in `init`), else whatever the cache holds.
    const known = target.hubOverride && target.apiOverride ? undefined : (this.hostInfos.get(target.origin) ?? cachedHost(target.origin))
    const info = known?.info
    const isDefault = isDefaultHost(target.origin)
    const hubFull = target.hubOverride ?? info?.hubUrl ?? (isDefault ? DEFAULT_HUB_URL : target.origin)
    const apiFull = target.apiOverride ?? info?.apiUrl ?? (isDefault ? DEFAULT_API_URL : target.origin)
    const hubKey = target.hubOverride ? hostKey(originOf(target.hubOverride)) : (known?.hubKey ?? hostKey(hubFull))

    // The browser sign-in of this Hub — also for a profile without an API key.
    const stored = readSession(hubKey)
    const session = isSessionUsable(stored) ? stored : undefined

    const apiKeyOverride = flags['api-key']
    const bearerToken = apiKeyOverride || prof.api_key ? undefined : session?.bearerToken
    const legacyKey = explicit ? undefined : legacy.apiKey
    const apiKey = apiKeyOverride ?? prof.api_key ?? (bearerToken ? undefined : legacyKey)

    const authSource: ResolvedContext['authSource'] = apiKeyOverride
      ? 'flag/env api key'
      : prof.api_key
        ? `profile [${profileName ?? 'default'}]`
        : bearerToken
          ? 'session'
          : legacyKey
            ? 'legacy config'
            : 'none'

    const fromLegacy = <T>(value: T | undefined) => (explicit ? undefined : value)

    // A URL may be given with its version (`https://hub.example.com/v3`) or
    // without; the SDK adds the version itself, so it is split off here.
    const {base: apiUrlBase, version: apiUrlVersion} = splitVersionedUrl(apiFull)
    const {base: hubUrlBase, version: hubUrlVersion} = splitVersionedUrl(hubFull)

    const projectId = flags.project ?? prof.project_id ?? session?.projectId ?? fromLegacy(legacy.projectId)
    const region =
      flags.region ??
      prof.region ??
      session?.region ??
      fromLegacy(legacy.region) ??
      (projectId && info?.source === 'discovered' ? cachedProjectRegion(hubKey, projectId) : undefined)

    // The Hub lists its regions with their own addresses; the default
    // norbix.ai domains get a region subdomain when the Hub cannot be asked.
    const regional = info ? regionalEndpoints(info, region) : undefined
    const withRegion = (url: string, isDefaultUrl: boolean) =>
      isDefaultUrl && region ? url.replace('://', `://${region}.`) : url
    const apiUrl = target.apiOverride
      ? withRegion(apiUrlBase, apiUrlBase === DEFAULT_API_URL)
      : (regional?.apiUrl ?? withRegion(apiUrlBase, apiUrlBase === DEFAULT_API_URL))
    const hubUrl = target.hubOverride
      ? withRegion(hubUrlBase, hubUrlBase === DEFAULT_HUB_URL)
      : (regional?.hubUrl ?? withRegion(hubUrlBase, hubUrlBase === DEFAULT_HUB_URL))

    const usesDefaultEndpoints = apiUrlBase === DEFAULT_API_URL || hubUrlBase === DEFAULT_HUB_URL

    return {
      usesDefaultEndpoints,
      projectId,
      accountId: flags.account ?? prof.account_id ?? session?.accountId ?? fromLegacy(legacy.accountId),
      env: flags.env ?? prof.env ?? session?.env ?? fromLegacy(legacy.env),
      region,
      apiKey,
      bearerToken,
      apiUrl: splitVersionedUrl(apiUrl).base,
      hubUrl: splitVersionedUrl(hubUrl).base,
      host: target.origin,
      hostSource: target.hostSource,
      hubKey,
      hostInfo: info,
      // Sign-in, refresh and revoke go to the Hub itself; with the built-in
      // norbix.ai addresses that is the regional Hub, as before discovery.
      authHubUrl: info?.source === 'discovered' && !target.hubOverride ? hubUrlBase : splitVersionedUrl(hubUrl).base,
      deprecations: target.deprecations,
      filesIntegrationId: prof.files_integration_id ?? fromLegacy(legacy.filesIntegrationId),
      authSource,
      profileName,
      userName: session?.userName,
      session: bearerToken ? session : undefined,
      hubVersion:
        cleanVersion(process.env.NORBIX_HUB_VERSION) ??
        cleanVersion(prof.hub_version) ??
        hubUrlVersion ??
        (target.hubOverride ? undefined : info?.hubVersion),
      apiVersion: apiUrlVersion ?? (target.apiOverride ? undefined : info?.apiVersion),
      stored: legacy,
    }
  }

  /** One warning per deprecated setting and run, on stderr (stdout stays one JSON document). */
  private warnDeprecated(names: string[], origin: string): void {
    for (const name of names) {
      if (this.warned.has(name)) continue
      this.warned.add(name)
      const host = new URL(origin).host
      process.stderr.write(
        `Warning: ${name} is deprecated and will stop working in the next release. ` +
          `Use the host instead: \`host = ${host}\` in the profile (norbix config set host ${host}), --host or NORBIX_HOST.\n`,
      )
    }
  }

  private hubEndpoints = new Map<string, Promise<HubEndpoint>>()
  private refresher?: SessionRefresher

  /** The Hub base + version for calls the CLI makes without the SDK (sign-in, refresh, revoke). */
  protected hubEndpoint(ctx: ResolvedContext): Promise<HubEndpoint> {
    const key = `${ctx.authHubUrl}|${ctx.hubVersion ?? ''}|${ctx.session?.hubVersion ?? ''}`
    let hub = this.hubEndpoints.get(key)
    if (!hub) {
      hub = resolveHubEndpoint(ctx.authHubUrl, {explicit: ctx.hubVersion, stored: ctx.session?.hubVersion})
      this.hubEndpoints.set(key, hub)
    }

    return hub
  }

  /** One refresher per run, when the session in use can refresh its token. */
  protected sessionRefresher(ctx: ResolvedContext): SessionRefresher | undefined {
    if (ctx.authSource !== 'session' || !isSessionRefreshable(ctx.session)) return undefined
    const session = ctx.session
    this.refresher ??= new SessionRefresher(
      session,
      () => (session.hubUrl ? resolveHubEndpoint(session.hubUrl, {stored: session.hubVersion}) : this.hubEndpoint(ctx)),
      {hubKey: ctx.hubKey},
    )
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
        'Set it with `norbix configure` (region field) or pass --region <code> (e.g. nb-eu-germany). ' +
          'For your own installation, pass --host <your dashboard or Hub address>.',
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
    opts: {requireAuth?: boolean; requireProject?: boolean; account?: boolean} = {},
  ): Norbix {
    const ctx = this.resolveContext(flags)
    const noProject = !ctx.projectId && opts.requireProject === false
    // No project first: on norbix.ai the region comes from the project, so
    // "Region is required" would hide the real cause (and its project list).
    if (!ctx.projectId && !noProject) throw new NoProjectError(flags)
    // An account-level call (Hub account/*) needs no region: with none set on
    // norbix.ai it goes to the account Hub (hub.norbix.ai), not a regional one.
    const accountHub = opts.account === true && ctx.usesDefaultEndpoints && !ctx.region
    if (!accountHub) this.assertEndpoints(ctx)

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
        baseUrl: {api: ctx.apiUrl, hub: accountHub ? ctx.authHubUrl : ctx.hubUrl},
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

  /**
   * The account's projects (Hub `account/projects`) with their primary
   * region, or undefined when they cannot be read. An account-level call: on
   * norbix.ai it needs no region (see `client`, option `account`).
   */
  protected async accountProjects(flags: GlobalFlags): Promise<ProjectChoice[] | undefined> {
    try {
      const client = this.client({...flags, 'dry-run': false} as GlobalFlags, {requireProject: false, account: true})
      const res = await client.hub.account.getProjects({})
      return (res.list ?? [])
        .filter((p) => p.viewId)
        .map((p) => {
          const region = p.primaryRegion?.id
          return {
            id: p.viewId,
            name: p.name || p.uniqueName || undefined,
            ...(typeof region === 'string' && /^[a-z0-9-]+$/.test(region) ? {region} : {}),
          }
        })
    } catch {
      return undefined // no auth, Hub down: the caller keeps its plain message
    }
  }

  /**
   * No project set and the account has exactly one: save it into the
   * browser sign-in (the session), so every later command uses it. With an
   * API key nothing is saved (state 'one') — keys belong in a profile the
   * user edits. Several projects (or none) are returned for the caller to list.
   */
  protected async adoptOnlyProject(flags: GlobalFlags): Promise<ProjectAdoption> {
    const ctx = this.resolveContext(flags)
    if (ctx.projectId || flags['dry-run'] || (!ctx.apiKey && !ctx.bearerToken)) return {state: 'not checked', projects: []}
    const projects = await this.accountProjects(flags)
    if (!projects) return {state: 'not checked', projects: []}
    if (projects.length === 0) return {state: 'none', projects}
    if (projects.length > 1) return {state: 'several', projects}
    const [only] = projects
    // On norbix.ai every call needs the project's region: it is kept with the
    // project. A self-hosted Hub needs none, so nothing changes there.
    const region = ctx.usesDefaultEndpoints && !ctx.region ? only.region : undefined
    if (region) saveProjectRegion(ctx.hubKey, only.id, region)
    const session = ctx.authSource === 'session' ? readSession(ctx.hubKey) : undefined
    if (!session) return {state: 'one', projects}
    writeSession(ctx.hubKey, {...session, projectId: only.id, ...(region ? {region} : {})})
    return {state: 'saved', projects, projectId: only.id, ...(region ? {region} : {})}
  }

  /** "No project ID configured", with the account's projects in the hint (and the only one saved). */
  private async explainNoProject(error: NoProjectError): Promise<CliError> {
    const adoption = await this.adoptOnlyProject(error.flags)
    if (adoption.state === 'not checked') return error
    const choose = 'pass --project <id>, set NORBIX_PROJECT_ID, or save one: norbix config set project_id <id>'
    const hint =
      adoption.state === 'saved'
        ? `Your account has one project, ${projectLabel(adoption.projects[0])}; it is now saved to your sign-in. Run the command again.`
        : adoption.state === 'one'
          ? `Your account has one project, ${projectLabel(adoption.projects[0])}: pass --project ${adoption.projects[0].id}, or save it: norbix config set project_id ${adoption.projects[0].id}.`
          : adoption.state === 'none'
          ? 'Your account has no projects yet. Create one in the dashboard, then run the command again.'
            : `Your account has ${adoption.projects.length} projects — ${choose}:\n${projectLines(adoption.projects)}`
    return new CliError({exit: error.exit, code: error.code, message: error.message, hint, docs: error.docs})
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
        ...(this.dryRunValidation ? {validation: this.dryRunValidation} : {}),
      }
      if (this.jsonEnabled()) this.logJson(report)
      else this.printDryRun(report)
      // The Hub said the input is wrong: the report is printed, the exit code says "would fail" (6).
      if (this.dryRunValidation?.valid === false) {
        const invalid = new Error('dry run: the Hub rejected the input') as Error & {oclif?: {exit?: number}; skipOclifErrorHandling?: boolean}
        invalid.oclif = {exit: EXIT.VALIDATION}
        invalid.skipOclifErrorHandling = true
        throw invalid
      }

      return report
    }

    // `this.exit(n)` — already decided, nothing to print.
    if ((error as {code?: string}).code === 'EEXIT') throw error

    // A CLI error raised inside the SDK's middleware (an ended sign-in)
    // arrives wrapped as a network error: report the CLI error itself.
    const raw = (error as {raw?: unknown}).raw
    const reported = error instanceof NoProjectError ? await this.explainNoProject(error) : raw instanceof CliError ? raw : error
    const envelope = toEnvelope(reported, {command: this.commandName})
    // A Hub that cannot be reached may have moved: discover it again next time.
    if (envelope.exit === EXIT.NETWORK) for (const origin of this.hostInfos.keys()) forgetHost(origin)
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

/** `Finlo (66b2…)`, or the id alone. */
export function projectLabel(p: ProjectChoice): string {
  return p.name ? `${p.name} (${p.id})` : p.id
}

/** One indented `id  name` line per project. */
export function projectLines(projects: ProjectChoice[]): string {
  return projects.map((p) => `  ${p.id}${p.name ? `  ${p.name}` : ''}`).join('\n')
}

/** The origin of a full URL (deprecated settings are not checked for https). */
function originOf(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    throw usageError(`"${url}" is not a URL.`, 'Set the host instead: norbix config set host <host>.', 'norbix config --help')
  }
}

/** Two hosts lead to the same Hub: equal, or known (cached) to share one. */
function sameHub(a: string, b: string): boolean {
  if (a === b) return true
  const ha = cachedHost(a)?.hubKey
  return ha !== undefined && ha === cachedHost(b)?.hubKey
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
