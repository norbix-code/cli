import {spawn} from 'node:child_process'

/**
 * Browser login — OAuth 2.0 Device Authorization Grant (RFC 8628), the same
 * flow GitHub CLI uses. The CLI defines this contract; the hub implements it:
 *
 *   POST {hub}/v2/auth/device/start
 *     body:     { clientName: "norbix-cli", projectId?: string }
 *     response: { deviceCode, userCode, verificationUri,
 *                 verificationUriComplete?, expiresIn?: 600, interval?: 5 }
 *
 *   POST {hub}/v2/auth/device/token
 *     body:     { deviceCode }
 *     pending:  HTTP 428 — or 200 with { error: "authorization_pending" }
 *     slower:   { error: "slow_down" }  → add 5s to the poll interval
 *     denied:   { error: "access_denied" | "expired_token" }
 *     success:  { bearerToken, refreshToken?, userId?, userName?,
 *                 displayName?, projectId?, accountId? }
 *
 * The user flow: CLI prints the code, opens {verificationUri} in the browser,
 * the user logs in on hub.norbix.ai and approves; the CLI polls until it
 * receives the tokens.
 */

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
  userId?: string
  userName?: string
  displayName?: string
  projectId?: string
  accountId?: string
}

export class DeviceFlowUnsupportedError extends Error {}

export async function startDeviceFlow(
  hubUrl: string,
  projectId?: string,
): Promise<DeviceStartResponse> {
  let res: Response
  try {
    res = await fetch(`${hubUrl.replace(/\/$/, '')}/v2/auth/device/start`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Accept: 'application/json'},
      body: JSON.stringify({clientName: 'norbix-cli', projectId}),
    })
  } catch (error) {
    throw new DeviceFlowUnsupportedError(
      `Could not reach ${hubUrl}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  // 404/405/501 → the hub does not implement browser login (yet).
  if ([404, 405, 501].includes(res.status)) {
    throw new DeviceFlowUnsupportedError(`Hub returned HTTP ${res.status} for the device flow.`)
  }

  if (!res.ok) throw new Error(`Device login start failed: HTTP ${res.status}`)
  const data = (await res.json()) as DeviceStartResponse
  if (!data.deviceCode || !data.userCode || !data.verificationUri) {
    throw new Error('Device login start returned an unexpected response.')
  }

  return data
}

/** Poll until the user approves in the browser (or the code expires). */
export async function pollDeviceToken(
  hubUrl: string,
  start: DeviceStartResponse,
  log: (msg: string) => void,
): Promise<DeviceTokenSuccess> {
  const deadline = Date.now() + (start.expiresIn ?? 600) * 1000
  let intervalMs = (start.interval ?? 5) * 1000

  while (Date.now() < deadline) {
    await sleep(intervalMs)

    const res = await fetch(`${hubUrl.replace(/\/$/, '')}/v2/auth/device/token`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Accept: 'application/json'},
      body: JSON.stringify({deviceCode: start.deviceCode}),
    })

    if (res.status === 428) continue // still pending

    const data = (await res.json().catch(() => ({}))) as DeviceTokenSuccess & {error?: string}
    if (data.error === 'authorization_pending') continue
    if (data.error === 'slow_down') {
      intervalMs += 5000
      continue
    }

    if (data.error === 'access_denied') throw new Error('Login was denied in the browser.')
    if (data.error === 'expired_token') break
    if (!res.ok) throw new Error(`Device login failed: HTTP ${res.status}`)
    if (data.bearerToken) return data

    log('Unexpected response while waiting — retrying...')
  }

  throw new Error('The login code expired. Run `norbix login` again.')
}

/** Open a URL in the default browser — macOS, Linux, Windows. */
export function openBrowser(url: string): void {
  const [cmd, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : ['xdg-open', [url]]
  try {
    spawn(cmd, args, {detached: true, stdio: 'ignore'}).unref()
  } catch {
    // Browser could not be opened — the URL is printed anyway.
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
