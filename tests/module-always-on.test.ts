import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest'

import {cli, makeHome, parseSingleJson, startFakeGateway, type FakeGateway} from './_cli.js'

/**
 * Membership and Database are always on (owner, 2026-11-13): the gateway has
 * no enable or disable route for them. The built CLI runs as a child process
 * against a fake gateway, so the exit code, stdout and stderr are what a
 * person or an agent sees:
 *
 * - `module enable membership|database` is a no-op, exit 0, like the other
 *   "nothing to change" answers (`project cors add`, `env promote`);
 * - `module disable membership|database` is refused, usage error, exit 2.
 *
 * Nothing reaches the gateway in either case.
 */

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

describe.each(['membership', 'database'])('module … %s', (name) => {
  it(`module enable ${name} prints the always-on line, exit 0, nothing sent`, async () => {
    const r = await cli(home, ['module', 'enable', name, '--profile', 'x'])

    expect(r.code).toBe(0)
    expect(r.stdout.trim()).toBe('Membership and Database are always on — nothing to enable.')
    expect(gateway.hits).toEqual([])
  })

  it(`module enable ${name} --json answers one JSON document, exit 0`, async () => {
    const r = await cli(home, ['module', 'enable', name, '--profile', 'x', '--json'])

    expect(r.code).toBe(0)
    expect(parseSingleJson(r.stdout)).toEqual({module: name, alwaysOn: true, changed: false})
    expect(gateway.hits).toEqual([])
  })

  it(`module disable ${name} --yes is a usage error, exit 2, nothing sent`, async () => {
    const r = await cli(home, ['module', 'disable', name, '--profile', 'x', '--yes'])

    expect(r.code).toBe(2)
    expect(r.stderr).toContain('Membership and Database are always on; they cannot be disabled.')
    expect(gateway.hits).toEqual([])
  })
})
