import {spawn} from 'node:child_process'
import {hostname} from 'node:os'

import {CliError} from './cli-error.js'
import {EXIT, exitForStatus} from './exit-codes.js'
import {hubRoute, type HubEndpoint} from './hub-version.js'

/**
 * Browser sign-in — OAuth 2.0 Device Authorization Grant (RFC 8628), the same
 * flow GitHub CLI uses. Contract (gateway docs/tasks/cli-browser-sign-in.md):
 *
 *   POST {hub}/{v}/auth/device/start          (anonymous)
 *     body:     { clientName: "norbix-cli", deviceName?, projectId? }
 *     response: { deviceCode, userCode, verificationUri,
 *                 verificationUriComplete, expiresIn: 600, interval: 5 }
 *
 *   POST {hub}/{v}/auth/device/token          (anonymous)
 *     body:     { deviceCode }
 *     always HTTP 200 with one of
 *       { error: "authorization_pending" }  → poll again
 *       { error: "slow_down" }              → poll again, 5 s slower
 *       { error: "access_denied" }          → the person pressed Deny
 *       { error: "expired_token" }          → the code ran out
 *       { error: "invalid_grant" }          → unknown / spent code, user deleted
 *       { error: "invalid_request" }        → no deviceCode
 *       (an error may carry `errorDescription`; it is shown)
 *       { bearerToken, refreshToken, expiresIn, clientId, userId, userName,
 *         displayName, accountId, projectId? }
 *
 * `{v}` is the Hub version (hub-version.ts) — never a fixed `v2`. The person
 * approves on the dashboard page `verificationUriComplete` and picks the roles
 * there; the tokens belong to an AI service user with exactly those roles.
 */

export const CLIENT_NAME = 'norbix-cli'

export interface DeviceStartResponse {
  deviceCode: string
  userCode: string
  verificationUri: string
  verificationUriComplete?: string
  expiresIn?: number
  interval?: number
}

export interface DeviceTokenSuccess {
  bearerToken: string
  refreshToken?: string
  /** Seconds the access token is valid. */
  expiresIn?: number
  /** OAuth client of the refresh token — needed for `/oauth/token`. */
  clientId?: string
  userId?: string
  userName?: string
  displayName?: string
  projectId?: string
  accountId?: string
}

/** The Hub has no device sign-in (HTTP 404 / 405 / 501): an older Hub. */
export class DeviceFlowUnsupportedError extends Error {}

export interface DeviceDeps {
  fetch?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

export interface PollLimits {
  /** Stop waiting at this time (ms) — after at least one poll — and return undefined. */
  until?: number
  /** Called when the Hub asks to poll more slowly, with the new interval in seconds. */
  onSlowDown?: (intervalSeconds: number) => void
}

/** This computer's name for the AI service user ("Norbix CLI (<name>)"). */
export function deviceName(raw: string = safeHostname()): string | undefined {
  const name = raw.trim().replace(/\.local$/i, '').slice(0, 64).trim()
  return name || undefined
}

function safeHostname(): string {
  try {
    return hostname()
  } catch {
    return ''
  }
}

export async function startDeviceFlow(
  hub: HubEndpoint,
  body: {deviceName?: string; projectId?: string},
  deps: DeviceDeps = {},
): Promise<DeviceStartResponse> {
  const fetchFn = deps.fetch ?? fetch
  const url = hubRoute(hub, 'auth/device/start')
  let res: Response
  try {
    res = await fetchFn(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Accept: 'application/json'},
      body: JSON.stringify({clientName: CLIENT_NAME, deviceName: body.deviceName, projectId: body.projectId}),
    })
  } catch (error) {
    throw networkError(url, error)
  }

  // 404/405/501 → this Hub has no browser sign-in (older than the feature).
  if ([404, 405, 501].includes(res.status)) {
    throw new DeviceFlowUnsupportedError(`Hub returned HTTP ${res.status} for ${url}.`)
  }

  if (!res.ok) {
    throw new CliError({
      exit: exitForStatus(res.status),
      message: `Browser sign-in could not start: HTTP ${res.status}.`,
      status: res.status,
      url,
    })
  }

  const data = (await res.json().catch(() => ({}))) as DeviceStartResponse
  if (!data.deviceCode || !data.userCode || !data.verificationUri) {
    throw new CliError({exit: EXIT.SERVER, message: 'Browser sign-in start returned an unexpected answer.', url})
  }

  return data
}

/**
 * Poll until the person approves in the browser. Honours `interval` and adds
 * 5 s on every `slow_down` (RFC 8628 §3.5). A denial or an expired code ends
 * with exit 4 and a message that says what to do.
 */
export async function pollDeviceToken(
  hub: HubEndpoint,
  start: DeviceStartResponse,
  log: (msg: string) => void,
  deps: DeviceDeps = {},
): Promise<DeviceTokenSuccess> {
  const token = await pollDeviceTokenUntil(hub, start, log, {}, deps)
  if (!token) throw expiredError()
  return token
}

/**
 * `pollDeviceToken` that may stop early: at `limits.until` it returns
 * undefined while the code is still valid (`login --wait` polls at most
 * ~90 s per run, so a coding agent's shell never times out).
 */
export async function pollDeviceTokenUntil(
  hub: HubEndpoint,
  start: DeviceStartResponse,
  log: (msg: string) => void,
  limits: PollLimits,
  deps: DeviceDeps = {},
): Promise<DeviceTokenSuccess | undefined> {
  const fetchFn = deps.fetch ?? fetch
  const wait = deps.sleep ?? sleep
  const now = deps.now ?? Date.now
  const url = hubRoute(hub, 'auth/device/token')
  const deadline = now() + (start.expiresIn ?? 600) * 1000
  let intervalMs = (start.interval ?? 5) * 1000
  let polled = false

  while (now() < deadline) {
    if (limits.until !== undefined && polled && now() + intervalMs > limits.until) return undefined
    await wait(intervalMs)
    polled = true

    let res: Response
    try {
      res = await fetchFn(url, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Accept: 'application/json'},
        body: JSON.stringify({deviceCode: start.deviceCode}),
      })
    } catch (error) {
      throw networkError(url, error)
    }

    if (res.status === 428) continue // pending, the older shape

    const data = (await res.json().catch(() => ({}))) as DeviceTokenSuccess & {error?: string; errorDescription?: string}
    switch (data.error) {
      case 'authorization_pending':
        continue
      case 'slow_down':
        intervalMs += 5000
        limits.onSlowDown?.(intervalMs / 1000)
        continue
      case 'access_denied':
        throw new CliError({
          exit: EXIT.AUTH,
          code: 'ACCESS_DENIED',
          message: 'Sign-in was denied in the browser.',
          hint: 'Run `norbix login` again and choose Allow on the dashboard page.',
          docs: 'norbix login --help',
        })
      case 'expired_token':
        throw expiredError()
      case 'invalid_grant':
        // Unknown code, tokens already handed out once, or the AI service
        // user was deleted: polling again can never succeed.
        throw new CliError({
          exit: EXIT.AUTH,
          code: 'INVALID_GRANT',
          message: withDescription('The Hub no longer accepts this sign-in code.', data.errorDescription),
          hint: 'Run `norbix login` again to get a new code.',
          docs: 'norbix login --help',
        })
      case 'invalid_request':
        throw new CliError({
          exit: EXIT.AUTH,
          code: 'INVALID_REQUEST',
          message: withDescription('The Hub refused the sign-in request.', data.errorDescription),
          hint: 'Run `norbix login` again. If it keeps failing, the CLI and the Hub disagree on the sign-in contract — update the CLI.',
          docs: 'norbix login --help',
        })
      default:
        break
    }

    if (!res.ok) {
      throw new CliError({
        exit: exitForStatus(res.status),
        message: `Browser sign-in failed: HTTP ${res.status}.`,
        status: res.status,
        url,
      })
    }

    if (data.bearerToken) return data
    log('Unexpected answer while waiting — trying again...')
  }

  throw expiredError()
}

/** `message` plus the Hub's own words, when it sent any. */
function withDescription(message: string, description: string | undefined): string {
  const text = description?.trim()
  return text ? `${message} The Hub says: ${text}` : message
}

export function expiredError(): CliError {
  return new CliError({
    exit: EXIT.AUTH,
    code: 'EXPIRED_TOKEN',
    message: 'The sign-in code expired before it was approved.',
    hint: 'Run `norbix login` again and approve within 10 minutes.',
    docs: 'norbix login --help',
  })
}

function networkError(url: string, error: unknown): CliError {
  return new CliError({
    exit: EXIT.NETWORK,
    code: 'NETWORK_ERROR',
    message: `Could not reach the Hub: ${error instanceof Error ? error.message : String(error)}`,
    hint: 'Check the host (--host, NORBIX_HOST or `host` in the profile), --region and the network.',
    url,
  })
}

/**
 * Open a URL in the default browser — macOS, Linux, Windows.
 *
 * The URL comes from the hub's response, so it is untrusted: only http(s) is
 * opened, and Windows uses rundll32 instead of `cmd /c start`, whose parser
 * would run `&`, `|` and `^` in the URL as shell syntax.
 */
export function openBrowser(url: string): void {
  const href = toHttpUrl(url)
  if (!href) return
  const [cmd, args] = browserCommand(href, process.platform)
  try {
    const child = spawn(cmd, args, {detached: true, stdio: 'ignore'})
    // A missing opener (no xdg-open on a server) is reported as an 'error'
    // event, not thrown: without a listener Node crashes the whole login.
    child.on('error', () => {})
    child.unref()
  } catch {
    // Browser could not be opened — the URL is printed anyway.
  }
}

/**
 * True when this machine can show a browser to the person at the keyboard.
 * Over SSH it never can — on any system: `open` on a Mac reached by SSH
 * opens the browser on that remote Mac, not in front of the person. Linux
 * and the BSDs also need a desktop session (X11 or Wayland); a container
 * has none. Then the CLI only prints the link and waits.
 */
export function canOpenBrowser(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.SSH_CONNECTION || env.SSH_CLIENT || env.SSH_TTY) return false
  if (platform === 'darwin' || platform === 'win32') return true
  return Boolean(env.DISPLAY || env.WAYLAND_DISPLAY)
}

/** The URL normalised, or undefined when it is not an http(s) URL. */
export function toHttpUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : undefined
  } catch {
    return undefined
  }
}

/** The command that opens `href` in the default browser on `platform`. */
export function browserCommand(href: string, platform: NodeJS.Platform): [string, string[]] {
  if (platform === 'darwin') return ['open', [href]]
  if (platform === 'win32') return ['rundll32', ['url.dll,FileProtocolHandler', href]]
  return ['xdg-open', [href]]
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
