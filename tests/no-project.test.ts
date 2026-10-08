import {mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {afterEach, describe, expect, it} from 'vitest'

import {cli, parseSingleJson, startFakeGateway, type FakeGateway} from './_cli.js'

/**
 * "No project ID configured": the error names the account's projects, and
 * with a browser sign-in the account's only project is saved into it.
 */

let gateway: FakeGateway | undefined

afterEach(async () => {
  await gateway?.close()
  gateway = undefined
})

/** A HOME whose [default] profile points at the fake Hub with no project: an API key, or a browser sign-in. */
function homeWithoutProject(port: number, auth: 'api key' | 'session'): string {
  const home = mkdtempSync(join(tmpdir(), 'norbix-noproject-'))
  mkdirSync(join(home, '.norbix', 'sessions'), {recursive: true})
  const profile = ['[default]', `host=127.0.0.1:${port}`, ...(auth === 'api key' ? ['api_key=k'] : []), '']
  writeFileSync(join(home, '.norbix', 'config'), profile.join('\n'))
  if (auth === 'session') {
    writeFileSync(
      join(home, '.norbix', 'sessions', `127.0.0.1_${port}.json`),
      JSON.stringify({
        hubUrl: `http://127.0.0.1:${port}`,
        host: `127.0.0.1:${port}`,
        bearerToken: 'access-1',
        method: 'browser',
        hubVersion: 'v3',
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      }),
    )
  }

  return home
}

type Envelope = {error: {code: string; message: string; hint: string}}

describe('no project configured', () => {
  it('several projects: the hint lists them with how to choose; nothing is saved', async () => {
    gateway = await startFakeGateway({'/v3/account/projects': {list: [{viewId: 'p-a', name: 'Alpha'}, {viewId: 'p-b', name: 'Beta'}]}})
    const home = homeWithoutProject(gateway.port, 'session')
    const r = await cli(home, ['hub', 'database', 'schemas', 'get', '--json'])
    expect(r.code).toBe(2)
    const {error} = parseSingleJson(r.stdout) as Envelope
    expect(error.message).toBe('No project ID configured.')
    expect(error.hint).toBe(
      'Your account has 2 projects — pass --project <id>, set NORBIX_PROJECT_ID, or save one: norbix config set project_id <id>:\n  p-a  Alpha\n  p-b  Beta',
    )
    expect(gateway.hits.map((h) => h.url)).toEqual(['/v3/account/projects'])
    const session = JSON.parse(readFileSync(join(home, '.norbix', 'sessions', `127.0.0.1_${gateway.port}.json`), 'utf8'))
    expect(session.projectId).toBeUndefined()
  })

  it('one project and a browser sign-in: it is saved to the sign-in, and the next run uses it', async () => {
    gateway = await startFakeGateway({'/v3/account/projects': {list: [{viewId: 'p-only', name: 'Finlo'}]}})
    const home = homeWithoutProject(gateway.port, 'session')
    const first = await cli(home, ['hub', 'database', 'schemas', 'get', '--json'])
    expect(first.code).toBe(2)
    expect((parseSingleJson(first.stdout) as Envelope).error.hint).toBe(
      'Your account has one project, Finlo (p-only); it is now saved to your sign-in. Run the command again.',
    )
    const session = JSON.parse(readFileSync(join(home, '.norbix', 'sessions', `127.0.0.1_${gateway.port}.json`), 'utf8'))
    expect(session.projectId).toBe('p-only')

    const again = await cli(home, ['hub', 'database', 'schemas', 'get', '--dry-run', '--json'])
    expect(again.code).toBe(0)
    expect((parseSingleJson(again.stdout) as {http: {headers: Record<string, string>}}).http.headers['norbix-project-id']).toBe('p-only')
  })

  it('one project and an API key: named in the hint, the profile is not changed', async () => {
    gateway = await startFakeGateway({'/v3/account/projects': {list: [{viewId: 'p-only', name: 'Finlo'}]}})
    const home = homeWithoutProject(gateway.port, 'api key')
    const r = await cli(home, ['hub', 'database', 'schemas', 'get', '--json'])
    expect((parseSingleJson(r.stdout) as Envelope).error.hint).toBe(
      'Your account has one project, Finlo (p-only): pass --project p-only, or save it: norbix config set project_id p-only.',
    )
    expect(readFileSync(join(home, '.norbix', 'config'), 'utf8')).not.toContain('project_id')
  })

  it('a dry run asks nothing: the plain hint, no request', async () => {
    gateway = await startFakeGateway({'/v3/account/projects': {list: [{viewId: 'p-only'}]}})
    const home = homeWithoutProject(gateway.port, 'session')
    const r = await cli(home, ['hub', 'database', 'schemas', 'get', '--dry-run', '--json'])
    expect(r.code).toBe(2)
    expect((parseSingleJson(r.stdout) as Envelope).error.hint).toMatch(/^Run `norbix login`/)
    expect(gateway.hits).toEqual([])
  })
})
