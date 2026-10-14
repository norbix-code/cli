import {readFileSync, readdirSync} from 'node:fs'
import {join} from 'node:path'

import {afterEach, describe, expect, it} from 'vitest'

import {ENVS_PATH, cli, makeHome, parseSingleJson, startFakeGateway, type FakeGateway} from './_cli.js'

/**
 * The env rule (owner, 2026-10-14; src/lib/env-rule.ts), seen from outside the
 * process as an agent sees it: a project with only PROD needs no env; a
 * project with more than one needs --env / --prod / NORBIX_ENV / a saved env,
 * and a saved env is printed on stderr. The list of environments is cached
 * per project and dropped by `env use` / `env delete` and by an env error.
 */

let gateway: FakeGateway | undefined

afterEach(async () => {
  await gateway?.close()
  gateway = undefined
})

/** A fresh gateway whose project has these environments, and a fresh HOME (empty cache). */
async function project(environments: string[] | null, answers: Record<string, unknown> = {}) {
  // The same object: a test may change an answer between two runs.
  gateway = await startFakeGateway(Object.assign(answers, {
    [ENVS_PATH]: environments ? {item: {environments}} : {ok: true},
  }))
  const home = makeHome(gateway.port)
  const run = (argv: string[], env: Record<string, string | undefined> = {}) => cli(home, [...argv, '--profile', 'x'], env)
  return {gateway, home, run}
}

const READ = ['db', 'schemas']
const WRITE = ['db', 'delete', 'orders', '--id', 'abc123', '--yes']

describe('a project with only PROD', () => {
  it('runs without an env, sends no norbix-env header and prints nothing on stderr', async () => {
    const {gateway, run} = await project(['PROD'])

    const r = await run(READ)

    expect(r.code).toBe(0)
    expect(r.stderr).toBe('')
    expect(gateway.hits).toHaveLength(1)
    expect(gateway.hits[0].env).toBeUndefined()
  })

  it('runs the same with --env PROD and with --prod', async () => {
    const {gateway, run} = await project(['PROD'])

    expect((await run([...WRITE, '--env', 'PROD'])).code).toBe(0)
    expect((await run([...WRITE, '--prod'])).code).toBe(0)
    expect(gateway.hits.map((h) => h.env)).toEqual([undefined, undefined])
  })
})

describe('a project with PROD and TEST', () => {
  it('refuses a command with no env: exit 2, the envs listed, nothing sent', async () => {
    const {gateway, run} = await project(['TEST', 'PROD'])

    const r = await run([...WRITE, '--json'])

    expect(r.code).toBe(2)
    const out = parseSingleJson(r.stdout) as {error: {code: string; message: string; hint: string}}
    expect(out.error.code).toBe('ENV_REQUIRED')
    expect(out.error.message).toBe('This project has environments PROD, TEST. Pass --env <name> (or set NORBIX_ENV).')
    expect(out.error.hint).toContain('--env PROD or --env TEST')
    expect(gateway.hits).toEqual([])
  })

  it('refuses a read too, with the text on stderr without --json', async () => {
    const {gateway, run} = await project(['PROD', 'TEST'])

    const r = await run(READ)

    expect(r.code).toBe(2)
    expect(r.stderr).toMatch(/^Error: This project has environments PROD, TEST\. Pass --env <name> \(or set NORBIX_ENV\)\./)
    expect(gateway.hits).toEqual([])
  })

  it('sends norbix-env: TEST with --env TEST (any case) and no header with --env PROD / --prod', async () => {
    const {gateway, run} = await project(['PROD', 'TEST'])

    expect((await run([...WRITE, '--env', 'test'])).code).toBe(0)
    expect((await run([...WRITE, '--env', 'PROD'])).code).toBe(0)
    expect((await run([...WRITE, '--prod'])).code).toBe(0)

    expect(gateway.hits.map((h) => h.env)).toEqual(['TEST', undefined, undefined])
  })

  it('takes NORBIX_ENV as named for this run (no stderr line)', async () => {
    const {gateway, run} = await project(['PROD', 'TEST'])

    const r = await run(READ, {NORBIX_ENV: 'TEST'})

    expect(r.code).toBe(0)
    expect(r.stderr).toBe('')
    expect(gateway.hits[0].env).toBe('TEST')
  })

  it('refuses --prod together with a different --env', async () => {
    const {gateway, run} = await project(['PROD', 'TEST'])

    const r = await run([...READ, '--prod', '--env', 'TEST'])

    expect(r.code).toBe(2)
    expect(r.stderr).toContain('--prod and --env TEST name different environments.')
    expect(gateway.hits).toEqual([])
  })

  it('takes an env saved by `norbix env use` and prints it on stderr for every command', async () => {
    const {gateway, run} = await project(['PROD', 'TEST'])

    expect((await run(['env', 'use', 'TEST'])).code).toBe(0)
    const r = await run(READ)

    expect(r.code).toBe(0)
    expect(r.stderr).toBe('env: TEST (profile [x])\n')
    expect(gateway.hits.at(-1)?.env).toBe('TEST')
  })

  it('a dry run fails like the real call once the environments are known', async () => {
    const {gateway, run} = await project(['PROD', 'TEST'])

    await run(['env', 'list'])
    const r = await run(['db', 'delete', 'orders', '--id', 'abc123', '--dry-run', '--json'])

    expect(r.code).toBe(2)
    expect((parseSingleJson(r.stdout) as {error: {code: string}}).error.code).toBe('ENV_REQUIRED')
    expect(gateway.hits.filter((h) => h.method === 'DELETE')).toEqual([])
  })
})

describe('the environments cache', () => {
  it('reads the list once, then from the cache; `env use` and `env delete` drop it', async () => {
    const {gateway, home, run} = await project(['PROD'])

    await run(READ)
    await run(READ)
    expect(gateway.envHits).toHaveLength(1)

    const hosts = join(home, '.norbix', 'hosts')
    const cacheFile = join(hosts, readdirSync(hosts).find((f) => f.endsWith('.envs.json'))!)
    expect(Object.values(JSON.parse(readFileSync(cacheFile, 'utf8')) as Record<string, {environments: string[]}>)[0].environments).toEqual(['PROD'])

    await run(['env', 'use', 'PROD'])
    await run(READ)
    expect(gateway.envHits).toHaveLength(2)

    await run(['env', 'delete', 'STAGING', '--yes'])
    await run(READ)
    expect(gateway.envHits).toHaveLength(3)
  })

  it('is dropped when the gateway says the environment does not exist', async () => {
    const answers: Record<string, unknown> = {}
    const {gateway, run} = await project(['PROD', 'TEST'], answers)

    expect((await run([...READ, '--env', 'TEST'])).code).toBe(0)
    expect(gateway.envHits).toHaveLength(1)
    const path = gateway.hits[0].url.split('?')[0]

    // TEST was deleted in the dashboard meanwhile: the gateway refuses the env.
    answers[path] = {__status: 404, responseStatus: {errorCode: 'CM-ERRORS-ENVIRONMENTS-001', message: "Environment 'TEST' does not exist on this project"}}
    const r = await run([...READ, '--env', 'TEST', '--json'])
    expect(r.code).toBe(5)
    expect((parseSingleJson(r.stdout) as {error: {code: string}}).error.code).toBe('CM-ERRORS-ENVIRONMENTS-001')

    // The next command reads the list again instead of trusting the cache.
    delete answers[path]
    await run([...READ, '--env', 'TEST'])
    expect(gateway.envHits).toHaveLength(2)
  })

  it('a project whose environments cannot be read runs as before, with one warning on stderr', async () => {
    const {gateway, run} = await project(null)

    const r = await run(READ)

    expect(r.code).toBe(0)
    expect(r.stderr).toContain("Warning: could not read the project's environments")
    expect(gateway.hits).toHaveLength(1)
  })
})
