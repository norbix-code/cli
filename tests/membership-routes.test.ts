import {runCommand} from '@oclif/test'
import {mkdtempSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {envListAnswer} from './_env.js'

/**
 * Every Membership command (matrix section 16: users, contacts, roles,
 * policies, settings, service-user API keys, password-reset test, passkeys),
 * run the way a user types it, through oclif and the real `@norbix.ai/ts`
 * transport, with `fetch` replaced (runCommand splits its argv on spaces,
 * so no value here has one): the verb, the host (Hub or Api), the exact
 * path, the query and the body it sends. Nothing leaves the process.
 */

interface Call {
  method: string
  host: string
  path: string
  query: URLSearchParams
  body?: Record<string, unknown>
}

let calls: Call[]
let realFetch: typeof globalThis.fetch
/** Answers by `VERB path`; anything else gets `{}`. */
let answers: Record<string, unknown>
let printed: string[]
const out = () => printed.join('\n')

beforeEach(() => {
  printed = []
  vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => {
    printed.push(parts.join(' '))
  })
  calls = []
  answers = {}
  realFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const envList = envListAnswer(input, init)
    if (envList) return envList
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    const method = init?.method ?? 'GET'
    calls.push({
      method,
      host: url.host,
      path: url.pathname,
      query: url.searchParams,
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined,
    })
    const answer = answers[`${method} ${url.pathname}`] ?? {}
    return new Response(JSON.stringify(answer), {status: 200, headers: {'Content-Type': 'application/json'}})
  }) as typeof globalThis.fetch
})

afterEach(() => {
  vi.restoreAllMocks()
  globalThis.fetch = realFetch
})

const globalArgs = ['--project', 'test-project', '--api-key', 'test-api-key', '--region', 'nb-eu-germany']

const HUB = 'nb-eu-germany.hub.norbix.ai'
const API = 'nb-eu-germany.api.norbix.ai'
const M = '/v3/membership'
const USR = 'usr_66b2f0a1c3d4'
const CT = 'ct_7a8b9c0d1e2f'
const ROLE = 'pr_1_nr_editor'
const POL = 'pol_3kJ9xJ2mQ0aB'

const tmp = mkdtempSync(join(tmpdir(), 'nbx-membership-'))
const POLICY_FILE = join(tmp, 'policy.json')
writeFileSync(POLICY_FILE, JSON.stringify({statements: [{effect: 'Allow', actions: ['database:read']}]}))

type Route = [verb: string, path: string, host?: string]

/** One request per command: [argv, [verb, path, host (default Hub)]]. */
const routes: Array<[string[], Route[]]> = [
  // Users list — logins (Api, /membership/auth)
  [['users', 'list'], [['GET', `${M}/auth`, API]]],
  [['users', 'get', USR], [['GET', `${M}/auth/${USR}`, API]]],
  [['users', 'delete', USR, '--yes'], [['DELETE', `${M}/auth`, API]]],
  // Users list — people (Hub, /membership/users)
  [['users', 'contacts', 'list'], [['GET', `${M}/users`]]],
  [['users', 'contacts', 'get', CT], [['GET', `${M}/users/${CT}`]]],
  [['users', 'contacts', 'create', '--email', 'a@example.com'], [['POST', `${M}/users`]]],
  [['users', 'contacts', 'delete', CT, '--yes'], [['DELETE', `${M}/users/${CT}`]]],
  [['users', 'contacts', 'merge', CT, 'ct_dup1', 'ct_dup2', '--yes'], [['POST', `${M}/users/merge`]]],
  [['users', 'repair', 'logins'], [['POST', `${M}/users/repair-logins`]]],
  [['users', 'repair', 'roles'], [['POST', `${M}/users/repair-roles`]]],

  // User new
  [['users', 'invite', 'a@example.com'], [['POST', `${M}/auth/invite`, API]]],
  [['users', 'register', '--email', 'a@example.com', '--password', 'Secret-123'], [['POST', `${M}/auth/register/email`, API]]],
  [
    ['users', 'register', '--email', 'a@example.com', '--password', 'Secret-123', '--with-permissions', '--role', 'Admin'],
    [['POST', `${M}/auth/register/email-with-permissions`, API]],
  ],
  [['users', 'register', '--phone', '+37060000000'], [['POST', `${M}/auth/register/phone`, API]]],
  [['users', 'register', '--phone', '+37060000000', '--with-permissions', '--role', 'Customer'], [['POST', `${M}/auth/register/phone-with-permissions`, API]]],
  [['users', 'register', '--user-name', 'alice', '--password', 'Secret-123'], [['POST', `${M}/auth/register/user-name`, API]]],
  [
    ['users', 'register', '--user-name', 'alice', '--password', 'Secret-123', '--with-permissions', '--role', 'Admin'],
    [['POST', `${M}/auth/register/user-name-with-permissions`, API]],
  ],
  [['users', 'register', '--guest'], [['POST', `${M}/auth/register/guest`, API]]],
  [['users', 'register', '--service', '--name', 'OrdersBot', '--role', 'Editor'], [['POST', `${M}/auth/register/service`, API]]],

  // User edit / detail — logins (Api)
  [['users', 'update', USR, '--name', 'Alice'], [['GET', `${M}/auth/${USR}`, API], ['PUT', `${M}/auth`, API]]],
  [['users', 'block', USR, '--yes'], [['PATCH', `${M}/auth/block`, API]]],
  [['users', 'unblock', USR], [['PATCH', `${M}/auth/unblock`, API]]],
  [['users', 'set-roles', USR, '--role', 'Editor', '--yes'], [['PUT', `${M}/auth/assign-roles`, API]]],
  [['users', 'preferences', USR], [['GET', `${M}/auth/${USR}/preferences`, API]]],
  [['users', 'preferences', 'set', USR, '--block-marketing', 'true'], [['PUT', `${M}/auth/${USR}/preferences`, API]]],
  // User edit / detail — people
  [['users', 'contacts', 'update', CT, '--name', 'Alice'], [['PATCH', `${M}/users/${CT}`]]],
  [['users', 'contacts', 'identities', 'add', CT, USR], [['POST', `${M}/users/${CT}/identities`]]],
  [['users', 'contacts', 'identities', 'remove', CT, USR, '--yes'], [['DELETE', `${M}/users/${CT}/identities/${USR}`]]],
  [['users', 'contacts', 'identities', 'promote', CT, USR], [['POST', `${M}/users/${CT}/identities/${USR}/promote`]]],
  [['users', 'contacts', 'set-roles', CT, '--role', ROLE, '--yes'], [['PUT', `${M}/users/${CT}/roles`, API]]],
  [['users', 'contacts', 'consent', CT, 'Email'], [['POST', `${M}/users/${CT}/marketing-state/Email/consent`, API]]],
  [['users', 'contacts', 'unsubscribe', CT, 'Sms'], [['POST', `${M}/users/${CT}/marketing-state/Sms/unsubscribe`, API]]],
  [['users', 'contacts', 'clear-bounce', CT, 'Email'], [['POST', `${M}/users/${CT}/marketing-state/Email/clear-bounce`]]],
  [
    ['users', 'contacts', 'tag', CT, 'Marketing', 'Email', 'newsletter', '--subscribed', 'false'],
    [['PUT', `${M}/users/${CT}/marketing-state/Marketing/Email/tags/newsletter`, API]],
  ],
  [['users', 'contacts', 'ai-plan', CT, '--plan', 'aip_pro'], [['PUT', `${M}/users/${CT}/ai-plan`]]],

  // Roles and Policies
  [['users', 'roles'], [['GET', `${M}/roles`]]],
  [['users', 'roles', ROLE], [['GET', `${M}/roles/${ROLE}`]]],
  [['users', 'roles', 'create', '--name', 'Editor'], [['POST', `${M}/roles`]]],
  [['users', 'roles', 'update', ROLE, '--description', 'Edits'], [['GET', `${M}/roles/${ROLE}`], ['PATCH', `${M}/roles`]]],
  [['users', 'roles', 'delete', ROLE, '--yes'], [['DELETE', `${M}/roles`]]],
  [['users', 'policies'], [['GET', `${M}/policies`]]],
  [['users', 'policies', POL], [['GET', `${M}/policies/${POL}`]]],
  [['users', 'policies', 'create', '--name', 'OrdersRead'], [['POST', `${M}/policies`]]],
  [['users', 'policies', 'update', POL, '--document', `@${POLICY_FILE}`], [['GET', `${M}/policies/${POL}`], ['PUT', `${M}/policies`]]],
  [['users', 'policies', 'delete', POL, '--yes'], [['DELETE', `${M}/policies`]]],

  // Settings
  [['module', 'enable', 'membership'], [['PUT', `${M}/enable`]]],
  [['module', 'disable', 'membership', '--yes'], [['PUT', `${M}/disable`]]],
  [['membership', 'settings', 'authentication'], [['GET', `${M}/authentication`]]],
  [
    ['membership', 'settings', 'authentication', 'set', '--allow-usernames', 'true'],
    [['GET', `${M}/authentication`], ['PUT', `${M}/authentication`]],
  ],
  [['membership', 'settings', 'authorization'], [['GET', `${M}/authorization`]]],
  [['membership', 'settings', 'authorization', 'set', '--invite-only', 'true'], [['PUT', `${M}/authorization`]]],
  [['membership', 'settings', 'password-complexity'], [['GET', `${M}/authorization`]]],
  [
    ['membership', 'settings', 'password-complexity', 'set', '--min-length', '12'],
    [['GET', `${M}/authorization`], ['PUT', `${M}/authorization/password-complexity`]],
  ],
  [['membership', 'settings', 'passkey'], [['GET', `${M}/passkey/settings`]]],
  [['membership', 'settings', 'passkey', 'set', '--enabled', 'true'], [['GET', `${M}/passkey/settings`], ['POST', `${M}/passkey/settings`]]],

  // Service-user API keys
  [['users', 'api-keys', USR], [['GET', `${M}/users/${USR}/api-keys`]]],
  [['users', 'api-keys', 'issue', USR, '--name', 'CI'], [['POST', `${M}/users/${USR}/api-keys`]]],
  [['users', 'api-keys', 'delete', USR, '3', '--yes'], [['DELETE', `${M}/users/${USR}/api-keys/3`]]],

  // Passkey & user-auth (the developer-useful ones)
  [['membership', 'password', 'reset', 'request', 'tester@example.com', '--wait', '0'], [['POST', `${M}/userauth/password/reset/test`, API]]],
  [['membership', 'passkeys'], [['GET', `${M}/userauth/passkeys`, API]]],
]

describe('every Membership command reaches its route', () => {
  for (const [argv, expected] of routes) {
    it(`${argv.join(' ')} → ${expected.map(([verb, path]) => `${verb} ${path}`).join(', ')}`, async () => {
      const {error} = await runCommand([...argv, ...globalArgs])

      expect(error).toBeUndefined()
      expect(calls.map((c) => [c.method, c.path, c.host])).toEqual(expected.map(([verb, path, host]) => [verb, path, host ?? HUB]))
    })
  }
})

/** Runs one command and returns its only write (the last call). */
async function send(argv: string[]): Promise<Call> {
  const {error} = await runCommand([...argv, ...globalArgs])
  expect(error).toBeUndefined()
  const last = calls.at(-1)
  expect(last).toBeDefined()
  return last as Call
}

describe('users (logins)', () => {
  it('list sends the filters in the query', async () => {
    const call = await send(['users', 'list', '--search', 'alice', '--email', 'example.com', '--status', 'Active', '--type', 'Email', '--type', 'Phone'])
    expect(call.query.get('search')).toBe('alice')
    expect(call.query.get('email')).toBe('example.com')
    expect(call.query.getAll('statuses')).toEqual(['Active'])
    expect(call.query.getAll('types')).toEqual(['Email', 'Phone'])
  })

  it('delete and block send the login ID (delete in the query, block in the body)', async () => {
    expect((await send(['users', 'delete', USR, '--yes'])).query.get('id')).toBe(USR)
    expect((await send(['users', 'block', USR, '--yes'])).body).toMatchObject({id: USR})
    expect((await send(['users', 'unblock', USR])).body).toMatchObject({id: USR})
  })

  it('invite sends --name as fullName and --salutation', async () => {
    const call = await send(['users', 'invite', 'a@example.com', '--name', 'Alice', '--salutation', 'Dear', '--role', 'Editor'])
    expect(call.body).toEqual({email: 'a@example.com', roles: ['Editor'], fullName: 'Alice', salutation: 'Dear'})
  })

  it('register --email sends email, password, roles, the profile and ignoreUserRegistersAsRole', async () => {
    const call = await send([
      'users', 'register', '--email', 'a@example.com', '--password', 'Secret-123', '--role', 'Customer', '--name', 'Alice', '--skip-default-role',
    ])
    expect(call.body).toEqual({
      ignoreUserRegistersAsRole: true,
      userGeneralInfo: {displayName: 'Alice'},
      email: 'a@example.com',
      password: 'Secret-123',
      roles: ['Customer'],
    })
  })

  it('register --with-permissions sends the roles and tags; --service sends no password', async () => {
    const admin = await send(['users', 'register', '--email', 'a@example.com', '--password', 'p', '--with-permissions', '--role', 'Admin,Editor', '--tag', 'staff'])
    expect(admin.body).toMatchObject({email: 'a@example.com', roles: ['Admin', 'Editor'], tags: ['staff'], ignoreUserRegistersAsRole: false})

    const service = await send(['users', 'register', '--service', '--name', 'OrdersBot', '--role', 'Editor'])
    expect(service.body).toEqual({ignoreUserRegistersAsRole: false, userGeneralInfo: {displayName: 'OrdersBot'}, roles: ['Editor']})
  })

  for (const [what, argv, says] of [
    ['no kind', [], 'Pass one of --email'],
    ['two kinds', ['--email', 'a@example.com', '--guest'], 'cannot also be provided'],
    ['email with no password', ['--email', 'a@example.com'], 'needs --password'],
    ['with-permissions with no role', ['--phone', '+3706', '--with-permissions'], 'needs at least one --role'],
    ['service with no role', ['--service'], 'needs at least one --role'],
    ['a tag on the public route', ['--email', 'a@example.com', '--password', 'p', '--tag', 'x'], '--tag needs'],
    ['a role on a guest', ['--guest', '--role', 'Admin'], 'needs --with-permissions'],
  ] as const) {
    it(`register refuses ${what} before anything is sent`, async () => {
      const {error} = await runCommand(['users', 'register', ...argv, ...globalArgs])
      expect(error?.message).toContain(says)
      expect(calls).toHaveLength(0)
    })
  }

  it('register --dry-run sends nothing and never prints the password', async () => {
    const {error, stdout} = await runCommand(['users', 'register', '--email', 'a@example.com', '--password', 'Secret-123', '--dry-run', ...globalArgs])
    expect(error).toBeUndefined()
    expect(calls).toHaveLength(0)
    expect(`${stdout}\n${out()}`).not.toContain('Secret-123')
    expect(`${stdout}\n${out()}`).toContain('"password": "***"')
  })

  it('update reads the login and sends the whole profile with the change', async () => {
    answers[`GET ${M}/auth/${USR}`] = {user: {id: USR, generalInfo: {displayName: 'Old', language: 'en', blockAllMarketingMessages: true}}}
    const call = await send(['users', 'update', USR, '--name', 'Alice', '--city', 'Vilnius'])
    expect(call.body).toEqual({
      id: USR,
      ignoreUserRegistersAsRole: false,
      userGeneralInfo: {displayName: 'Alice', language: 'en', city: 'Vilnius', blockAllMarketingMessages: true},
    })
  })

  it('update --dry-run reads, then sends nothing', async () => {
    const {error} = await runCommand(['users', 'update', USR, '--name', 'Alice', '--dry-run', ...globalArgs])
    expect(error).toBeUndefined()
    expect(calls.map((c) => c.method)).toEqual(['GET'])
  })

  it('set-roles sends the role names as the complete list; none = no roles', async () => {
    expect((await send(['users', 'set-roles', USR, '--role', 'Editor,Viewer', '--yes'])).body).toEqual({id: USR, roles: ['Editor', 'Viewer']})
    expect((await send(['users', 'set-roles', USR, '--yes'])).body).toEqual({id: USR, roles: []})
  })

  it('preferences set sends blockAllMarketingMessages', async () => {
    expect((await send(['users', 'preferences', 'set', USR, '--block-marketing', 'false'])).body).toEqual({blockAllMarketingMessages: false})
  })
})

describe('users import and repair', () => {
  const file = join(tmp, 'users.json')
  writeFileSync(
    file,
    JSON.stringify([
      {email: 'a@example.com', hashFormat: 'servicestack-pbkdf2', passwordHash: 'aGFzaA=='},
      {userName: 'bob', hashFormat: 'servicestack-saltedhash', passwordHash: 'aGFzaA==', passwordSalt: 'c2FsdA=='},
    ]),
  )

  it('is a preview by default: dryRun true, the rows as they are', async () => {
    answers[`POST ${M}/users/import`] = {result: {dryRun: true, received: 2, valid: 1, invalid: 1, rows: [{row: 2, login: 'bob', outcome: 'invalid', errors: [{code: 'X', message: 'bad salt'}]}]}}
    const call = await send(['users', 'import', file])
    expect(call.body?.dryRun).toBe(true)
    expect(call.body?.ignoreDefaultRoles).toBe(false)
    expect(call.body?.users).toHaveLength(2)
    expect((call.body?.users as Array<Record<string, unknown>>)[1]).toMatchObject({userName: 'bob', passwordSalt: 'c2FsdA=='})
    expect(out()).toContain('Preview — nothing was written. 2 users: 1 valid, 0 already exist, 1 invalid.')
    expect(out()).toContain('row 2 (bob): invalid — X: bad salt')
    expect(out()).not.toContain('aGFzaA==')
  })

  it('--yes writes (dryRun false); --skip-default-roles sends ignoreDefaultRoles', async () => {
    const call = await send(['users', 'import', file, '--yes', '--skip-default-roles'])
    expect(call.body).toMatchObject({dryRun: false, ignoreDefaultRoles: true})
  })

  it('a file of more than 1000 users is sent in parts', async () => {
    const big = join(tmp, 'big.json')
    writeFileSync(big, JSON.stringify(Array.from({length: 1001}, (_, i) => ({email: `u${i}@example.com`}))))
    await send(['users', 'import', big])
    expect(calls.map((c) => (c.body?.users as unknown[]).length)).toEqual([1000, 1])
  })

  it('refuses a file that is not a list of users before anything is sent', async () => {
    const bad = join(tmp, 'bad.json')
    writeFileSync(bad, '{"nope": 1}')
    const {error} = await runCommand(['users', 'import', bad, ...globalArgs])
    expect(error?.message).toContain('JSON array of users')
    expect(calls).toHaveLength(0)
  })

  it('repair is a preview by default; --yes sends dryRun false', async () => {
    expect((await send(['users', 'repair', 'logins'])).body).toEqual({dryRun: true})
    expect((await send(['users', 'repair', 'roles', '--yes'])).body).toEqual({dryRun: false})
  })
})

describe('users contacts', () => {
  it('list sends every filter in the query', async () => {
    const call = await send([
      'users', 'contacts', 'list', '--search', 'alice', '--user-name', 'al', '--status', 'Blocked', '--type', 'Email',
      '--role', ROLE, '--tag', 'vip', '--page-size', '20', '--after', 'cur_1',
    ])
    expect(call.query.get('search')).toBe('alice')
    expect(call.query.get('userName')).toBe('al')
    expect(call.query.getAll('statuses')).toEqual(['Blocked'])
    expect(call.query.getAll('types')).toEqual(['Email'])
    expect(call.query.getAll('roleNames')).toEqual([ROLE])
    expect(call.query.getAll('tags')).toEqual(['vip'])
    expect(call.query.get('pageSize')).toBe('20')
    expect(call.query.get('startingAfter')).toBe('cur_1')
  })

  it('create sends the primary email / phone, the names and the tags', async () => {
    const call = await send(['users', 'contacts', 'create', '--email', 'a@example.com', '--phone', '+3706', '--first-name', 'Alice', '--tag', 'lead,vip'])
    expect(call.body).toEqual({primaryEmail: 'a@example.com', primaryPhone: '+3706', firstName: 'Alice', tags: ['lead', 'vip']})
  })

  it('create needs --email or --phone', async () => {
    const {error} = await runCommand(['users', 'contacts', 'create', '--name', 'Alice', ...globalArgs])
    expect(error?.message).toContain('Pass --email or --phone')
    expect(calls).toHaveLength(0)
  })

  it('update sends only the fields that were passed', async () => {
    const call = await send(['users', 'contacts', 'update', CT, '--language', 'lt', '--postal-code', 'LT-01100'])
    expect(call.body).toEqual({language: 'lt', postalCode: 'LT-01100'})
  })

  it('merge sends the survivor and every merged ID', async () => {
    expect((await send(['users', 'contacts', 'merge', CT, 'ct_dup1', 'ct_dup2', '--yes'])).body).toEqual({survivorId: CT, mergedIds: ['ct_dup1', 'ct_dup2']})
  })

  it('identities add sends the login ID', async () => {
    expect((await send(['users', 'contacts', 'identities', 'add', CT, USR])).body).toEqual({authId: USR})
  })

  it('set-roles sends composite role IDs as the complete list', async () => {
    expect((await send(['users', 'contacts', 'set-roles', CT, '--role', `${ROLE},pr_1_nr_viewer`, '--yes'])).body).toEqual({roles: [ROLE, 'pr_1_nr_viewer']})
  })

  it('consent sends the lawful basis and source (defaults) and the evidence', async () => {
    expect((await send(['users', 'contacts', 'consent', CT, 'Email', '--evidence', 'form_1'])).body).toEqual({
      lawfulBasis: 'Consent',
      source: 'UserOptIn',
      evidenceRef: 'form_1',
    })
  })

  it('unsubscribe sends the reason; tag sends subscribed', async () => {
    expect((await send(['users', 'contacts', 'unsubscribe', CT, 'Email', '--reason', 'UserRequest'])).body).toEqual({reason: 'UserRequest'})
    expect((await send(['users', 'contacts', 'tag', CT, 'Marketing', 'Email', 'news', '--subscribed', 'true'])).body).toEqual({subscribed: true})
  })

  it('ai-plan sends planId; none clears it', async () => {
    expect((await send(['users', 'contacts', 'ai-plan', CT, '--plan', 'aip_pro'])).body).toEqual({planId: 'aip_pro'})
    expect((await send(['users', 'contacts', 'ai-plan', CT])).body ?? {}).toEqual({})
  })
})

describe('users roles and policies', () => {
  it('roles create sends the name, description and policy IDs', async () => {
    expect((await send(['users', 'roles', 'create', '--name', 'Editor', '--description', 'Edits', '--policy', `${POL},pol_b`])).body).toEqual({
      roleName: 'Editor',
      description: 'Edits',
      policies: [POL, 'pol_b'],
    })
  })

  it('roles update reads the role and keeps what is not passed (the name is always sent)', async () => {
    answers[`GET ${M}/roles/${ROLE}`] = {role: {id: ROLE, name: 'Editor', description: 'Old', attachedPolicies: [POL]}}
    expect((await send(['users', 'roles', 'update', ROLE, '--description', 'New'])).body).toEqual({
      id: ROLE,
      roleName: 'Editor',
      description: 'New',
      policies: [POL],
    })
    expect((await send(['users', 'roles', 'update', ROLE, '--policy', 'pol_b'])).body).toMatchObject({roleName: 'Editor', policies: ['pol_b']})
  })

  it('roles delete and policies delete send the ID in the query', async () => {
    expect((await send(['users', 'roles', 'delete', ROLE, '--yes'])).query.get('id')).toBe(ROLE)
    expect((await send(['users', 'policies', 'delete', POL, '--yes'])).query.get('id')).toBe(POL)
  })

  it('policies create and update send the document as a JSON string', async () => {
    const created = await send(['users', 'policies', 'create', '--name', 'OrdersRead', '--document', `@${POLICY_FILE}`])
    expect(created.body?.policyName).toBe('OrdersRead')
    expect(JSON.parse(created.body?.policyDocumentJson as string)).toEqual({statements: [{effect: 'Allow', actions: ['database:read']}]})

    answers[`GET ${M}/policies/${POL}`] = {policy: {id: POL, name: 'OrdersRead', description: 'Read orders'}}
    const updated = await send(['users', 'policies', 'update', POL, '--document', '{"statements":[]}'])
    expect(updated.body).toEqual({id: POL, policyName: 'OrdersRead', description: 'Read orders', policyDocumentJson: '{"statements":[]}'})
  })
})

describe('membership settings', () => {
  it('authentication set reads first and changes only what was passed', async () => {
    answers[`GET ${M}/authentication`] = {
      result: {credentialsSettings: {logoutUrl: 'https://a.example/bye', allowUsernames: false, modes: [{name: 'Passkey', logoutUrl: 'https://a.example/p'}, {name: 'Email', logoutUrl: 'https://a.example/e'}]}},
    }
    const call = await send(['membership', 'settings', 'authentication', 'set', '--allow-usernames', 'true', '--mode-logout-url', 'Passkey=https://b.example/p'])
    expect(call.body).toEqual({
      logoutUrl: 'https://a.example/bye',
      allowUsernames: true,
      modes: [{name: 'Passkey', logoutUrl: 'https://b.example/p'}, {name: 'Email', logoutUrl: 'https://a.example/e'}],
    })
  })

  it('authentication set refuses a mode with no =', async () => {
    const {error} = await runCommand(['membership', 'settings', 'authentication', 'set', '--mode-logout-url', 'Passkey', ...globalArgs])
    expect(error?.message).toContain('Name=URL')
    expect(calls).toHaveLength(0)
  })

  it('authorization set sends only the fields that were passed, and no `setting`', async () => {
    const call = await send([
      'membership', 'settings', 'authorization', 'set', '--default-role', 'Customer', '--clear-registration-roles', '--invite-only', 'true', '--anyone-can-sign-up', 'false',
    ])
    expect(call.body).toEqual({defaultRoles: ['Customer'], allowedRegistrationRoles: [], inviteOnly: true, allowAnyoneToSignUp: false})
  })

  it('authorization set --allow-guests alone keeps the current clean-up days', async () => {
    answers[`GET ${M}/authorization`] = {result: {guestCleanupPeriodDays: 30}}
    const call = await send(['membership', 'settings', 'authorization', 'set', '--allow-guests', 'true'])
    expect(calls.map((c) => c.method)).toEqual(['GET', 'PUT'])
    expect(call.body).toEqual({allowGuestUsers: true, guestCleanupPeriodDays: 30})
  })

  it('password-complexity set merges the change into the current rules', async () => {
    answers[`GET ${M}/authorization`] = {result: {passwordComplexity: {minLength: 8, minUpper: 1, allowedSpecial: '!@#'}}}
    const call = await send(['membership', 'settings', 'password-complexity', 'set', '--min-length', '12', '--min-special', '2'])
    expect(call.body).toEqual({minLength: 12, minUpper: 1, minSpecial: 2, allowedSpecial: '!@#'})
  })

  it('passkey set sends every setting, with the change', async () => {
    const current = {
      enabled: false, codeTtlMinutes: 10, maxCredentialsPerUser: 5, recoveryCodeCount: 10, generateRecoveryCodesAtSignup: true,
      authenticatorAttachment: 'Any', allowMagicLinkRecovery: false, refreshTokenTtlDays: 30, rpId: 'app.example.com',
    }
    answers[`GET ${M}/passkey/settings`] = {result: current}
    const call = await send(['membership', 'settings', 'passkey', 'set', '--enabled', 'true', '--refresh-token-days', '14'])
    expect(call.body).toEqual({...current, enabled: true, refreshTokenTtlDays: 14})
  })

  it('passkey set asks before a new RP ID (non-interactive: exit 3, nothing saved)', async () => {
    answers[`GET ${M}/passkey/settings`] = {result: {rpId: 'app.example.com'}}
    const {error} = await runCommand(['membership', 'settings', 'passkey', 'set', '--rp-id', 'new.example.com', ...globalArgs])
    expect(error?.message).toContain('Confirmation required')
    expect(calls.map((c) => c.method)).toEqual(['GET'])
  })

  it('settings set --dry-run reads, then sends nothing', async () => {
    const {error} = await runCommand(['membership', 'settings', 'passkey', 'set', '--enabled', 'true', '--dry-run', ...globalArgs])
    expect(error).toBeUndefined()
    expect(calls.map((c) => c.method)).toEqual(['GET'])
  })
})

describe('service-user API keys and the password-reset test', () => {
  it('issue sends the name, scopes, expiry and notes, and shows the key once', async () => {
    answers[`POST ${M}/users/${USR}/api-keys`] = {id: 3, name: 'CI', key: 'nbx_secret_key', environment: 'PROD'}
    const call = await send(['users', 'api-keys', 'issue', USR, '--name', 'CI', '--scope', 'read,write', '--expires-in-days', '90', '--notes', 'pipeline'])
    expect(call.body).toEqual({name: 'CI', scopes: ['read', 'write'], expiresInDays: 90, notes: 'pipeline'})
    expect(out()).toContain('nbx_secret_key')
  })

  it('delete refuses a key ID that is not a number', async () => {
    const {error} = await runCommand(['users', 'api-keys', 'delete', USR, 'abc', '--yes', ...globalArgs])
    expect(error?.message).toContain('must be a number')
    expect(calls).toHaveLength(0)
  })

  it('password reset request sends the email', async () => {
    answers[`POST ${M}/userauth/password/reset/test`] = {queued: false, reason: 'no-login', env: 'PROD'}
    const call = await send(['membership', 'password', 'reset', 'request', 'tester@example.com', '--wait', '0'])
    expect(call.body).toEqual({email: 'tester@example.com'})
    expect(out()).toContain('Nothing sent in PROD: no-login.')
  })
})
