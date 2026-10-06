/**
 * The Hub version path (`/v3/...`) for the calls the CLI makes without the
 * SDK: device sign-in, token refresh and revoke.
 *
 * Order (first wins):
 *   1. an explicit value — `NORBIX_HUB_VERSION` or `hub_version` in the profile;
 *   2. the version stored with the session (refresh / revoke after a sign-in);
 *   3. a version already in the Hub URL (`https://hub.example.com/v3`);
 *   4. the Hub's own answer: `GET {hub}/{v}/echo` → `hubVersion`;
 *   5. `FALLBACK_HUB_VERSION`, when /echo cannot be read.
 *
 * The `{version}` segment of `/echo` is a route variable on the Hub, so any
 * value reaches it; the fallback is only the segment that asks.
 *
 * No oclif import.
 */

/** The Hub version of the current gateway. Used only when the Hub cannot tell. */
export const FALLBACK_HUB_VERSION = 'v3'

const VERSION = /^v\d+$/

export interface HubEndpoint {
  /** Hub origin + path without a trailing slash and without the version. */
  base: string
  /** `v3` */
  version: string
}

/** `{base}/{version}/{path}` */
export function hubRoute(hub: HubEndpoint, path: string): string {
  return `${hub.base}/${hub.version}/${path.replace(/^\//, '')}`
}

/** Split a trailing `/vN` off a Hub or API URL: `https://h/v3/` → base `https://h`, version `v3`. */
export function splitVersionedUrl(url: string): {base: string; version?: string} {
  const trimmed = url.replace(/\/+$/, '')
  const match = trimmed.match(/^(.*)\/(v\d+)$/)
  return match ? {base: match[1], version: match[2]} : {base: trimmed}
}

/** A version string the CLI accepts (`v3`); anything else is ignored. */
export function cleanVersion(value: string | undefined): string | undefined {
  const v = value?.trim()
  return v && VERSION.test(v) ? v : undefined
}

/** Ask the Hub for its version. Undefined when it does not answer with one. */
export async function discoverHubVersion(
  base: string,
  fetchFn: typeof fetch = fetch,
): Promise<string | undefined> {
  try {
    const res = await fetchFn(`${base}/${FALLBACK_HUB_VERSION}/echo`, {
      headers: {Accept: 'application/json'},
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return undefined
    const body = (await res.json()) as {hubVersion?: unknown}
    return cleanVersion(typeof body.hubVersion === 'string' ? body.hubVersion : undefined)
  } catch {
    return undefined
  }
}

export async function resolveHubEndpoint(
  hubUrl: string,
  opts: {explicit?: string; stored?: string; fetch?: typeof fetch} = {},
): Promise<HubEndpoint> {
  const {base, version: inUrl} = splitVersionedUrl(hubUrl)
  const known = cleanVersion(opts.explicit) ?? cleanVersion(opts.stored) ?? inUrl
  if (known) return {base, version: known}
  return {base, version: (await discoverHubVersion(base, opts.fetch)) ?? FALLBACK_HUB_VERSION}
}
