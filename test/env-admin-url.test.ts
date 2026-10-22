import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import {describeEnvAdminUrl} from '../src/lib/env-admin-url.js'
import {envListAnswer} from '../tests/_env.js'

/**
 * `norbix env admin-url set|clear|show` and `norbix project --env` (gateway N49):
 * the Hub routes `PATCH|GET /v3/account/projects/environments/{environmentName}/admin-url`.
 * Happy Tummy: PROD → https://admin.…, TEST → https://test-admin.…. The real commands
 * run through oclif with `fetch` replaced.
 */

const PROJECT = 'test-project'
const API_KEY = 'test-api-key'
const REGION = 'nb-eu-germany'
const globalArgs = ['--project', PROJECT, '--api-key', API_KEY, '--region', REGION]

interface Call {
  method: string
  url: string
  headers: Record<string, string>
  body?: unknown
}

let calls: Call[]
let realFetch: typeof globalThis.fetch

/** The hub: remembers the env URLs set by PATCH and answers GET like the gateway. */
function fakeHub(options: {status?: number; error?: {errorCode: string; message: string}} = {}): void {
  const urls: Record<string, string> = {}
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const envList = envListAnswer(input, init, ['PROD', 'TEST'])
    if (envList) return envList
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const headers: Record<string, string> = {}
    new Headers(init?.headers).forEach((v, k) => (headers[k] = v))
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    const method = init?.method ?? 'GET'
    calls.push({method, url, headers, body})

    const json = (status: number, payload: unknown) =>
      new Response(JSON.stringify(payload), {status, headers: {'Content-Type': 'application/json'}})

    if (options.error) return json(options.status ?? 400, {responseStatus: {isSuccess: false, errors: [options.error]}})
    if (options.status) return json(options.status, {})

    const match = /\/account\/projects\/environments\/([^/]+)\/admin-url$/.exec(new URL(url).pathname)
    if (match) {
      const env = decodeURIComponent(match[1]!)
      if (method === 'PATCH') {
        if (body?.url) urls[env] = body.url
        else delete urls[env]
        return json(200, {responseStatus: {isSuccess: true}})
      }

      const own = urls[env]
      return json(200, {
        item: own
          ? {env, adminUrl: own, effectiveAdminUrl: own, source: 'environment'}
          : {env, effectiveAdminUrl: 'https://admin.example.test', source: 'project'},
        responseStatus: {isSuccess: true},
      })
    }

    if (/\/account\/projects\/[^/]+$/.test(new URL(url).pathname)) {
      return json(200, {item: {viewId: PROJECT, name: 'Happy Tummy'}, responseStatus: {isSuccess: true}})
    }

    return json(404, {})
  }) as typeof globalThis.fetch
}

const adminUrlCalls = () => calls.filter((c) => c.url.includes('/admin-url'))

beforeEach(() => {
  calls = []
  realFetch = globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
})

describe('norbix env admin-url', () => {
  it('set sends the URL for the --env environment and reads back where the links point', async () => {
    fakeHub()

    const {result, error} = await runCommand([
      'env', 'admin-url', 'set', 'https://test-admin.example.test', '--env', 'TEST', '--json', ...globalArgs,
    ])

    expect(error).toBeUndefined()
    const [patch, get] = adminUrlCalls()
    expect({method: patch!.method, path: new URL(patch!.url).pathname, project: new URL(patch!.url).searchParams.get('projectId'), body: patch!.body})
      .toEqual({
        method: 'PATCH',
        path: '/v3/account/projects/environments/TEST/admin-url',
        project: PROJECT,
        body: {environmentName: 'TEST', url: 'https://test-admin.example.test'},
      })
    expect(get!.method).toBe('GET')
    expect(result).toEqual({
      env: 'TEST',
      adminUrl: 'https://test-admin.example.test',
      effectiveAdminUrl: 'https://test-admin.example.test',
      source: 'environment',
    })
  })

  it('--prod sets the PROD portal', async () => {
    fakeHub()

    const {error} = await runCommand(['env', 'admin-url', 'set', 'https://admin.example.test', '--prod', '--json', ...globalArgs])

    expect(error).toBeUndefined()
    expect(new URL(adminUrlCalls()[0]!.url).pathname).toBe('/v3/account/projects/environments/PROD/admin-url')
  })

  it('clear sends an empty URL and shows the fallback', async () => {
    fakeHub()

    const {result, error} = await runCommand(['env', 'admin-url', 'clear', '--env', 'TEST', '--json', ...globalArgs])

    expect(error).toBeUndefined()
    expect(adminUrlCalls()[0]!.body).toEqual({environmentName: 'TEST', url: ''})
    expect(result).toEqual({env: 'TEST', effectiveAdminUrl: 'https://admin.example.test', source: 'project'})
  })

  it('show answers the env\'s own URL, the effective URL and the source', async () => {
    fakeHub()

    const {result, error} = await runCommand(['env', 'admin-url', 'show', '--env', 'TEST', ...globalArgs])

    expect(error).toBeUndefined()
    expect(result).toEqual({env: 'TEST', effectiveAdminUrl: 'https://admin.example.test', source: 'project'})
  })

  it('the line for people says where the links point and why', () => {
    expect([
      describeEnvAdminUrl({env: 'TEST', adminUrl: 'https://test-admin.example.test', effectiveAdminUrl: 'https://test-admin.example.test', source: 'environment'}),
      describeEnvAdminUrl({env: 'STAGING', effectiveAdminUrl: 'https://admin.example.test', source: 'project'}),
      describeEnvAdminUrl({env: 'TEST', adminUrl: 'https://test-admin.example.test', effectiveAdminUrl: 'https://pr-1.admin.norbix.ai', source: 'hosted', note: 'the Admin Portal is disabled'}),
    ]).toEqual([
      'TEST: e-mail links open https://test-admin.example.test — from its own admin URL',
      'STAGING: e-mail links open https://admin.example.test — from the project admin URL (no URL of its own)',
      'TEST: e-mail links open https://pr-1.admin.norbix.ai — from the Norbix-hosted portal\n  note: the Admin Portal is disabled',
    ])
  })

  it('says why the hub refused a URL', async () => {
    fakeHub({status: 400, error: {
      errorCode: 'CM-ERRORS-ENVIRONMENTS-015',
      message: "'https://test-admin.example.test/?x=1' cannot be the admin portal URL of 'TEST': it must not have a query (?…).",
    }})

    const {error} = await runCommand(['env', 'admin-url', 'set', 'https://test-admin.example.test/?x=1', '--env', 'TEST', ...globalArgs])

    expect(error?.message).toContain('HTTP 400: CM-ERRORS-ENVIRONMENTS-015')
  })

  it('names an old hub on 405', async () => {
    fakeHub({status: 405})

    const {error} = await runCommand(['env', 'admin-url', 'show', '--env', 'TEST', ...globalArgs])

    expect(error?.message).toContain('older than the per-environment admin URL')
  })

  it('sends nothing on --dry-run', async () => {
    fakeHub()

    const {result, error} = await runCommand<{dryRun: boolean; http: {method: string; url: string; headers: Record<string, string>}}>([
      'env', 'admin-url', 'set', 'https://test-admin.example.test', '--env', 'TEST', '--dry-run', ...globalArgs,
    ])

    expect(error).toBeUndefined()
    expect(result?.dryRun).toBe(true)
    expect(result?.http.method).toBe('PATCH')
    expect(result?.http.url).toContain('/v3/account/projects/environments/TEST/admin-url')
    expect(result?.http.headers.Authorization).toBe('Bearer ***')
    expect(adminUrlCalls()).toHaveLength(0)
  })
})

describe('norbix project --env', () => {
  it('adds the effective admin URL of that environment', async () => {
    fakeHub()

    const {result, error} = await runCommand<{environmentAdminUrl?: unknown}>(['project', '--env', 'TEST', '--json', ...globalArgs])

    expect(error).toBeUndefined()
    expect(result?.environmentAdminUrl).toEqual({env: 'TEST', effectiveAdminUrl: 'https://admin.example.test', source: 'project'})
  })

  it('without an env answers exactly as before', async () => {
    fakeHub()
    // A project with only PROD needs no env; nothing extra is fetched.
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const envList = envListAnswer(input, init, ['PROD'])
      if (envList) return envList
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      calls.push({method: init?.method ?? 'GET', url, headers: {}})
      return new Response(JSON.stringify({item: {viewId: PROJECT}, responseStatus: {isSuccess: true}}), {status: 200, headers: {'Content-Type': 'application/json'}})
    }) as typeof globalThis.fetch

    // Another project id: the env list of the project above is remembered (env rule).
    const {result, error} = await runCommand<Record<string, unknown>>(['project', '--json', '--project', 'prod-only-project', '--api-key', API_KEY, '--region', REGION])

    expect(error).toBeUndefined()
    expect(result).not.toHaveProperty('environmentAdminUrl')
    expect(adminUrlCalls()).toHaveLength(0)
  })
})
