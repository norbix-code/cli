/**
 * The calls `norbix hub`, `norbix api` and `norbix raw` ask about before they
 * run (owner, 2026-11-11): calls that change what the account pays, and
 * deletes. The model is terraform's: the command asks, `--dry-run` shows the
 * request and sends nothing, `--yes` runs it. The MCP server refuses the same
 * calls on its generic tool (its src/guards.ts); the two lists here are the
 * same lists.
 *
 * The lists are explicit on purpose: a new route is added by hand, after
 * someone decided what it does. Nothing is matched by a pattern on a path or a
 * name. The one rule that is not a list is the HTTP verb DELETE, read from the
 * generated request-field map (src/generated/request-fields.json). The older
 * rule of the generic commands, the first word of the method name
 * (`isDestructive`), still applies next to these.
 *
 * No oclif import here on purpose.
 */
import {isDestructive} from './dispatch.js'
import {loadRequestFields, methodInfo, type MethodInfo} from './request-fields.js'

export type Surface = 'hub' | 'api'

export interface GuardedCall {
  /** The host the endpoint is on. */
  surface: Surface
  /** The SDK method name, as src/generated/request-fields.json names it. */
  method: string
}

/**
 * Calls that start or change a subscription, a licence purchase, or buy
 * something with the account's money.
 *
 * Reads stay open: getManagedServiceBundles, getAccountStatus, getFlexClusters,
 * getAccountUsageBilling, getLicenses, and getStripeBillingPortalUrl (it only
 * answers with a link to Stripe's own portal).
 */
export const BILLING_CALLS: readonly GuardedCall[] = [
  // POST /account/stripe/change-bundle: another bundle or billing period, another price.
  {surface: 'hub', method: 'changeManagedServiceBundle'},
  // POST /account/flex-clusters/{flexClusterId}/upgrade: a paid cluster tier (M10).
  {surface: 'hub', method: 'upgradeFlexCluster'},
  // POST /account/stripe/create-checkout-session: a Managed Service bundle or a Self-Hosted licence.
  {surface: 'hub', method: 'createStripeCheckoutSession'},
  // POST /account/projects/{projectId}/ai/credits/checkout: a one-time AI credit pack.
  {surface: 'hub', method: 'createAiCreditPackCheckout'},
]

/**
 * Deletes that are not sent with the HTTP verb DELETE: they still remove
 * something for good. Every endpoint whose verb is DELETE is a delete without
 * being listed here.
 */
export const DELETES_WITH_ANOTHER_VERB: readonly GuardedCall[] = [
  // POST /logs/clean: deletes every log entry stored in the project's Norbix Logging integration.
  {surface: 'hub', method: 'cleanLogs'},
  // POST /account/userauth/passkeys/{CredentialId}/revoke: ends one of the signed-in account user's
  // passkeys for good (it can never sign in again) and kills the access tokens issued from it.
  {surface: 'hub', method: 'revokeAccountPasskey'},
  // POST /membership/userauth/passkeys/{CredentialId}/revoke: the same for a project user's passkey.
  {surface: 'api', method: 'revokePasskey'},
]

/**
 * Why a call asks first:
 *   billing      it changes what the account pays (BILLING_CALLS)
 *   delete       its HTTP verb is DELETE, or it is in DELETES_WITH_ANOTHER_VERB
 *   destructive  the first word of its name is delete, remove, clean,
 *                regenerate, rotate, stop, disable or block
 */
export type ConfirmKind = 'billing' | 'delete' | 'destructive'

export interface ConfirmReason {
  kind: ConfirmKind
  /** The HTTP verb and route template, when the generated map knows the method. */
  http?: string
  path?: string
}

function listed(list: readonly GuardedCall[], surface: Surface, method: string): boolean {
  return list.some((c) => c.surface === surface && c.method === method)
}

/** True when the method changes what the account pays. */
export function isBillingCall(surface: Surface, method: string): boolean {
  return listed(BILLING_CALLS, surface, method)
}

/**
 * The delete rule: the endpoint's HTTP verb is DELETE, or it is in
 * DELETES_WITH_ANOTHER_VERB. A billing call is never a delete.
 */
export function isDelete(surface: Surface, method: string, info: Pick<MethodInfo, 'http'> | undefined): boolean {
  if (isBillingCall(surface, method)) return false
  return info?.http === 'DELETE' || listed(DELETES_WITH_ANOTHER_VERB, surface, method)
}

/**
 * Whether a resolved SDK method needs a confirmation, and why. Undefined when
 * it runs with no question. Billing is checked first, then the delete rule,
 * then the first word of the name.
 */
export function confirmReason(surface: Surface, moduleName: string, method: string): ConfirmReason | undefined {
  const info = methodInfo(surface, moduleName, method)
  const route = info ? {http: info.http, path: info.path} : {}
  if (isBillingCall(surface, method)) return {kind: 'billing', ...route}
  if (isDelete(surface, method, info)) return {kind: 'delete', ...route}
  if (isDestructive(method)) return {kind: 'destructive', ...route}
  return undefined
}

/** The question a generic command asks: it says in plain words what kind of call this is. */
export function confirmQuestion(reason: ConfirmReason, method: string, request: unknown): string {
  const call = `${method}(${JSON.stringify(request)})`
  switch (reason.kind) {
    case 'billing':
      return `${method} changes what the account pays. Run ${call}?`
    case 'delete':
      return `${method} deletes something for good${reason.http && reason.path ? ` (${reason.http} ${reason.path})` : ''}. Run ${call}?`
    default:
      return `Run ${call}?`
  }
}

/** The mark of a method in the help listing of `norbix hub <module> --help`. */
export function confirmMarker(reason: ConfirmReason | undefined): string {
  if (!reason) return ''
  if (reason.kind === 'billing') return '  (asks confirmation: changes what the account pays)'
  if (reason.kind === 'delete') return '  (asks confirmation: deletes for good)'
  return '  (asks confirmation)'
}

export interface GuardedRoute {
  kind: 'billing' | 'delete'
  http: string
  /** The route template without the version prefix: `/account/stripe/change-bundle`. */
  path: string
  surface: Surface
  method: string
}

/** The generated entry of a listed method, whatever module it is in. */
function findInfo(surface: Surface, method: string): MethodInfo | undefined {
  for (const methods of Object.values(loadRequestFields()[surface])) {
    if (methods[method]) return methods[method]
  }

  return undefined
}

/**
 * The HTTP routes of the two lists, for `norbix raw`, which has a path and no
 * SDK method. Taken from the generated request-field map, so a route cannot
 * drift from the method it belongs to. A listed method with no generated
 * entry throws: a list that names nothing would guard nothing.
 */
export function guardedRoutes(): GuardedRoute[] {
  const routes: GuardedRoute[] = []
  const add = (kind: GuardedRoute['kind'], list: readonly GuardedCall[]): void => {
    for (const c of list) {
      const info = findInfo(c.surface, c.method)
      if (!info) throw new Error(`guards: ${c.surface} method "${c.method}" is not in src/generated/request-fields.json`)
      routes.push({kind, http: info.http, path: `/${routeSegments(info.path).join('/')}`, surface: c.surface, method: c.method})
    }
  }

  add('billing', BILLING_CALLS)
  add('delete', DELETES_WITH_ANOTHER_VERB)
  return routes
}

/**
 * The segments of a path, as the rule compares them: no query string or
 * fragment, no empty segment (so a trailing slash does not matter), and no
 * leading version segment (`v3`, `{version}`).
 */
export function routeSegments(path: string): string[] {
  const segments = path
    .split(/[?#]/)[0]
    .split('/')
    .filter((s) => s !== '')
  if (segments.length > 0 && /^(v\d+|\{version\})$/i.test(segments[0])) segments.shift()
  return segments
}

/** A `{param}` segment of a route template stands for exactly one path segment. */
function matchesTemplate(template: string[], actual: string[]): boolean {
  if (template.length !== actual.length) return false
  return template.every((t, i) => /^\{[^/]+\}$/.test(t) || t.toLowerCase() === actual[i].toLowerCase())
}

/** The path a URL built from it carries. */
function sentPath(path: string): string {
  try {
    return new URL(path.startsWith('/') ? path : `/${path}`, 'http://localhost').pathname
  } catch {
    return path
  }
}

function unescapeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

export interface RawConfirmReason {
  kind: 'billing' | 'delete'
  /** The listed route that matched; absent when the verb DELETE alone decided. */
  route?: GuardedRoute
}

/**
 * Whether a raw HTTP call needs a confirmation: the verb is DELETE, or the
 * verb and path are one of the listed routes. The host (`--api` or the hub) is
 * not looked at: the same path on the other host is asked about too.
 */
export function rawConfirmReason(httpMethod: string, path: string): RawConfirmReason | undefined {
  const verb = httpMethod.toUpperCase()
  // The path as typed, and as it leaves the machine: a URL resolves `.` and
  // `..` segments and turns `\` into `/`. %-escapes are read as the server reads them.
  const candidates = [path, sentPath(path)].map((p) => routeSegments(p).map(unescapeSegment))
  const route = guardedRoutes().find((r) => r.http === verb && candidates.some((actual) => matchesTemplate(routeSegments(r.path), actual)))
  if (route?.kind === 'billing') return {kind: 'billing', route}
  if (verb === 'DELETE') return {kind: 'delete'}
  return route ? {kind: 'delete', route} : undefined
}

/** The question `norbix raw` asks. */
export function rawConfirmQuestion(reason: RawConfirmReason, httpMethod: string, path: string): string {
  const call = `${httpMethod.toUpperCase()} ${path}`
  return reason.kind === 'billing'
    ? `${call} changes what the account pays. Send it?`
    : `${call} deletes something for good. Send it?`
}
