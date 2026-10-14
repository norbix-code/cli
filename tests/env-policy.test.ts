import {appendFileSync, mkdirSync, mkdtempSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest'

import {cli, makeHome, parseSingleJson, startFakeGateway, type FakeGateway} from './_cli.js'

/**
 * Pickio N-21: a change never lands in PROD by default. The CLI's twin of the
 * MCP surface's AiToolEnvPolicy (BaseCommand.assertWriteEnv). The built CLI
 * runs as a child with pipes — a script or an agent, never a terminal.
 */

let gateway: FakeGateway
let home: string
const NO_ENV = {NORBIX_ENV: undefined}

beforeAll(async () => {
  gateway = await startFakeGateway()
  home = makeHome(gateway.port)
  appendFileSync(
    join(home, '.norbix', 'config'),
    [`[xprod]`, `host=127.0.0.1:${gateway.port}`, 'api_key=k', 'project_id=p', 'env=PROD', `[xtest]`, `host=127.0.0.1:${gateway.port}`, 'api_key=k', 'project_id=p', 'env=TEST', ''].join('\n'),
  )
})

afterAll(async () => {
  await gateway.close()
})

beforeEach(() => {
  gateway.hits.length = 0
})

const INSERT = ['db', 'insert', 'orders', '--doc', '{"n":1}', '--json']
const errorOf = (stdout: string) => (parseSingleJson(stdout) as {error: {code: string; message: string; hint: string; exit: number}}).error

describe('a change with no environment, or PROD only from a saved default, is refused', () => {
  it('no env anywhere: exit 2 ENV_REQUIRED, the hint names --env TEST / --env PROD, nothing is sent', async () => {
    const r = await cli(home, [...INSERT, '--profile', 'x'], NO_ENV)
    expect(r.code).toBe(2)
    const e = errorOf(r.stdout)
    expect(e.code).toBe('ENV_REQUIRED')
    expect(e.message).toBe('`db insert` changes data and no environment is set, so it would run in PROD.')
    expect(e.hint).toContain('--env TEST')
    expect(e.hint).toContain('--env PROD to change PROD on purpose')
    expect(gateway.hits).toHaveLength(0)
  })

  it('--yes does not answer it', async () => {
    const r = await cli(home, ['db', 'delete', 'orders', '--id', 'abc', '--yes', '--json', '--profile', 'x'], NO_ENV)
    expect(errorOf(r.stdout).code).toBe('ENV_REQUIRED')
    expect(gateway.hits).toHaveLength(0)
  })

  it('PROD saved in the profile is not enough: exit 2 PROD_NOT_EXPLICIT', async () => {
    const r = await cli(home, [...INSERT, '--profile', 'xprod'], NO_ENV)
    expect(r.code).toBe(2)
    expect(errorOf(r.stdout)).toMatchObject({code: 'PROD_NOT_EXPLICIT'})
    expect(errorOf(r.stdout).message).toContain('PROD comes only from a saved default (profile [xprod])')
    expect(gateway.hits).toHaveLength(0)
  })

  it('PROD saved in the repo file (.norbix/project.json) is not enough either', async () => {
    const repo = mkdtempSync(join(tmpdir(), 'norbix-env-policy-'))
    mkdirSync(join(repo, '.norbix'))
    writeFileSync(join(repo, '.norbix', 'project.json'), JSON.stringify({host: `127.0.0.1:${gateway.port}`, projectId: 'p', env: 'PROD'}))
    const r = await cli(home, [...INSERT, '--api-key', 'k'], {...NO_ENV, NORBIX_PROJECT_CONFIG: undefined}, repo)
    expect(errorOf(r.stdout).code).toBe('PROD_NOT_EXPLICIT')
    expect(errorOf(r.stdout).message).toContain('project file')
  })

  it('dynamic writes (hub …) and raw writes follow the same rule', async () => {
    const hub = await cli(home, ['hub', 'scheduler', 'delete', 'task', '--id', 'abc', '--yes', '--json', '--profile', 'x'], NO_ENV)
    expect(errorOf(hub.stdout).code).toBe('ENV_REQUIRED')
    const raw = await cli(home, ['raw', '/v3/scheduler/tasks', '-X', 'POST', '--json', '--profile', 'x'], NO_ENV)
    expect(errorOf(raw.stdout).code).toBe('ENV_REQUIRED')
    expect(gateway.hits).toHaveLength(0)
  })
})

describe('what is allowed', () => {
  it('--env TEST, --env PROD, NORBIX_ENV=PROD: the change is sent', async () => {
    expect((await cli(home, [...INSERT, '--profile', 'x', '--env', 'TEST'], NO_ENV)).code).toBe(0)
    expect((await cli(home, [...INSERT, '--profile', 'x', '--env', 'PROD'], NO_ENV)).code).toBe(0)
    expect((await cli(home, [...INSERT, '--profile', 'x'], {NORBIX_ENV: 'PROD'})).code).toBe(0)
    expect((await cli(home, [...INSERT, '--profile', 'xprod', '--env', 'PROD'], NO_ENV)).code).toBe(0)
    expect(gateway.hits).toHaveLength(4)
  })

  it('a saved default that is not PROD (profile, repo file, env use) is used', async () => {
    const r = await cli(home, [...INSERT, '--profile', 'xtest'], NO_ENV)
    expect(r.code).toBe(0)
    expect(gateway.hits).toHaveLength(1)
  })

  it('reads keep the default (no env = the server default)', async () => {
    expect((await cli(home, ['db', 'find', 'orders', '--json', '--profile', 'x'], NO_ENV)).code).toBe(0)
    expect((await cli(home, ['hub', 'scheduler', 'tasks', 'get', '--json', '--profile', 'x'], NO_ENV)).code).toBe(0)
    // POST reads through hub/api: aggregates and distinct values are not changes
    expect((await cli(home, ['api', 'database', 'distinct', '--collectionName', 'orders', '--field', 'status', '--json', '--profile', 'x'], NO_ENV)).code).toBe(0)
    expect((await cli(home, ['api', 'database', 'aggregate', '--collectionName', 'orders', '--pipeline', '[]', '--json', '--profile', 'x'], NO_ENV)).code).toBe(0)
  })

  it('a dry run sends nothing, so it is never refused', async () => {
    expect((await cli(home, [...INSERT, '--dry-run', '--profile', 'x'], NO_ENV)).code).toBe(0)
    expect(gateway.hits).toHaveLength(0)
  })

  it('project- and account-wide settings are not inside an environment', async () => {
    const r = await cli(home, ['project', 'set-name', 'Pickio', '--json', '--profile', 'x'], NO_ENV)
    expect(r.stdout).not.toContain('ENV_REQUIRED')
  })
})
