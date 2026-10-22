import type {ResolvedContext} from '../base.js'

/**
 * The admin portal URL of one environment (gateway N49):
 * `GET|PATCH /v3/account/projects/environments/{environmentName}/admin-url`.
 * The SDK does not know these routes yet, so the commands call them directly
 * with the same headers the SDK transport sends.
 */

/** One environment's admin portal URL as the hub answers it. */
export interface EnvironmentAdminUrl {
  env: string
  /** The environment's own URL; absent = it uses the fallback. */
  adminUrl?: string
  /** The base its password-reset / magic-link / invitation e-mails open. */
  effectiveAdminUrl?: string
  /** environment / project / hosted / cloud / none */
  source: string
  /** Why a set value was skipped, or why the links cannot be opened. */
  note?: string
}

export interface HubCall {
  method: 'GET' | 'PATCH'
  url: string
  headers: Record<string, string>
  body?: unknown
}

interface HubAnswer {
  item?: EnvironmentAdminUrl
  responseStatus?: {isSuccess?: boolean; errors?: Array<{message?: string; errorCode?: string}>}
}

/** The environment a command acts on: --env / --prod / the saved default, else PROD. */
export function targetEnv(ctx: Pick<ResolvedContext, 'env'>): string {
  return (ctx.env ?? 'PROD').trim().toUpperCase()
}

/** Builds the request; the caller checked that a project and a token are there. */
export function envAdminUrlCall(
  ctx: ResolvedContext,
  token: string,
  env: string,
  method: 'GET' | 'PATCH',
  url?: string,
): HubCall {
  const href = `${ctx.hubUrl.replace(/\/$/, '')}/v3/account/projects/environments/${encodeURIComponent(env)}/admin-url`
  const target = new URL(href)
  // The route has no {projectId} segment: the project rides in the query, as for the env list.
  target.searchParams.set('projectId', ctx.projectId!)
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
    'norbix-project-id': ctx.projectId!,
  }
  if (method === 'PATCH') headers['Content-Type'] = 'application/json'
  if (ctx.accountId) headers['norbix-account-id'] = ctx.accountId
  if (ctx.region) headers['nb-region'] = ctx.region
  return method === 'PATCH'
    ? {method, url: target.href, headers, body: {environmentName: env, url: url ?? ''}}
    : {method, url: target.href, headers}
}

/** Sends the call; throws an Error with the hub's reason (and a hint on an old hub). */
export async function sendEnvAdminUrlCall(call: HubCall): Promise<HubAnswer> {
  const res = await fetch(call.url, {
    method: call.method,
    headers: call.headers,
    body: call.body === undefined ? undefined : JSON.stringify(call.body),
  })
  const text = await res.text()
  let answer: HubAnswer = {}
  try {
    answer = text ? (JSON.parse(text) as HubAnswer) : {}
  } catch {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`)
  }

  if (!res.ok || answer.responseStatus?.isSuccess === false) {
    const why = answer.responseStatus?.errors?.map((e) => [e.errorCode, e.message].filter(Boolean).join(' ')).join('; ')
    const old = res.status === 404 || res.status === 405
    throw new Error(
      `HTTP ${res.status}${why ? `: ${why}` : ''}${old && !why ? ' (this hub is older than the per-environment admin URL — upgrade it)' : ''}`,
    )
  }

  return answer
}

/** One line for people: where the env's e-mail links point and why. */
export function describeEnvAdminUrl(a: EnvironmentAdminUrl): string {
  const from: Record<string, string> = {
    environment: 'its own admin URL',
    project: 'the project admin URL (no URL of its own)',
    hosted: 'the Norbix-hosted portal',
    cloud: 'the Cloud URL — the Cloud cannot open these links',
    none: 'nothing — the links are relative',
  }
  const line = `${a.env}: e-mail links open ${a.effectiveAdminUrl ?? '(no address)'} — from ${from[a.source] ?? a.source}`
  return a.note ? `${line}\n  note: ${a.note}` : line
}
