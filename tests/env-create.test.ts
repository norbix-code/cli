import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * `norbix env create` (N5): one call to POST /account/projects/environments
 * with the new environment's database integration. `fetch` is replaced; the
 * connection string comes from an environment variable and must never show
 * up in a dry run.
 */

interface Call {
  method: string
  path: string
  body?: Record<string, unknown>
}

let calls: Call[]
let realFetch: typeof globalThis.fetch
const SECRET = 'mongodb+srv://user:s3cret@cluster.example/'

beforeEach(() => {
  calls = []
  realFetch = globalThis.fetch
  process.env.NORBIX_TEST_DB = SECRET
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    calls.push({
      method: init?.method ?? 'GET',
      path: url.pathname,
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined,
    })
    return new Response('{}', {status: 200, headers: {'Content-Type': 'application/json'}})
  }) as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
  delete process.env.NORBIX_TEST_DB
})

const globalArgs = ['--project', 'test-project', '--api-key', 'test-api-key', '--region', 'nb-eu-germany']
const exitOf = (error: unknown) => (error as {oclif?: {exit?: number}} | undefined)?.oclif?.exit

describe('norbix env create', () => {
  it('own MongoDB: the connection string is read from the named variable and sent with provider MongoDbConnectionString', async () => {
    const {error} = await runCommand(['env', 'create', 'test', '--connection-string-env', 'NORBIX_TEST_DB', '--database-name', 'ht-test', ...globalArgs])
    expect(error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({method: 'POST', path: '/v3/account/projects/environments'})
    expect(calls[0].body).toEqual({
      environmentName: 'TEST',
      integration: {provider: 'MongoDbConnectionString', integrationName: 'TEST database', isEnabled: true, connectionString: SECRET, databaseName: 'ht-test'},
    })
  })

  it('managed: provider CodeMashMongoDbAtlasFlexManaged in the region', async () => {
    await runCommand(['env', 'create', 'STAGING', '--managed', '--integration-name', 'StagingDB', ...globalArgs])
    expect(calls[0].body).toEqual({
      environmentName: 'STAGING',
      integration: {provider: 'CodeMashMongoDbAtlasFlexManaged', integrationName: 'StagingDB', isEnabled: true, norbixRegionCode: 'nb-eu-germany'},
    })
  })

  it('--dry-run sends nothing and never prints the connection string', async () => {
    const written: string[] = []
    const out = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => (written.push(String(chunk)), true))
    const log = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => void written.push(a.join(' ')))
    const {error, stdout} = await runCommand(['env', 'create', 'TEST', '--connection-string-env', 'NORBIX_TEST_DB', '--dry-run', ...globalArgs])
    out.mockRestore()
    log.mockRestore()
    expect(error).toBeUndefined()
    expect(calls).toHaveLength(0)
    expect(written.join('') + stdout).not.toContain('s3cret')
  })

  it('an unset variable: exit 2 before anything is sent', async () => {
    const {error} = await runCommand(['env', 'create', 'TEST', '--connection-string-env', 'NOT_SET_ANYWHERE', ...globalArgs])
    expect(exitOf(error)).toBe(2)
    expect(error?.message).toContain('NOT_SET_ANYWHERE is empty or not set')
    expect(calls).toHaveLength(0)
  })

  it('PROD, a bad name, or no database at all: usage errors, nothing sent', async () => {
    expect((await runCommand(['env', 'create', 'PROD', '--managed', ...globalArgs])).error?.message).toContain('PROD always exists')
    expect((await runCommand(['env', 'create', 'test-env', '--managed', ...globalArgs])).error?.message).toContain('is not an environment name')
    expect((await runCommand(['env', 'create', 'TEST', ...globalArgs])).error).toBeDefined()
    expect(calls).toHaveLength(0)
  })
})
