import {mkdtempSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest'

import {parseCsv, readImportFile} from '../src/lib/user-import.js'
import {cli, makeHome, parseSingleJson, startFakeGateway, type FakeGateway} from './_cli.js'

/**
 * `users import` (N7), `users repair-roles` (N20), `users repair-logins`: new
 * gateway routes the installed SDK has no typed method for yet, sent through
 * BaseCommand.hubRequest. The built CLI runs against a fake gateway.
 */

const IMPORT = '/v3/membership/users/import'
const report = (n: number, dryRun = true) => ({
  result: {dryRun, received: n, imported: dryRun ? 0 : n, valid: dryRun ? n : 0, existing: 0, invalid: 0, failed: 0, rows: [{row: 1, login: 'a@example.com', outcome: dryRun ? 'valid' : 'imported'}]},
})

let gateway: FakeGateway
let home: string
const dir = mkdtempSync(join(tmpdir(), 'norbix-users-admin-'))
const user = (i: number) => ({email: `u${i}@example.com`, hashFormat: 'servicestack-saltedhash', passwordHash: 'SECRET-HASH', passwordSalt: 'SALT'})
const FILE = join(dir, 'users.json')
writeFileSync(FILE, JSON.stringify([user(1), user(2)]))
const BIG = join(dir, 'big.json')
writeFileSync(BIG, JSON.stringify({users: Array.from({length: 1500}, (_, i) => user(i))}))
const ARGS = ['--profile', 'x', '--json']
const NO_ENV = {NORBIX_ENV: undefined}

beforeAll(async () => {
  gateway = await startFakeGateway({
    [IMPORT]: report(2),
    '/v3/membership/users/repair-roles': {result: {dryRun: true, contactsWithoutRoles: 3, contactsToRepair: 2}},
    '/v3/membership/users/repair-logins': {result: {dryRun: true, loginsWithoutProject: 1}},
  })
  home = makeHome(gateway.port)
})

afterAll(async () => {
  await gateway.close()
})

beforeEach(() => {
  gateway.hits.length = 0
})

const bodies = () => gateway.hits.map((h) => JSON.parse(h.body) as {dryRun: boolean; users?: unknown[]})

describe('norbix users import', () => {
  it('checks by default: one POST with dryRun: true and the rows as given; no env needed for a check', async () => {
    const r = await cli(home, ['users', 'import', FILE, ...ARGS], NO_ENV)
    expect(r.code).toBe(0)
    expect(gateway.hits.map((h) => `${h.method} ${h.url}`)).toEqual([`POST ${IMPORT}`])
    expect(bodies()[0]).toEqual({dryRun: true, ignoreDefaultRoles: false, users: [user(1), user(2)]})
    expect(parseSingleJson(r.stdout)).toMatchObject({dryRun: true, received: 2, valid: 2})
  })

  it('--apply writes, and needs a named environment (the env rule for changes)', async () => {
    const refused = await cli(home, ['users', 'import', FILE, '--apply', ...ARGS], NO_ENV)
    expect(refused.code).toBe(2)
    expect((parseSingleJson(refused.stdout) as {error: {code: string}}).error.code).toBe('ENV_REQUIRED')
    expect(gateway.hits).toHaveLength(0)

    const ok = await cli(home, ['users', 'import', FILE, '--apply', '--env', 'TEST', '--ignore-default-roles', ...ARGS], NO_ENV)
    expect(ok.code).toBe(0)
    expect(bodies()[0]).toMatchObject({dryRun: false, ignoreDefaultRoles: true})
  })

  it('more than 1000 users: requests of 1000, row numbers continue across them', async () => {
    const r = await cli(home, ['users', 'import', BIG, ...ARGS], NO_ENV)
    expect(r.code).toBe(0)
    expect(bodies().map((b) => b.users?.length)).toEqual([1000, 500])
    const merged = parseSingleJson(r.stdout) as {received: number; rows: Array<{row: number}>}
    expect(merged.received).toBe(4) // the fake answers 2 per request
    expect(merged.rows.map((x) => x.row)).toEqual([1, 1001])
  })

  it('--dry-run sends nothing and never prints a hash or salt', async () => {
    const r = await cli(home, ['users', 'import', FILE, '--dry-run', ...ARGS], NO_ENV)
    expect(r.code).toBe(0)
    expect(gateway.hits).toHaveLength(0)
    expect(r.stdout).not.toContain('SECRET-HASH')
    expect(r.stdout).not.toContain('SALT"')
    expect(parseSingleJson(r.stdout)).toMatchObject({dryRun: true, http: {method: 'POST'}})
  })

  it('the text output is the per-row table and the counts', async () => {
    const r = await cli(home, ['users', 'import', FILE, '--profile', 'x'], NO_ENV)
    expect(r.stdout).toContain('row  outcome')
    expect(r.stdout).toContain('valid')
    expect(r.stdout).toContain('Checked — nothing written. 2 received')
  })
})

describe('reading the file', () => {
  it('CSV: header row, quoted fields, roles split on ";", profile columns into userGeneralInfo', () => {
    const csv = join(dir, 'users.csv')
    writeFileSync(csv, 'email,firstName,roles,hashFormat,passwordHash,passwordSalt,createdOn\r\na@example.com,"Ona, Jr.",Admin;Editor,servicestack-saltedhash,H==,S==,1700000000000\r\n')
    expect(readImportFile(csv)).toEqual([
      {email: 'a@example.com', userGeneralInfo: {firstName: 'Ona, Jr.'}, roles: ['Admin', 'Editor'], hashFormat: 'servicestack-saltedhash', passwordHash: 'H==', passwordSalt: 'S==', createdOn: 1700000000000},
    ])
    expect(parseCsv('a,"b ""q"""\n')).toEqual([['a', 'b "q"']])
  })

  it('an unknown CSV column, or JSON that is not a list of users, is a usage error', () => {
    const bad = join(dir, 'bad.csv')
    writeFileSync(bad, 'email,password\na,b\n')
    expect(() => readImportFile(bad)).toThrow(/Unknown CSV column: password/)
    const notList = join(dir, 'bad.json')
    writeFileSync(notList, '{"x":1}')
    expect(() => readImportFile(notList)).toThrow(/must be a JSON array of users/)
  })
})

describe('norbix users repair-roles / repair-logins', () => {
  it('count by default (dryRun: true), --apply repairs and needs a named environment', async () => {
    for (const kind of ['roles', 'logins']) {
      gateway.hits.length = 0
      expect((await cli(home, ['users', `repair-${kind}`, ...ARGS], NO_ENV)).code).toBe(0)
      expect((await cli(home, ['users', `repair-${kind}`, '--apply', ...ARGS], NO_ENV)).code).toBe(2)
      expect((await cli(home, ['users', `repair-${kind}`, '--apply', '--env', 'PROD', ...ARGS], NO_ENV)).code).toBe(0)
      expect(gateway.hits.map((h) => `${h.url} ${h.body}`)).toEqual([
        `/v3/membership/users/repair-${kind} {"dryRun":true}`,
        `/v3/membership/users/repair-${kind} {"dryRun":false}`,
      ])
    }
  })

  it('prints the counts the Hub returned', async () => {
    const r = await cli(home, ['users', 'repair-roles', '--profile', 'x'], NO_ENV)
    expect(r.stdout).toMatch(/contactsWithoutRoles\s+3/)
    expect(r.stdout).toContain('Counted — nothing written.')
  })
})
