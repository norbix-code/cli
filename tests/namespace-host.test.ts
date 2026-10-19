import {mkdirSync, mkdtempSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest'

import {BaseCommand} from '../src/base.js'
import {knownFlags} from '../src/lib/namespace-command.js'
import {seedDefaultHost} from '../test/seed.js'
import {cli, startFakeGateway, type FakeGateway} from './_cli.js'

/**
 * `norbix hub` / `norbix api` split their argv themselves: global flags go
 * to oclif, the rest become request fields. --host was missing from that
 * list, so it became a body field and the call went to the [default]
 * profile's host instead of the one named by --host.
 */

let byDefault: FakeGateway
let byFlag: FakeGateway
let home: string

beforeAll(async () => {
  byDefault = await startFakeGateway()
  byFlag = await startFakeGateway()
  home = mkdtempSync(join(tmpdir(), 'norbix-host-'))
  mkdirSync(join(home, '.norbix'), {recursive: true})
  // The owner's setup: a [default] profile on another host (hub.finlo.space there).
  writeFileSync(join(home, '.norbix', 'config'), ['[default]', `host=127.0.0.1:${byDefault.port}`, 'api_key=k', 'project_id=p', ''].join('\n'))
  seedDefaultHost(home)
})

afterAll(async () => {
  await byDefault.close()
  await byFlag.close()
})

beforeEach(() => {
  byDefault.hits.length = 0
  byFlag.hits.length = 0
})

const target = () => ['--host', `127.0.0.1:${byFlag.port}`, '--api-key', 'k2', '--project', 'p2']

describe('--host on the generic commands', () => {
  it('hub <request> --host X goes to X, not to the [default] profile host', async () => {
    const r = await cli(home, ['hub', 'scheduler', 'tasks', 'get', ...target(), '--json'])
    expect(r.code, r.stderr).toBe(0)
    expect(byDefault.hits).toHaveLength(0)
    expect(byFlag.hits).toHaveLength(1)
    expect(byFlag.hits[0].url).toContain('/scheduler')
  })

  it('hub: --host and --language never become request fields', async () => {
    const r = await cli(home, ['hub', 'scheduler', 'task', 'save', '--name', 'nightly', ...target(), '--language', 'lt', '--json'])
    expect(r.code, r.stderr).toBe(0)
    expect(byDefault.hits).toHaveLength(0)
    expect(byFlag.hits).toHaveLength(1)
    const body = JSON.parse(byFlag.hits[0].body) as Record<string, unknown>
    expect(body.name).toBe('nightly')
    expect(body).not.toHaveProperty('host')
    expect(body).not.toHaveProperty('language')
  })

  it('--host=X (one token) works too', async () => {
    const r = await cli(home, ['hub', 'scheduler', 'tasks', 'get', `--host=127.0.0.1:${byFlag.port}`, '--api-key', 'k2', '--project', 'p2', '--json'])
    expect(r.code, r.stderr).toBe(0)
    expect(byDefault.hits).toHaveLength(0)
    expect(byFlag.hits).toHaveLength(1)
  })

  it('api <request> --host X goes to X and does not send host in the body', async () => {
    const r = await cli(home, ['api', 'membership', 'user', 'delete', 'abc123', ...target(), '--yes', '--json'])
    expect(r.code, r.stderr).toBe(0)
    expect(byDefault.hits).toHaveLength(0)
    expect(byFlag.hits).toHaveLength(1)
    expect(byFlag.hits[0].url).toContain('abc123')
    expect(byFlag.hits[0].url).not.toContain('host')
    expect(byFlag.hits[0].body).not.toContain('"host"')
  })
})

describe('the split is derived from the declared flags', () => {
  it('every global flag is known, so none can fall through to the body', () => {
    const {VALUE_FLAGS, BOOL_FLAGS} = knownFlags(BaseCommand.baseFlags)
    for (const name of Object.keys(BaseCommand.baseFlags)) {
      expect(VALUE_FLAGS.has(`--${name}`) || BOOL_FLAGS.has(`--${name}`), name).toBe(true)
    }

    expect(VALUE_FLAGS.has('--host')).toBe(true)
    expect(VALUE_FLAGS.has('--language')).toBe(true)
    expect(BOOL_FLAGS.has('--prod')).toBe(true)
    expect(BOOL_FLAGS.has('--json')).toBe(true)
  })

  it('a command flag with a short name is known by both names', () => {
    const {BOOL_FLAGS} = knownFlags(BaseCommand.mutatingFlags)
    expect([...BOOL_FLAGS].sort()).toEqual(['--dry-run', '--json', '--yes', '-y'])
  })
})
