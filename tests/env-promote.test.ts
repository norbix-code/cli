import {mkdtempSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {afterEach, describe, expect, it} from 'vitest'

import {lowerEnvOf, parseChoices, promotionHint} from '../src/lib/promotion.js'
import {ENVS_PATH, cli, makeHome, parseSingleJson, startFakeGateway, type FakeGateway} from './_cli.js'

/**
 * Promotion phase 2 (docs/tasks/promotion-phase2.md): `norbix env promote /
 * rollback / built-ins repair`, seen from outside as an agent sees them, and
 * the promotion hint of content commands. The fixture is the gateway's own
 * contract example (gateway/docs/tasks/promotion-v2.md, "Preview / result
 * contract") plus its deleted-collection and name-match lines.
 */

const PROMOTE = '/v3/account/projects/environments/promote'
const ROLLBACK = '/v3/account/projects/environments/promote/rollback'
const REPAIR = '/v3/account/projects/environments/built-ins/repair'

/** The contract example of phase 1, one line of each kind, plus a deleted collection and a name match. */
const PLAN = {
  summary: {
    added: 1, changed: 1, unchanged: 2, deleted: 1, kept: 0, skipped: 0, recordsAtRisk: 1,
    integrationsSeeded: 0, integrationsSkipped: 2, integrationsMapped: 0, integrationsRemoved: 0, isNoOp: false,
  },
  items: [
    {type: 'Schema', id: 'sch_3jucP9sDknGQ7R4zBwQKc4', name: 'orders', status: 'added', builtIn: false},
    {type: 'Schema', id: 'sch_src', name: 'faq', status: 'changed', matchedBy: 'name', previousTargetId: 'sch_old', builtIn: false, note: 'matched by name; the collection takes the source id, its records stay'},
    {type: 'Schema', id: 'sch_gone', name: 'legacy_faq', status: 'deleted', recordCount: 1, builtIn: false, note: "collection 'legacy_faq': 1 records would be deleted (they stay in the database and come back if you roll back)"},
    {type: 'EmailTemplate', id: 'tmpl_6kbXOl8AX1HdVMyFwURznj', name: 'Password reset', status: 'unchanged', matchedBy: 'id', builtIn: true},
    {type: 'Taxonomy', id: 'txn_1', name: 'Shipping status', status: 'unchanged', matchedBy: 'id', builtIn: false},
  ],
  integrations: [
    {
      module: 'Database', id: 'int_db', name: 'TEST database', provider: 'MongoDbConnectionString', status: 'skipped',
      defaultAction: 'skip', action: 'skip', holdsSecret: true, isFake: false, realSender: false,
      targets: [{id: 'int_prod_db', name: 'Primary Database', provider: 'MongoDbConnectionString', isDefault: true}],
    },
    {
      module: 'Email', id: 'int_mailgun', name: 'mailgun', provider: 'MailGun', status: 'skipped',
      defaultAction: 'skip', action: 'skip', holdsSecret: true, isFake: false, realSender: true,
      targets: [{id: 'int_fake', name: 'Test Me', provider: 'Fake', isDefault: true}],
    },
  ],
  notPromoted: [
    {area: 'Users, system users and their API keys', scope: 'environment', reason: 'each environment keeps its own users in its own database'},
    {area: 'Roles and policies', scope: 'project', reason: 'not environment-scoped — unchanged'},
  ],
  requiresConfirmation: true,
  contentMirrored: [], contentDeleted: [], integrationsSeeded: [], integrationsSkipped: [],
  blockers: [], termChanges: [{taxonomyId: 'txn_1', termId: 't1', slug: 'shipped', change: 'created'}],
  warnings: [], fromVersion: null, wasDryRun: true,
}

let gateway: FakeGateway | undefined

afterEach(async () => {
  await gateway?.close()
  gateway = undefined
})

async function project(answers: Record<string, unknown>, environments = ['PROD', 'TEST'], promotionOrder?: string[]) {
  gateway = await startFakeGateway({
    [ENVS_PATH]: {item: {environments, ...(promotionOrder ? {promotionOrder} : {})}},
    ...answers,
  })
  const home = makeHome(gateway.port)
  const run = (argv: string[]) => cli(home, [...argv, '--profile', 'x'])
  return {gateway, run}
}

const bodies = (g: FakeGateway, path: string) => g.hits.filter((h) => h.url.split('?')[0] === path).map((h) => JSON.parse(h.body) as Record<string, unknown>)

describe('norbix env promote', () => {
  it('previews by default: sends dryRun true, prints the readable plan, changes nothing, exit 0', async () => {
    const {gateway, run} = await project({[PROMOTE]: {item: PLAN}})

    const r = await run(['env', 'promote', '--from', 'test', '--to', 'prod'])

    expect(r.code).toBe(0)
    expect(bodies(gateway, PROMOTE)).toEqual([{sourceEnv: 'TEST', targetEnv: 'PROD', dryRun: true}])
    expect(r.stdout).toMatchSnapshot()
  })

  it('--dry-run --json prints the Hub answer as it is (one JSON document)', async () => {
    const {gateway, run} = await project({[PROMOTE]: {item: PLAN}})

    const r = await run(['env', 'promote', '--from', 'TEST', '--to', 'PROD', '--dry-run', '--json'])

    expect(r.code).toBe(0)
    expect((parseSingleJson(r.stdout) as {item: unknown}).item).toEqual(PLAN)
    expect(bodies(gateway, PROMOTE)[0].dryRun).toBe(true)
  })

  it('--yes runs it for real with the choices and the record-loss consent, and prints the rollback anchor', async () => {
    const done = {...PLAN, wasDryRun: false, fromVersion: 279, requiresConfirmation: false}
    const {gateway, run} = await project({[PROMOTE]: {item: done}})

    const r = await run([
      'env', 'promote', '--from', 'TEST', '--to', 'PROD', '--yes', '--confirm-record-loss',
      '--seed', 'int_mailgun', '--skip', 'int_x', '--map', 'int_db=int_prod_db',
    ])

    expect(r.code).toBe(0)
    expect(bodies(gateway, PROMOTE)).toEqual([{
      sourceEnv: 'TEST', targetEnv: 'PROD', dryRun: false, confirmRecordLoss: true,
      integrationChoices: [
        {id: 'int_mailgun', action: 'seed'},
        {id: 'int_x', action: 'skip'},
        {id: 'int_db', action: 'map', mapToId: 'int_prod_db'},
      ],
    }])
    expect(r.stdout).toContain('Promoted TEST → PROD.')
    expect(r.stdout).toContain('Rollback anchor: fromVersion 279. To undo: norbix env rollback --to PROD --version 279')
  })

  it('a real run that would hide records: the plan, then exit 3 with the gateway code and the flag to add', async () => {
    const {run} = await project({
      [PROMOTE]: {__status: 400, item: PLAN, responseStatus: {errorCode: 'CM-ERRORS-ENVIRONMENTS-013', message: 'Record loss not confirmed.'}},
    })

    const text = await run(['env', 'promote', '--from', 'TEST', '--to', 'PROD', '--yes'])
    expect(text.code).toBe(3)
    expect(text.stdout).toContain('DELETED (1)')
    expect(text.stderr).toContain('The promotion would hide records in PROD')
    expect(text.stderr).toContain('--confirm-record-loss')

    const json = await run(['env', 'promote', '--from', 'TEST', '--to', 'PROD', '--yes', '--json'])
    expect(json.code).toBe(3)
    const err = (parseSingleJson(json.stdout) as {error: {code: string; context?: {plan?: unknown}}}).error
    expect(err.code).toBe('CM-ERRORS-ENVIRONMENTS-013')
    expect(err.context?.plan).toEqual(PLAN)
  })

  it('refuses bad input before sending: the same env twice, a malformed --map, one id with two choices', async () => {
    const {gateway, run} = await project({[PROMOTE]: {item: PLAN}})

    expect((await run(['env', 'promote', '--from', 'PROD', '--to', 'prod'])).code).toBe(2)
    expect((await run(['env', 'promote', '--from', 'TEST', '--to', 'PROD', '--map', 'int_db'])).code).toBe(2)
    expect((await run(['env', 'promote', '--from', 'TEST', '--to', 'PROD', '--seed', 'a', '--skip', 'a'])).code).toBe(2)
    expect((await run(['env', 'promote', '--from', 'TEST', '--to', 'PROD', '--dry-run', '--yes'])).code).toBe(2)
    expect(gateway.hits).toEqual([])
  })

  it('is not held by the env rule: no --env needed on a project with TEST and PROD', async () => {
    const {gateway, run} = await project({[PROMOTE]: {item: PLAN}})

    const r = await run(['env', 'promote', '--from', 'TEST', '--to', 'PROD', '--json'])

    expect(r.code).toBe(0)
    expect(gateway.hits).toHaveLength(1)
  })

  it('the old generic path still works: hub account environment promote --body', async () => {
    const {gateway, run} = await project({[PROMOTE]: {item: PLAN}})

    const r = await run(['hub', 'account', 'environment', 'promote', '--body', '{"sourceEnv":"TEST","targetEnv":"PROD","dryRun":true}', '--json'])

    expect(r.code).toBe(0)
    expect(bodies(gateway, PROMOTE)).toEqual([{sourceEnv: 'TEST', targetEnv: 'PROD', dryRun: true}])
  })
})

describe('norbix env rollback', () => {
  it('previews by default and runs with --yes', async () => {
    const plan = {
      ...PLAN,
      summary: {...PLAN.summary, added: 0, changed: 0, integrationsRemoved: 1},
      integrations: [{...PLAN.integrations[1], status: 'removed'}],
    }
    const {gateway, run} = await project({[ROLLBACK]: {item: plan}})

    const preview = await run(['env', 'rollback', '--to', 'PROD', '--version', '279'])
    const real = await run(['env', 'rollback', '--to', 'PROD', '--version', '279', '--yes', '--confirm-record-loss'])

    expect(preview.code).toBe(0)
    expect(real.code).toBe(0)
    expect(bodies(gateway, ROLLBACK)).toEqual([
      {targetEnv: 'PROD', fromVersion: 279, dryRun: true},
      {targetEnv: 'PROD', fromVersion: 279, dryRun: false, confirmRecordLoss: true},
    ])
    expect(preview.stdout).toMatchSnapshot()
    expect(real.stdout).toContain('Rolled back PROD.')
  })
})

describe('norbix env built-ins repair', () => {
  it('previews by default, repairs with --yes, one env with --target', async () => {
    const answer = {
      items: [{
        env: 'TEST', isNoOp: false, items: [
          {type: 'EmailTemplate', id: 'tmpl_6kbXOl8AX1HdVMyFwURznj', name: 'Password reset', status: 'present', builtIn: true},
          {type: 'EmailFooter', id: 'ftr_1', name: 'Default', status: 'realigned', previousTargetId: 'ftr_old', builtIn: true, note: 'takes PROD\'s id'},
        ],
      }],
    }
    const {gateway, run} = await project({[REPAIR]: answer})

    const preview = await run(['env', 'built-ins', 'repair'])
    const real = await run(['env', 'built-ins', 'repair', '--target', 'test', '--yes', '--json'])

    expect(preview.code).toBe(0)
    expect(real.code).toBe(0)
    expect(bodies(gateway, REPAIR)).toEqual([{dryRun: true}, {dryRun: false, environmentName: 'TEST'}])
    expect(preview.stdout).toMatchSnapshot()
    expect(parseSingleJson(real.stdout)).toEqual(answer)
  })
})

describe('the promotion hint', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'norbix-hint-')), 'orders.json')
  writeFileSync(file, '{"type":"object","properties":{"title":{"type":"string"}}}')
  const SCHEMA = ['db', 'schema', 'create', '--name', 'orders', '--file', file]

  it('a content write into PROD of a project with TEST prints the hint on stderr; stdout stays one JSON document', async () => {
    const {run} = await project({}, ['PROD', 'TEST'], ['TEST', 'PROD'])

    const r = await run([...SCHEMA, '--env', 'PROD', '--json'])

    expect(r.stderr).toContain('Note: PROD is promoted from TEST — make the change in TEST and run `norbix env promote --from TEST --to PROD`')
    expect(() => parseSingleJson(r.stdout)).not.toThrow()
  })

  it('names the env right below on a longer ladder, also on a --dry-run', async () => {
    const {gateway, run} = await project({}, ['PROD', 'STAGING', 'TEST'], ['TEST', 'STAGING', 'PROD'])

    const prod = await run([...SCHEMA, '--env', 'PROD'])
    const staging = await run([...SCHEMA, '--env', 'STAGING'])
    expect(prod.stderr).toContain('Note: PROD is promoted from STAGING')
    expect(staging.stderr).toContain('Note: STAGING is promoted from TEST')

    const dry = await run([...SCHEMA, '--env', 'PROD', '--dry-run'])
    expect(dry.stderr).toContain('Note: PROD is promoted from STAGING')
    expect(gateway.hits.filter((h) => h.method === 'POST')).toHaveLength(2)
  })

  it('no hint for the lowest env, a PROD-only project, a record write, or a read', async () => {
    const two = await project({}, ['PROD', 'TEST'], ['TEST', 'PROD'])
    expect((await two.run([...SCHEMA, '--env', 'TEST'])).stderr).not.toContain('promoted from')
    expect((await two.run(['db', 'insert', 'orders', '--doc', '{"title":"x"}', '--env', 'PROD'])).stderr).not.toContain('promoted from')
    expect((await two.run(['db', 'schemas', '--env', 'PROD'])).stderr).not.toContain('promoted from')
    await gateway?.close()

    const prodOnly = await project({}, ['PROD'], ['PROD'])
    expect((await prodOnly.run(SCHEMA)).stderr).not.toContain('promoted from')
  })

  it('an older gateway with no ladder: PROD falls back to TEST', async () => {
    const {run} = await project({}, ['PROD', 'TEST'])

    expect((await run([...SCHEMA, '--env', 'PROD'])).stderr).toContain('Note: PROD is promoted from TEST')
  })
})

describe('promotion helpers', () => {
  it('lowerEnvOf, parseChoices and the hint text', () => {
    expect({
      ladder: lowerEnvOf('PROD', ['DEV', 'TEST', 'PROD'], undefined),
      lowest: lowerEnvOf('DEV', ['DEV', 'TEST', 'PROD'], undefined),
      noLadderQa: lowerEnvOf('PROD', undefined, ['PROD', 'QA']),
      noLadderTest: lowerEnvOf('PROD', undefined, ['PROD', 'QA', 'TEST']),
      noLadderStaging: lowerEnvOf('STAGING', undefined, ['PROD', 'STAGING', 'TEST']),
      choices: parseChoices({seed: ['a'], map: ['b=c']}),
      hint: promotionHint('PROD', 'TEST'),
    }).toEqual({
      ladder: 'TEST',
      lowest: undefined,
      noLadderQa: 'QA',
      noLadderTest: 'TEST',
      noLadderStaging: undefined,
      choices: [{id: 'a', action: 'seed'}, {id: 'b', action: 'map', mapToId: 'c'}],
      hint: 'PROD is promoted from TEST — make the change in TEST and run `norbix env promote --from TEST --to PROD`',
    })
  })
})
