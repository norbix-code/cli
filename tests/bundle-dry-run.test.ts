import {afterEach, describe, expect, it} from 'vitest'

import {cli, makeHome, parseSingleJson, startFakeGateway, type FakeGateway} from './_cli.js'

/**
 * `hub database schema bundle apply --dry-run`: besides the request, the
 * bundle JSON is checked by the Hub's read-only validateSchema, so a dry run
 * no longer says "fine" about a bundle the real call rejects.
 */

let gateway: FakeGateway | undefined

afterEach(async () => {
  await gateway?.close()
  gateway = undefined
})

const BUNDLE = '[{"id":"posts","fields":[{"name":"title","type":"text"}]}]'
const APPLY = ['hub', 'database', 'schema', 'bundle', 'apply', '--bundleJson', BUNDLE, '--profile', 'x', '--dry-run']

interface Report {
  dryRun: boolean
  method: string
  http: {url: string}
  validation: {checked: boolean; valid?: boolean; issues?: unknown[]; collections?: string[]; note?: string; checkedWith?: string}
}

describe('schema bundle apply --dry-run', () => {
  it('a valid bundle: the Hub check is in the report, exit 0, only the check was sent', async () => {
    gateway = await startFakeGateway({'/v3/account/ai/schemas/validate': {valid: true, issues: [], collections: ['posts']}})
    const r = await cli(makeHome(gateway.port), [...APPLY, '--json'])
    expect(r.code).toBe(0)
    const doc = parseSingleJson(r.stdout) as Report
    expect(doc.method).toBe('hub.database.applyDatabaseSchemaBundle')
    expect(doc.http.url).toMatch(/\/v3\/database\/schemas\/apply-bundle$/)
    expect(doc.validation).toEqual({checkedWith: 'hub.account.validateSchema', checked: true, valid: true, issues: [], collections: ['posts']})
    expect(gateway.hits.map((h) => `${h.method} ${h.url}`)).toEqual(['POST /v3/account/ai/schemas/validate'])
    expect(JSON.parse(gateway.hits[0].body)).toEqual({schemaJson: BUNDLE})
  })

  it('an invalid bundle: the issues are printed and the exit code is 6', async () => {
    gateway = await startFakeGateway({
      '/v3/account/ai/schemas/validate': {valid: false, issues: [{where: 'posts.title', code: 'UNKNOWN_TYPE', message: 'type "text" is not a field type'}]},
    })
    const json = await cli(makeHome(gateway.port), [...APPLY, '--json'])
    expect(json.code).toBe(6)
    expect((parseSingleJson(json.stdout) as Report).validation).toMatchObject({checked: true, valid: false})

    const text = await cli(makeHome(gateway.port), APPLY)
    expect(text.code).toBe(6)
    expect(text.stdout).toContain('Checked by the Hub (hub.account.validateSchema): NOT valid — the real call would fail:')
    expect(text.stdout).toContain('  - posts.title UNKNOWN_TYPE: type "text" is not a field type')
  })

  it('catalog entities only: nothing to check, the report says so and nothing is sent', async () => {
    gateway = await startFakeGateway()
    const r = await cli(makeHome(gateway.port), ['hub', 'database', 'schema', 'bundle', 'apply', '--entities', 'blog_posts', '--profile', 'x', '--dry-run', '--json'])
    expect(r.code).toBe(0)
    expect((parseSingleJson(r.stdout) as Report).validation).toMatchObject({checked: false})
    expect(gateway.hits).toEqual([])
  })

  it('other hub dry runs are unchanged: no validation, nothing sent', async () => {
    gateway = await startFakeGateway()
    const r = await cli(makeHome(gateway.port), ['hub', 'scheduler', 'task', 'delete', 'abc123', '--profile', 'x', '--dry-run', '--json'])
    expect(r.code).toBe(0)
    expect(parseSingleJson(r.stdout)).not.toHaveProperty('validation')
    expect(gateway.hits).toEqual([])
  })
})
