import {afterEach, describe, expect, it} from 'vitest'

import {cli, makeHome, parseSingleJson, startFakeGateway, type FakeGateway} from './_cli.js'

/**
 * What a script sees: the built CLI runs as a child process against a fake
 * gateway on a local port. Nothing else is contacted.
 */
const RUN = 'trr_1p4R3gTobGZpD6fX'
const TRG = 'trg_8d1e0b'
const RUNS = '/v3/triggers/runs'

let gateway: FakeGateway | undefined

afterEach(async () => {
  await gateway?.close()
  gateway = undefined
})

async function run(args: string[], answers: Record<string, unknown> = {}) {
  gateway = await startFakeGateway(answers)
  return cli(makeHome(gateway.port), [...args, '--profile', 'x'])
}

describe('trigger runs and run', () => {
  const page = {list: {items: [{runId: RUN, status: 'failed', error: 'no template'}], hasMore: false}}

  it('prints a table with the reason', async () => {
    const r = await run(['trigger', 'runs', 'Schema', TRG], {[RUNS]: page})
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('failed — no template')
    expect(r.stdout).toContain(RUN)
  })

  it('--json prints the page as the Hub sent it', async () => {
    const r = await run(['trigger', 'runs', 'Schema', TRG, '--json'], {[RUNS]: page})
    expect(r.code).toBe(0)
    expect((parseSingleJson(r.stdout) as typeof page).list).toEqual(page.list)
  })

  it('reads one run', async () => {
    const r = await run(['trigger', 'run', RUN, '--type', 'Schema'], {
      [`${RUNS}/${RUN}`]: {item: {runId: RUN, status: 'succeeded', executionIdentityIsDefault: true}},
    })
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('Project triggers (default)')
  })
})

describe('identities', () => {
  const path = '/v3/membership/execution-identities'

  it('lists them', async () => {
    const r = await run(['identities', 'list'], {
      [path]: {identities: [{id: 'usr_1', name: 'Project triggers', isDefault: true, status: 'Active', canAssign: true}]},
    })
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('Project triggers (default)')
  })

  it('prints the new id', async () => {
    const r = await run(['identities', 'create', '--name', 'Orders bot', '--role', 'Editor'], {[path]: {id: 'usr_2'}})
    expect(r.code).toBe(0)
    expect(r.stdout.trim()).toBe('Identity usr_2 created.')
    expect(JSON.parse(gateway!.hits[0]!.body)).toEqual({name: 'Orders bot', roleIds: ['Editor']})
  })
})

describe('scheduler save', () => {
  it('runs as the identity, with no --initiator', async () => {
    const r = await run([
      'scheduler', 'save', '--name', 'Digest', '--cron', '0 9 * * 1', '--template', 't1', '--integration', 'i1',
      '--audience', 'all-users', '--execution-identity', 'usr_1', '--yes',
    ])
    expect(r.code).toBe(0)
    const body = JSON.parse(gateway!.hits[0]!.body) as Record<string, unknown>
    expect(body.executionIdentityId).toBe('usr_1')
    expect(body).not.toHaveProperty('initiatorUserId')
  })
})

describe.each(['email', 'sms', 'push'])('%s', (channel) => {
  const stats = {stats: {batches: 1, sent: 9, failed: 1, blocked: 3, removedRecipients: 2, successRate: 90}}

  it('campaign --stats prints the blocked and removed lines', async () => {
    const r = await run([channel, 'campaign', 'cmp_1', '--stats'], {
      [`/v3/notifications/${channel}/campaigns/cmp_1/stats`]: stats,
    })
    expect(r.code).toBe(0)
    expect(r.stdout).toMatch(/Blocked:\s+3/)
    expect(r.stdout).toMatch(/Removed:\s+2/)
  })

  it('campaign --stats --json stays the Hub answer', async () => {
    const r = await run([channel, 'campaign', 'cmp_1', '--stats', '--json'], {
      [`/v3/notifications/${channel}/campaigns/cmp_1/stats`]: stats,
    })
    expect(parseSingleJson(r.stdout)).toEqual(stats)
  })
})

describe('template warnings', () => {
  const warned = {id: 'tpl_1', warnings: ['Tag news is not enabled on Push.']}
  const update = ['push', 'template', 'update', 'tpl_1', '--name', 'A', '--title', 'B', '--body', 'C']

  it('go to stderr after the result', async () => {
    const r = await run(update, {'/v3/notifications/push/templates': warned})
    expect(r.code).toBe(0)
    expect(r.stdout.trim()).toBe('Template tpl_1 updated.')
    expect(r.stderr).toContain('Tag news is not enabled on Push.')
  })

  it('leave stdout the one JSON document with --json', async () => {
    const r = await run([...update, '--json'], {'/v3/notifications/push/templates': warned})
    expect(r.code).toBe(0)
    expect(parseSingleJson(r.stdout)).toEqual(warned)
    expect(r.stderr).toContain('Tag news is not enabled on Push.')
  })
})

describe('the audience help', () => {
  it('offers no TriggerSubject on a campaign field', async () => {
    const r = await run(['hub', 'notifications', 'createSmsCampaign', '--help'])
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('deliveryType')
    expect(r.stdout).not.toContain('TriggerSubject')
  })
})
