import {Norbix} from '@norbix.ai/ts'
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest'

import {isDestructive} from '../src/lib/dispatch.js'
import {
  BILLING_CALLS,
  DELETES_WITH_ANOTHER_VERB,
  confirmQuestion,
  confirmReason,
  guardedRoutes,
  rawConfirmQuestion,
  rawConfirmReason,
  type Surface,
} from '../src/lib/guards.js'
import {loadRequestFields} from '../src/lib/request-fields.js'
import {cli, makeHome, parseSingleJson, pool, startFakeGateway, type FakeGateway} from './_cli.js'

/**
 * `norbix hub`, `norbix api` and `norbix raw` ask before a billing call and
 * before every delete (owner, 2026-11-11; src/lib/guards.ts). The first half
 * checks the rule against the SDK and the generated request-field map; the
 * second runs the built CLI as a child process against a fake gateway:
 * exit 3 and nothing sent without --yes, the request with --yes, nothing
 * sent with --dry-run.
 */

const probe = new Norbix({projectId: 'introspect', apiKey: 'introspect'}, {envSource: {}})

/** Every callable method of the SDK on one host: [module, method]. */
function sdkMethods(surface: Surface): Array<[string, string]> {
  const namespace = probe[surface] as unknown as Record<string, Record<string, unknown>>
  const out: Array<[string, string]> = []
  for (const moduleName of Object.keys(namespace)) {
    for (const method of Object.keys(namespace[moduleName])) {
      if (typeof namespace[moduleName][method] === 'function') out.push([moduleName, method])
    }
  }

  return out
}

/** The route of every listed method, as the owner's decision names it. */
const LISTED_ROUTES: Record<string, string> = {
  'hub.changeManagedServiceBundle': 'POST /account/stripe/change-bundle',
  'hub.upgradeFlexCluster': 'POST /account/flex-clusters/{flexClusterId}/upgrade',
  'hub.createStripeCheckoutSession': 'POST /account/stripe/create-checkout-session',
  'hub.createAiCreditPackCheckout': 'POST /account/projects/{projectId}/ai/credits/checkout',
  'hub.cleanLogs': 'POST /logs/clean',
  'hub.revokeAccountPasskey': 'POST /account/userauth/passkeys/{CredentialId}/revoke',
  'api.revokePasskey': 'POST /membership/userauth/passkeys/{CredentialId}/revoke',
}

describe('the two explicit lists', () => {
  it('every listed method is one SDK method on its host, with a generated route', () => {
    for (const call of [...BILLING_CALLS, ...DELETES_WITH_ANOTHER_VERB]) {
      const label = `${call.surface}.${call.method}`
      const inSdk = sdkMethods(call.surface).filter(([, method]) => method === call.method)
      expect(inSdk, `${label} in the SDK`).toHaveLength(1)
      const generated = Object.values(loadRequestFields()[call.surface]).filter((methods) => methods[call.method])
      expect(generated, `${label} in request-fields.json`).toHaveLength(1)
    }
  })

  it('the routes `norbix raw` guards come from the generated map and are the decided ones', () => {
    const routes = Object.fromEntries(guardedRoutes().map((r) => [`${r.surface}.${r.method}`, `${r.http} ${r.path}`]))
    expect(routes).toEqual(LISTED_ROUTES)
    expect(guardedRoutes().filter((r) => r.kind === 'billing').map((r) => r.method)).toEqual(BILLING_CALLS.map((c) => c.method))
  })

  it('no billing call is sent with DELETE, and no listed delete is', () => {
    // A listed delete with the verb DELETE would be listed for nothing.
    for (const r of guardedRoutes()) expect(r.http, r.method).not.toBe('DELETE')
  })
})

describe('the rule for a resolved SDK method', () => {
  it('every SDK method has a generated HTTP verb, except six hand-written helpers', () => {
    // The verb decides the delete rule, so a method with no generated entry
    // cannot be judged by it. These six are hand-written helpers of the SDK
    // (positional arguments, no request object); none sends DELETE on its
    // own. Known gap: auth.signOut spreads its first argument over the send
    // call, so `--method DELETE --path …` typed as fields changes what it
    // sends, unasked. A new name here means: decide what it does before it ships.
    const missing: string[] = []
    for (const surface of ['hub', 'api'] as const) {
      for (const [moduleName, method] of sdkMethods(surface)) {
        if (!loadRequestFields()[surface][moduleName]?.[method]) missing.push(`${surface}.${moduleName}.${method}`)
      }
    }

    expect(missing.sort()).toEqual([
      'api.auth.browserSignIn',
      'api.auth.sessionSignInBody',
      'api.auth.signIn',
      'api.auth.signOut',
      'api.logs.write',
      'hub.code.getMarketplaceFunctionRunDetails',
    ])
  })

  it('every method sent with DELETE asks, whatever its name; nothing the old verb rule caught is lost', () => {
    let deletes = 0
    for (const surface of ['hub', 'api'] as const) {
      for (const [moduleName, method] of sdkMethods(surface)) {
        const info = loadRequestFields()[surface][moduleName]?.[method]
        const reason = confirmReason(surface, moduleName, method)
        if (info?.http === 'DELETE') {
          deletes++
          expect(reason, `${surface}.${moduleName}.${method}`).toMatchObject({kind: 'delete', http: 'DELETE', path: info.path})
        }

        if (isDestructive(method)) expect(reason, `${surface}.${moduleName}.${method}`).toBeDefined()
      }
    }

    expect(deletes).toBeGreaterThan(70)
  })

  it('names the kind: billing, delete, destructive, or nothing', () => {
    expect(confirmReason('hub', 'account', 'changeManagedServiceBundle')?.kind).toBe('billing')
    expect(confirmReason('hub', 'account', 'upgradeFlexCluster')?.kind).toBe('billing')
    expect(confirmReason('hub', 'account', 'createStripeCheckoutSession')?.kind).toBe('billing')
    expect(confirmReason('hub', 'account', 'createAiCreditPackCheckout')?.kind).toBe('billing')
    // DELETE with a name that does not start with "delete".
    for (const [surface, moduleName, method] of [
      ['hub', 'database', 'discardDatabaseSchemaDraft'],
      ['hub', 'code', 'discardCodeWorkflowDraft'],
      ['hub', 'account', 'cancelTeamInvitation'],
      ['hub', 'account', 'revokeAiServiceUserKey'],
      ['hub', 'account', 'forgetChatMemory'],
      ['hub', 'compliance', 'clearRegime'],
      ['api', 'ai', 'forgetEndUserChatMemory'],
    ] as const) {
      expect(confirmReason(surface, moduleName, method)?.kind, method).toBe('delete')
    }

    // A delete sent with POST.
    expect(confirmReason('hub', 'logs', 'cleanLogs')).toMatchObject({kind: 'delete', http: 'POST'})
    expect(confirmReason('hub', 'account', 'revokeAccountPasskey')).toMatchObject({kind: 'delete', http: 'POST'})
    expect(confirmReason('api', 'membership', 'revokePasskey')).toMatchObject({kind: 'delete', http: 'POST'})
    // The lists are per host: the api name on the hub is not listed.
    expect(confirmReason('hub', 'membership', 'revokePasskey')).toBeUndefined()
    // The older verb rule.
    expect(confirmReason('hub', 'scheduler', 'disableSchedulerTask')?.kind).toBe('destructive')
    // Reads and plain writes run with no question.
    expect(confirmReason('hub', 'account', 'getManagedServiceBundles')).toBeUndefined()
    expect(confirmReason('hub', 'account', 'getStripeBillingPortalUrl')).toBeUndefined()
    expect(confirmReason('hub', 'scheduler', 'saveSchedulerTask')).toBeUndefined()
    expect(confirmReason('api', 'database', 'insertOne')).toBeUndefined()
  })

  it('asks in plain words what kind of call it is', () => {
    expect(confirmQuestion({kind: 'billing'}, 'changeManagedServiceBundle', {bundle: 'growth'})).toBe(
      'changeManagedServiceBundle changes what the account pays. Run changeManagedServiceBundle({"bundle":"growth"})?',
    )
    expect(confirmQuestion(confirmReason('hub', 'database', 'discardDatabaseSchemaDraft')!, 'discardDatabaseSchemaDraft', {id: 'sch_1'})).toBe(
      'discardDatabaseSchemaDraft deletes something for good (DELETE /{version}/database/schemas/{Id}/draft). Run discardDatabaseSchemaDraft({"id":"sch_1"})?',
    )
    expect(confirmQuestion({kind: 'destructive'}, 'disableSchedulerTask', {id: 't_1'})).toBe('Run disableSchedulerTask({"id":"t_1"})?')
  })
})

describe('the rule for a raw HTTP call', () => {
  it('every DELETE asks', () => {
    expect(rawConfirmReason('DELETE', '/v3/anything/at/all')).toEqual({kind: 'delete'})
    // The verb is part of a listed route: DELETE on a billing path is a delete.
    expect(rawConfirmReason('DELETE', '/v3/account/stripe/change-bundle')).toEqual({kind: 'delete'})
  })

  it('the listed routes ask: any version prefix, a trailing slash, a query string, any id', () => {
    for (const path of [
      '/v3/account/stripe/change-bundle',
      '/{version}/account/stripe/change-bundle',
      '/v2/account/stripe/change-bundle/',
      'v3/account/stripe/change-bundle',
      '/account/stripe/change-bundle',
      '/v3/account/stripe/change-bundle?dry=1',
      '/v3/Account/Stripe/Change-Bundle',
      '/v3/account/flex-clusters/fxc_2ToIiRM03X63TZaJ2dJdv2/upgrade',
      '/v3/account/stripe/create-checkout-session',
      '/v3/account/projects/prj_1/ai/credits/checkout',
    ]) {
      expect(rawConfirmReason('POST', path)?.kind, path).toBe('billing')
    }

    for (const path of ['/v3/logs/clean', '/v3/account/userauth/passkeys/cred_1/revoke', '/v3/membership/userauth/passkeys/cred_1/revoke/']) {
      expect(rawConfirmReason('POST', path)?.kind, path).toBe('delete')
    }
  })

  it('anything else runs with no question', () => {
    expect(rawConfirmReason('GET', '/v3/account/stripe/bundles')).toBeUndefined()
    // The verb is part of the route.
    expect(rawConfirmReason('GET', '/v3/account/stripe/change-bundle')).toBeUndefined()
    expect(rawConfirmReason('PUT', '/v3/logs/clean')).toBeUndefined()
    expect(rawConfirmReason('POST', '/v3/scheduler/tasks')).toBeUndefined()
    // {param} is exactly one segment.
    expect(rawConfirmReason('POST', '/v3/account/flex-clusters/upgrade')).toBeUndefined()
    expect(rawConfirmReason('POST', '/v3/account/flex-clusters/a/b/upgrade')).toBeUndefined()
    expect(rawConfirmReason('POST', '/v3/account/stripe/change-bundle/extra')).toBeUndefined()
  })

  it('judges the path the server gets: dot segments, backslashes and %-escapes do not hide a route', () => {
    for (const path of [
      '/v3/logs/../account/stripe/change-bundle',
      '/v3/account/./stripe/change-bundle',
      '/v3/account\\stripe\\change-bundle',
      '/v3/account/stripe/change%2Dbundle',
      '/v3//account/stripe/change-bundle',
    ]) {
      expect(rawConfirmReason('POST', path)?.kind, path).toBe('billing')
    }

    expect(rawConfirmReason('POST', '/v3/logs/%63lean')?.kind).toBe('delete')
  })

  it('asks in plain words', () => {
    const path = '/v3/account/stripe/change-bundle'
    expect(rawConfirmQuestion(rawConfirmReason('POST', path)!, 'POST', path)).toBe(`POST ${path} changes what the account pays. Send it?`)
    expect(rawConfirmQuestion({kind: 'delete'}, 'DELETE', '/v3/scheduler/tasks/t_1')).toBe('DELETE /v3/scheduler/tasks/t_1 deletes something for good. Send it?')
  })
})

interface Guarded {
  argv: string[]
  /** A part of the question the refusal carries. */
  question: string
  /** The one request `--yes` sends. */
  verb: string
  path: string
}

const BUNDLE_BODY = '{"bundle":"Growth","billingPeriod":"Annual"}'

const GUARDED: Guarded[] = [
  // hub: a billing call, two DELETE-verb methods with another name (plain words, camelCase), a delete sent with POST.
  {
    argv: ['hub', 'account', 'changeManagedServiceBundle', '--bundle', 'Growth', '--billingPeriod', 'Annual'],
    question: 'changeManagedServiceBundle changes what the account pays.',
    verb: 'POST',
    path: '/v3/account/stripe/change-bundle',
  },
  {
    argv: ['hub', 'database', 'schema', 'draft', 'discard', 'sch_1'],
    question: 'discardDatabaseSchemaDraft deletes something for good (DELETE /{version}/database/schemas/{Id}/draft).',
    verb: 'DELETE',
    path: '/v3/database/schemas/sch_1/draft',
  },
  {
    argv: ['hub', 'account', 'cancelTeamInvitation', '--invitationId', 'inv_1'],
    question: 'cancelTeamInvitation deletes something for good (DELETE /{version}/account/team/invitations/{InvitationId}).',
    verb: 'DELETE',
    path: '/v3/account/team/invitations/inv_1',
  },
  {
    argv: ['hub', 'account', 'revokeAccountPasskey', '--credentialId', 'cred_1'],
    question: 'revokeAccountPasskey deletes something for good (POST /{version}/account/userauth/passkeys/{CredentialId}/revoke).',
    verb: 'POST',
    path: '/v3/account/userauth/passkeys/cred_1/revoke',
  },
  // api: it has no billing call; a DELETE-verb method with another name, and the delete sent with POST.
  {
    argv: ['api', 'ai', 'forgetEndUserChatMemory', '--noteId', 'note_1'],
    question: 'forgetEndUserChatMemory deletes something for good (DELETE /{version}/ai/chat/memory/{NoteId}).',
    verb: 'DELETE',
    path: '/v3/ai/chat/memory/note_1',
  },
  {
    argv: ['api', 'membership', 'revokePasskey', '--credentialId', 'cred_1'],
    question: 'revokePasskey deletes something for good (POST /{version}/membership/userauth/passkeys/{CredentialId}/revoke).',
    verb: 'POST',
    path: '/v3/membership/userauth/passkeys/cred_1/revoke',
  },
  // raw: a billing route, --method DELETE, a delete sent with POST (on --api, with {version} and a trailing slash).
  {
    argv: ['raw', '/v3/account/stripe/change-bundle', '--method', 'POST', '--body', BUNDLE_BODY],
    question: 'POST /v3/account/stripe/change-bundle changes what the account pays. Send it?',
    verb: 'POST',
    path: '/v3/account/stripe/change-bundle',
  },
  {
    argv: ['raw', '/v3/database/schemas/sch_1/draft', '--method', 'DELETE'],
    question: 'DELETE /v3/database/schemas/sch_1/draft deletes something for good. Send it?',
    verb: 'DELETE',
    path: '/v3/database/schemas/sch_1/draft',
  },
  {
    argv: ['raw', '/{version}/membership/userauth/passkeys/cred_1/revoke/', '--api', '--method', 'POST'],
    question: 'POST /v3/membership/userauth/passkeys/cred_1/revoke/ deletes something for good. Send it?',
    verb: 'POST',
    path: '/v3/membership/userauth/passkeys/cred_1/revoke/',
  },
]

/** Reads and plain writes: no question, with no --yes. */
const OPEN: Array<{argv: string[]; verb: string; path: string}> = [
  {argv: ['hub', 'account', 'getManagedServiceBundles'], verb: 'GET', path: '/v3/account/stripe/bundles'},
  {argv: ['hub', 'scheduler', 'task', 'save', '--name', 'nightly'], verb: 'POST', path: '/v3/scheduler/tasks'},
  {argv: ['api', 'database', 'insertOne', '--collectionName', 'orders', '--document', '{"a":1}'], verb: 'POST', path: '/v3/database/collections/orders'},
  {argv: ['raw', '/v3/account/stripe/bundles'], verb: 'GET', path: '/v3/account/stripe/bundles'},
  {argv: ['raw', '/v3/scheduler/tasks', '--method', 'POST', '--body', '{"name":"nightly"}'], verb: 'POST', path: '/v3/scheduler/tasks'},
]

describe('hub / api / raw in a shell with no terminal', () => {
  // One CLI process per case, four at a time (see agent-mode.test.ts).
  const SPAWN_ALL_TIMEOUT = 120_000
  let gateway: FakeGateway
  let home: string

  beforeAll(async () => {
    gateway = await startFakeGateway()
    home = makeHome(gateway.port)
  })

  afterAll(async () => {
    await gateway.close()
  })

  beforeEach(() => {
    gateway.hits.length = 0
  })

  const label = (argv: string[]) => argv.join(' ')

  it('a billing call and a delete exit 3 without --yes, say why, and send nothing', async () => {
    const results = await pool(GUARDED, 4, async (c) => ({c, ...(await cli(home, [...c.argv, '--profile', 'x']))}))
    for (const r of results) {
      expect(r.code, label(r.c.argv)).toBe(3)
      expect(r.stdout, label(r.c.argv)).toBe('')
      expect(r.stderr, label(r.c.argv)).toContain(`Confirmation required: ${r.c.question}`)
      expect(r.stderr, label(r.c.argv)).toContain('Re-run with --yes. Preview first with --dry-run.')
    }

    expect(gateway.hits).toEqual([])
  }, SPAWN_ALL_TIMEOUT)

  it('with --json too: exit 3, the CONFIRMATION_REQUIRED envelope, nothing sent', async () => {
    const results = await pool(GUARDED, 4, async (c) => ({c, ...(await cli(home, [...c.argv, '--profile', 'x', '--json']))}))
    for (const r of results) {
      expect(r.code, label(r.c.argv)).toBe(3)
      expect(r.stderr, label(r.c.argv)).toBe('')
      const doc = parseSingleJson(r.stdout) as {error: {code: string; exit: number; message: string; hint: string}}
      expect(doc.error.code).toBe('CONFIRMATION_REQUIRED')
      expect(doc.error.exit).toBe(3)
      expect(doc.error.message).toContain(r.c.question)
      expect(doc.error.hint).toBe('Re-run with --yes. Preview first with --dry-run.')
    }

    expect(gateway.hits).toEqual([])
  }, SPAWN_ALL_TIMEOUT)

  it('--dry-run never asks: it prints the request, exits 0 and sends nothing', async () => {
    const results = await pool(GUARDED, 4, async (c) => ({c, ...(await cli(home, [...c.argv, '--profile', 'x', '--dry-run', '--json']))}))
    for (const r of results) {
      expect(r.code, `${label(r.c.argv)}: ${r.stdout}${r.stderr}`).toBe(0)
      const doc = parseSingleJson(r.stdout) as {dryRun: boolean; http: {method: string; url: string}}
      expect(doc.dryRun, label(r.c.argv)).toBe(true)
      expect(doc.http.method, label(r.c.argv)).toBe(r.c.verb)
      expect(new URL(doc.http.url).pathname, label(r.c.argv)).toBe(r.c.path)
    }

    expect(gateway.hits).toEqual([])
  }, SPAWN_ALL_TIMEOUT)

  it('--yes runs each one: one request, the right verb and path', async () => {
    for (const c of GUARDED) {
      gateway.hits.length = 0
      const r = await cli(home, [...c.argv, '--profile', 'x', '--yes'])
      expect(r.code, `${label(c.argv)}: ${r.stderr}`).toBe(0)
      expect(gateway.hits.map((h) => `${h.method} ${h.url.split('?')[0]}`), label(c.argv)).toEqual([`${c.verb} ${c.path}`])
    }
  }, SPAWN_ALL_TIMEOUT)

  it('the billing body goes out as typed', async () => {
    await cli(home, ['hub', 'account', 'changeManagedServiceBundle', '--bundle', 'Growth', '--billingPeriod', 'Annual', '--profile', 'x', '--yes'])
    await cli(home, ['raw', '/v3/account/stripe/change-bundle', '--method', 'POST', '--body', BUNDLE_BODY, '--profile', 'x', '-y'])
    expect(gateway.hits.map((h) => JSON.parse(h.body) as unknown)).toEqual([
      {bundle: 'Growth', billingPeriod: 'Annual'},
      {bundle: 'Growth', billingPeriod: 'Annual'},
    ])
  })

  it('a read and a plain write still run with no question', async () => {
    for (const c of OPEN) {
      gateway.hits.length = 0
      const r = await cli(home, [...c.argv, '--profile', 'x'])
      expect(r.code, `${label(c.argv)}: ${r.stderr}`).toBe(0)
      expect(gateway.hits.map((h) => `${h.method} ${h.url.split('?')[0]}`), label(c.argv)).toEqual([`${c.verb} ${c.path}`])
    }
  }, SPAWN_ALL_TIMEOUT)

  it('the method list marks what asks: --json has destructive + confirm, --help the reason', async () => {
    const r = await cli(home, ['hub', 'account', '--json'])
    const doc = parseSingleJson(r.stdout) as {methods: Array<{method: string; destructive: boolean; confirm?: string}>}
    const of = (name: string) => doc.methods.find((m) => m.method === name)!
    expect(of('changeManagedServiceBundle')).toMatchObject({destructive: true, confirm: 'billing'})
    expect(of('cancelTeamInvitation')).toMatchObject({destructive: true, confirm: 'delete'})
    expect(of('revokeAccountPasskey')).toMatchObject({destructive: true, confirm: 'delete'})
    expect(of('getManagedServiceBundles').destructive).toBe(false)
    expect(of('getManagedServiceBundles')).not.toHaveProperty('confirm')

    const help = await cli(home, ['hub', 'account', '--help'])
    expect(help.stdout).toMatch(/managed service bundle change {2}\(asks confirmation: changes what the account pays\)/)
    expect(help.stdout).toMatch(/team invitation cancel {2}\(asks confirmation: deletes for good\)/)
    expect(help.stdout).toMatch(/managed service bundles get\n/)

    const api = parseSingleJson((await cli(home, ['api', 'membership', '--json'])).stdout) as typeof doc
    expect(api.methods.find((m) => m.method === 'revokePasskey')).toMatchObject({destructive: true, confirm: 'delete'})
  })
})
