import {runCommand} from '@oclif/test'
import {mkdtempSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {envListAnswer} from './_env.js'

/**
 * The Database commands of matrix sections 03 / 04 that db-routes.test.ts did
 * not reach: schema rename, settings, list settings, embed and the
 * own-records switch; saved aggregates; database integrations; taxonomies and
 * the delete of many terms — and the schema bundle apply of `hub database`.
 * Run the way a user types them, through oclif and the real `@norbix.ai/ts`
 * transport, with `fetch` replaced (runCommand splits its argv on spaces, so
 * no value here has one): the verb, the host, the exact path, the query and
 * the body. Nothing leaves the process.
 */

interface Call {
  method: string
  host: string
  path: string
  query: URLSearchParams
  body?: Record<string, unknown>
}

let calls: Call[]
let realFetch: typeof globalThis.fetch
/** Answers by `VERB path`; anything else gets `{}`. */
let answers: Record<string, unknown>
let printed: string[]
const out = () => printed.join('\n')

const HUB = 'nb-eu-germany.hub.norbix.ai'
const P = '/v3/database'
const SCH = 'sch_7lPCzWonEvTQsheGDCaKq'
const AGG = 'agg_66b2f0a1'
const INT = 'int_4keCkFKOzSwFtgMiA28FRr'
const TAX = 'txn_3kJ9xJ2mQ0aB'

/** What the reads of the read-then-save commands answer unless a test says otherwise. */
const READS = (): Record<string, unknown> => ({
  [`GET ${P}/schemas/${SCH}`]: {
    item: {
      viewId: SCH,
      settings: {softDelete: true, hasRecordOwner: false, description: 'Shop orders', uniqueIndexes: [{fields: ['a', 'b']}], endUserOwnRecords: false},
      embed: {enabled: false, fields: ['title'], embeddingIntegrationId: 'int_emb', perUser: false},
    },
  },
  [`GET ${P}/schemas/${SCH}/list-settings`]: {
    settings: {columns: [{field: 'title', primary: true, linkReference: false}, {field: 'customer', primary: false, linkReference: true}], filters: ['status']},
  },
  [`GET ${P}/aggregates/${AGG}`]: {item: {viewId: AGG, displayName: 'Totals', description: 'Per day', schemaViewId: SCH, pipeline: '[{"$count":"n"}]'}},
  [`GET ${P}/taxonomies/${TAX}`]: {
    item: {
      viewId: TAX,
      name: 'Cities',
      description: 'Where we ship',
      parentId: 'txn_countries',
      dependencies: ['txn_regions'],
      termsMetaDataSchema: {json: '{"type":"object"}', fields: []},
      termsMetaVisualSchema: {json: '{}'},
    },
  },
})

beforeEach(() => {
  printed = []
  vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => {
    printed.push(parts.join(' '))
  })
  calls = []
  answers = READS()
  realFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const envList = envListAnswer(input, init)
    if (envList) return envList
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    const method = init?.method ?? 'GET'
    calls.push({
      method,
      host: url.host,
      path: url.pathname,
      query: url.searchParams,
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined,
    })
    const answer = answers[`${method} ${url.pathname}`] ?? {}
    return new Response(JSON.stringify(answer), {status: 200, headers: {'Content-Type': 'application/json'}})
  }) as typeof globalThis.fetch
})

afterEach(() => {
  vi.restoreAllMocks()
  globalThis.fetch = realFetch
})

const globalArgs = ['--project', 'test-project', '--api-key', 'test-api-key', '--region', 'nb-eu-germany']

const tmp = mkdtempSync(join(tmpdir(), 'nbx-db-coverage-'))
const PIPELINE_FILE = join(tmp, 'totals.json')
const LIST_FILE = join(tmp, 'list.json')
const TERM_FIELDS_FILE = join(tmp, 'term-fields.json')
const MONGO_FILE = join(tmp, 'mongo.json')
writeFileSync(PIPELINE_FILE, JSON.stringify([{$group: {_id: '$day', n: {$sum: 1}}}]))
writeFileSync(LIST_FILE, JSON.stringify({settings: {columns: [{field: 'total'}], filters: []}}))
writeFileSync(TERM_FIELDS_FILE, JSON.stringify({type: 'object', properties: {iso: {type: 'string'}}}))
writeFileSync(MONGO_FILE, JSON.stringify({integration: {viewId: INT, integrationName: 'Main', connectionString: 'mongodb://u:p@db.example.test/shop', databaseName: 'shop'}}))

type Route = [verb: string, path: string]

/** Every request each command sends, in order: [argv, routes] (all on the Hub). */
const routes: Array<[string[], Route[]]> = [
  // Collection new / edit, schema new / edit
  [['db', 'schema', 'rename', SCH, '--title', 'Orders'], [['PUT', `${P}/schemas/${SCH}/rename`]]],
  [['db', 'schema', 'settings', SCH], [['GET', `${P}/schemas/${SCH}`]]],
  [['db', 'schema', 'settings', 'set', SCH, '--record-owner', 'true'], [['GET', `${P}/schemas/${SCH}`], ['PUT', `${P}/schemas/${SCH}/settings`]]],
  [['db', 'schema', 'list-settings', SCH], [['GET', `${P}/schemas/${SCH}/list-settings`]]],
  [['db', 'schema', 'list-settings', 'set', SCH, '--sort', 'title'], [['GET', `${P}/schemas/${SCH}/list-settings`], ['PUT', `${P}/schemas/${SCH}/list-settings`]]],
  [['db', 'schema', 'embed', SCH], [['GET', `${P}/schemas/${SCH}`]]],
  [['db', 'schema', 'embed', 'set', SCH, '--enabled', 'true'], [['GET', `${P}/schemas/${SCH}`], ['PUT', `${P}/schemas/${SCH}/embed`]]],
  [['db', 'schema', 'own-records'], [['POST', `${P}/schemas/end-user-own-records`]]],
  [['hub', 'database', 'schema', 'bundle', 'apply', '--bundleJson', '[]'], [['POST', `${P}/schemas/apply-bundle`]]],

  // Aggregates list, aggregate new / edit
  [['db', 'aggregates', 'get', AGG, '--schema', SCH], [['GET', `${P}/aggregates/${AGG}`]]],
  [['db', 'aggregates', 'save', '--schema', SCH, '--name', 'Totals', '--pipeline', '[]'], [['POST', `${P}/aggregates`]]],
  [['db', 'aggregates', 'save', '--schema', SCH, '--id', AGG, '--name', 'Daily'], [['GET', `${P}/aggregates/${AGG}`], ['POST', `${P}/aggregates`]]],
  [['db', 'aggregates', 'test', 'orders', '--pipeline', '[]'], [['POST', `${P}/aggregates/test`]]],
  [['db', 'aggregates', 'delete', AGG, '--schema', SCH, '--yes'], [['DELETE', `${P}/aggregates/${AGG}`]]],

  // DB integrations
  [['db', 'integration', 'save', '--name', 'Main', '--connection-string', 'mongodb://db.example.test/shop'], [['POST', `${P}/integrations`]]],
  [['db', 'integration', 'enable', INT], [['PUT', `${P}/integrations/${INT}/enable`]]],
  [['db', 'integration', 'disable', INT, '--yes'], [['PUT', `${P}/integrations/${INT}/disable`]]],
  [['db', 'integration', 'delete', INT, '--yes'], [['DELETE', `${P}/integrations/${INT}`]]],
  [['db', 'integrations', 'flex-tiers'], [['GET', `${P}/integrations/flex-tiers`]]],

  // Taxonomies list, taxonomy new / edit
  [['db', 'taxonomies', 'tree'], [['GET', `${P}/taxonomies/tree`]]],
  [['db', 'taxonomy', 'delete', TAX, '--yes'], [['DELETE', `${P}/taxonomies/${TAX}`]]],
  [['db', 'taxonomy', 'save', '--name', 'Countries'], [['POST', `${P}/taxonomies`]]],
  [['db', 'taxonomy', 'save', '--id', TAX, '--description', 'Cities'], [['GET', `${P}/taxonomies/${TAX}`], ['POST', `${P}/taxonomies`]]],

  // Terms list
  [['db', 'term', 'delete-many', TAX, '--filter', '{"name":"Old"}', '--yes'], [['DELETE', `${P}/taxonomies/${TAX}/terms/many`]]],
]

describe('every new Database command reaches its route on the Hub', () => {
  for (const [argv, expected] of routes) {
    it(`${argv.join(' ')} → ${expected.map(([verb, path]) => `${verb} ${path}`).join(', ')}`, async () => {
      const {error} = await runCommand([...argv, ...globalArgs])

      expect(error).toBeUndefined()
      expect(calls.map((c) => [c.method, c.path, c.host])).toEqual(expected.map(([verb, path]) => [verb, path, HUB]))
    })
  }
})

/** Runs one command and returns its last request (the write of a read-then-save). */
async function send(argv: string[]): Promise<Call> {
  const {error} = await runCommand([...argv, ...globalArgs])
  expect(error).toBeUndefined()
  const last = calls.at(-1)
  expect(last).toBeDefined()
  return last as Call
}

/** Runs a --dry-run --json command: nothing may be sent; returns the request it shows. */
async function dryRun(argv: string[]): Promise<Record<string, unknown>> {
  const {error, stdout} = await runCommand([...argv, '--dry-run', '--json', ...globalArgs])
  expect(error).toBeUndefined()
  expect(calls).toHaveLength(0)
  return (JSON.parse(stdout || out()) as {request: Record<string, unknown>}).request
}

describe('db schema', () => {
  it('rename sends the title', async () => {
    expect((await send(['db', 'schema', 'rename', SCH, '--title', 'Orders'])).body).toEqual({title: 'Orders'})
  })

  it('settings set resends the replaced fields and leaves out the kept ones', async () => {
    const call = await send(['db', 'schema', 'settings', 'set', SCH, '--record-owner', 'true'])
    // uniqueIndexes / endUserOwnRecords are not sent: the gateway keeps them.
    expect(call.body).toEqual({settings: {softDelete: true, hasRecordOwner: true, description: 'Shop orders'}})
  })

  it('settings set: --unique replaces the combinations, --clear-unique empties them, --clear-description drops the description', async () => {
    expect((await send(['db', 'schema', 'settings', 'set', SCH, '--unique', 'childId,date', '--unique', 'code,year'])).body).toMatchObject({
      settings: {uniqueIndexes: [{fields: ['childId', 'date']}, {fields: ['code', 'year']}]},
    })
    expect(((await send(['db', 'schema', 'settings', 'set', SCH, '--clear-unique'])).body?.settings as Record<string, unknown>).uniqueIndexes).toEqual([])
    const cleared = (await send(['db', 'schema', 'settings', 'set', SCH, '--clear-description', '--own-records', 'true'])).body?.settings
    expect(cleared).toEqual({softDelete: true, hasRecordOwner: false, endUserOwnRecords: true})
  })

  it('settings show prints the settings of the published schema', async () => {
    const {error} = await runCommand(['db', 'schema', 'settings', SCH, ...globalArgs])
    expect(error).toBeUndefined()
    expect(out()).toContain('"description": "Shop orders"')
  })

  it('list-settings set keeps a kept column\'s linkReference, moves the primary, sets sort and filters', async () => {
    const call = await send(['db', 'schema', 'list-settings', 'set', SCH, '--columns', 'customer,total', '--primary', 'total', '--sort', 'total', '--desc', '--filters', 'status,day'])
    expect(call.body).toEqual({
      settings: {
        columns: [
          {field: 'customer', primary: false, linkReference: true},
          {field: 'total', primary: true, linkReference: false},
        ],
        defaultSort: {field: 'total', order: -1},
        filters: ['status', 'day'],
      },
    })
  })

  it('list-settings set --file sends the file as the whole layout, with no read', async () => {
    const call = await send(['db', 'schema', 'list-settings', 'set', SCH, '--file', `@${LIST_FILE}`])
    expect(calls.map((c) => c.method)).toEqual(['PUT'])
    expect(call.body).toEqual({settings: {columns: [{field: 'total'}], filters: []}})
  })

  it('list-settings set with no saved layout and no --columns is refused: nothing is saved', async () => {
    answers[`GET ${P}/schemas/${SCH}/list-settings`] = {}
    const {error} = await runCommand(['db', 'schema', 'list-settings', 'set', SCH, '--sort', 'title', ...globalArgs])
    expect(error?.message).toMatch(/No list layout is saved/)
    expect(calls.map((c) => c.method)).toEqual(['GET'])
  })

  it('list-settings set with no saved layout and --columns saves those columns', async () => {
    answers[`GET ${P}/schemas/${SCH}/list-settings`] = {}
    expect((await send(['db', 'schema', 'list-settings', 'set', SCH, '--columns', 'title,total'])).body).toEqual({
      settings: {columns: [{field: 'title', primary: false, linkReference: false}, {field: 'total', primary: false, linkReference: false}]},
    })
  })

  it('list-settings set --dry-run shows only the fields passed', async () => {
    expect(await dryRun(['db', 'schema', 'list-settings', 'set', SCH, '--sort', 'title', '--desc'])).toEqual({id: SCH, settings: {defaultSort: {field: 'title', order: -1}}})
  })

  it('embed set merges the change into the stored setting', async () => {
    expect((await send(['db', 'schema', 'embed', 'set', SCH, '--enabled', 'true', '--fields', 'title,body'])).body).toEqual({
      embed: {enabled: true, fields: ['title', 'body'], embeddingIntegrationId: 'int_emb', perUser: false},
    })
    expect(((await send(['db', 'schema', 'embed', 'set', SCH, '--default-embedding-integration'])).body?.embed as Record<string, unknown>)).not.toHaveProperty(
      'embeddingIntegrationId',
    )
  })

  it('own-records previews by default and with --enable alone; --enable with --yes turns the switch on', async () => {
    expect((await send(['db', 'schema', 'own-records'])).body).toEqual({dryRun: true, enable: []})
    expect((await send(['db', 'schema', 'own-records', '--enable', 'orders,invoices'])).body).toEqual({dryRun: true, enable: ['orders', 'invoices']})
    expect((await send(['db', 'schema', 'own-records', '--enable', 'orders', '--yes'])).body).toEqual({dryRun: false, enable: ['orders']})
  })

  it('a schema bundle apply sends the bundle', async () => {
    expect((await send(['hub', 'database', 'schema', 'bundle', 'apply', '--bundleJson', '[]'])).body).toMatchObject({bundleJson: '[]'})
  })

  for (const argv of [
    ['db', 'schema', 'settings', 'set', SCH, '--soft-delete', 'false'],
    ['db', 'schema', 'list-settings', 'set', SCH, '--columns', 'title'],
    ['db', 'schema', 'embed', 'set', SCH, '--enabled', 'true'],
  ]) {
    it(`${argv.slice(1, 4).join(' ')} --dry-run sends nothing, not even the read`, async () => {
      const request = await dryRun(argv)
      expect(request).toHaveProperty('id', SCH)
    })
  }

  it('settings set --dry-run shows only the fields passed', async () => {
    expect(await dryRun(['db', 'schema', 'settings', 'set', SCH, '--soft-delete', 'false'])).toEqual({id: SCH, settings: {softDelete: false}})
  })

  for (const argv of [
    ['db', 'schema', 'settings', 'set', SCH, '--soft-delete', 'false'],
    ['db', 'schema', 'embed', 'set', SCH, '--enabled', 'true'],
  ]) {
    it(`${argv.slice(1, 4).join(' ')} stops when the schema cannot be read: nothing is saved`, async () => {
      answers[`GET ${P}/schemas/${SCH}`] = {}
      const {error} = await runCommand([...argv, ...globalArgs])
      expect(error?.message).toContain(`Could not read the current schema ${SCH}`)
      expect(calls.map((c) => c.method)).toEqual(['GET'])
    })
  }

  for (const argv of [
    ['db', 'schema', 'settings', 'set', SCH],
    ['db', 'schema', 'list-settings', 'set', SCH],
    ['db', 'schema', 'embed', 'set', SCH],
  ]) {
    it(`${argv.slice(1, 4).join(' ')} with nothing to change is refused before anything is sent`, async () => {
      const {error} = await runCommand([...argv, ...globalArgs])
      expect(error?.message).toMatch(/Pass at least one/)
      expect(calls).toHaveLength(0)
    })
  }
})

describe('db aggregates', () => {
  it('get sends the schema id in the query', async () => {
    const call = await send(['db', 'aggregates', 'get', AGG, '--schema', SCH])
    expect(call.query.get('schemaId')).toBe(SCH)
  })

  it('save creates with the name, the description and the pipeline as a JSON string', async () => {
    const call = await send(['db', 'aggregates', 'save', '--schema', SCH, '--name', 'Totals', '--description', 'Per', '--pipeline', `@${PIPELINE_FILE}`])
    expect(call.body).toEqual({schemaId: SCH, displayName: 'Totals', description: 'Per', pipeline: '[{"$group":{"_id":"$day","n":{"$sum":1}}}]'})
  })

  it('save --id reads the aggregate and resends the name, the description and the pipeline', async () => {
    const call = await send(['db', 'aggregates', 'save', '--schema', SCH, '--id', AGG, '--name', 'Daily'])
    expect(calls[0]?.query.get('schemaId')).toBe(SCH)
    expect(call.body).toEqual({viewId: AGG, schemaId: SCH, displayName: 'Daily', description: 'Per day', pipeline: '[{"$count":"n"}]'})
  })

  it('save --id --dry-run sends nothing, not even the read, and shows only the change', async () => {
    expect(await dryRun(['db', 'aggregates', 'save', '--schema', SCH, '--id', AGG, '--name', 'Daily'])).toEqual({viewId: AGG, schemaId: SCH, displayName: 'Daily'})
  })

  it('save --id stops when the aggregate cannot be read: nothing is saved', async () => {
    answers[`GET ${P}/aggregates/${AGG}`] = {}
    const {error} = await runCommand(['db', 'aggregates', 'save', '--schema', SCH, '--id', AGG, '--name', 'Daily', ...globalArgs])
    expect(error?.message).toContain(`Could not read the current aggregate ${AGG}`)
    expect(calls.map((c) => c.method)).toEqual(['GET'])
  })

  it('save without --id needs --name and --pipeline', async () => {
    const {error} = await runCommand(['db', 'aggregates', 'save', '--schema', SCH, '--name', 'Totals', ...globalArgs])
    expect(error?.message).toMatch(/needs --name and --pipeline/)
    expect(calls).toHaveLength(0)
  })

  it('test sends the collection, the pipeline and the tokens', async () => {
    const call = await send(['db', 'aggregates', 'test', 'orders', '--pipeline', '[{"$match":{"s":"{S}"}}]', '--tokens', '{"S":"paid"}', '--integration', INT])
    expect(call.body).toEqual({collectionName: 'orders', pipeline: '[{"$match":{"s":"{S}"}}]', tokens: {S: 'paid'}, databaseIntegrationId: INT})
  })

  it('delete sends the schema id in the query', async () => {
    const call = await send(['db', 'aggregates', 'delete', AGG, '--schema', SCH, '--yes'])
    expect(call.query.get('schemaId')).toBe(SCH)
  })
})

describe('db integration', () => {
  it('save sends a connection-string integration', async () => {
    const call = await send(['db', 'integration', 'save', '--name', 'Main', '--connection-string', 'mongodb://u:p@db.example.test', '--database', 'shop'])
    expect(call.body).toEqual({
      integration: {provider: 'MongoDbConnectionString', integrationName: 'Main', isEnabled: true, connectionString: 'mongodb://u:p@db.example.test', databaseName: 'shop'},
    })
  })

  it('save --keyless sends authMode Keyless and the audience', async () => {
    const call = await send(['db', 'integration', 'save', '--name', 'Main', '--connection-string', 'mongodb+srv://cluster0.example.test', '--keyless', '--audience', 'my-aud'])
    expect(call.body?.integration).toMatchObject({authMode: 'Keyless', audience: 'my-aud', connectionString: 'mongodb+srv://cluster0.example.test'})
  })

  it('save --config: a viewId in the file is sent as the integrationId', async () => {
    const call = await send(['db', 'integration', 'save', '--config', `@${MONGO_FILE}`])
    expect(call.body?.integration).toMatchObject({integrationId: INT, integrationName: 'Main', databaseName: 'shop', provider: 'MongoDbConnectionString'})
  })

  it('save --dry-run sends nothing and never prints the connection string', async () => {
    const {error, stdout} = await runCommand(['db', 'integration', 'save', '--name', 'Main', '--connection-string', 'mongodb://u:Secret-1@db.example.test', '--dry-run', ...globalArgs])
    expect(error).toBeUndefined()
    expect(calls).toHaveLength(0)
    expect(`${stdout}\n${out()}`).not.toContain('Secret-1')
    expect(`${stdout}\n${out()}`).toContain('"connectionString": "***"')
  })

  it('save without a connection string is refused before anything is sent', async () => {
    const {error} = await runCommand(['db', 'integration', 'save', '--name', 'Main', ...globalArgs])
    expect(error?.message).toMatch(/--connection-string/)
    expect(calls).toHaveLength(0)
  })
})

describe('db taxonomy / taxonomies / term delete-many', () => {
  it('taxonomy save creates with the name, description, parent and dependencies', async () => {
    const call = await send(['db', 'taxonomy', 'save', '--name', 'Cities', '--description', 'Ship', '--parent', 'txn_c', '--depends-on', 'txn_r,txn_s'])
    expect(call.body).toEqual({taxonomyName: 'Cities', description: 'Ship', parentId: 'txn_c', dependencies: ['txn_r', 'txn_s']})
  })

  it('taxonomy save --id reads the taxonomy and resends everything, the term schemas as JSON text', async () => {
    const call = await send(['db', 'taxonomy', 'save', '--id', TAX, '--term-fields', `@${TERM_FIELDS_FILE}`, '--clear-parent'])
    expect(call.body).toEqual({
      viewId: TAX,
      taxonomyName: 'Cities',
      description: 'Where we ship',
      dependencies: ['txn_regions'],
      termsMetaDataSchema: '{"type":"object","properties":{"iso":{"type":"string"}}}',
      termsMetaVisualSchema: '{}',
    })
  })

  it('taxonomy save --id --dry-run sends nothing, not even the read', async () => {
    expect(await dryRun(['db', 'taxonomy', 'save', '--id', TAX, '--description', 'New'])).toEqual({viewId: TAX, description: 'New'})
  })

  it('taxonomy save --id stops when the taxonomy cannot be read: nothing is saved', async () => {
    answers[`GET ${P}/taxonomies/${TAX}`] = {}
    const {error} = await runCommand(['db', 'taxonomy', 'save', '--id', TAX, '--description', 'New', ...globalArgs])
    expect(error?.message).toContain(`Could not read the current taxonomy ${TAX}`)
    expect(calls.map((c) => c.method)).toEqual(['GET'])
  })

  it('taxonomies tree sends includeTerms and allLanguages', async () => {
    const call = await send(['db', 'taxonomies', 'tree', '--include-terms'])
    expect(call.query.get('includeTerms')).toBe('true')
    expect(call.query.get('allLanguages')).toBe('false')
  })

  it('term delete-many sends the filter in the query; --all sends an empty filter', async () => {
    expect((await send(['db', 'term', 'delete-many', TAX, '--filter', '{"name":"Old"}', '--yes'])).query.get('filter')).toBe('{"name":"Old"}')
    expect((await send(['db', 'term', 'delete-many', TAX, '--all', '--yes'])).query.get('filter')).toBe('{}')
  })

  it('term delete-many refuses an empty filter and points at --all', async () => {
    const {error} = await runCommand(['db', 'term', 'delete-many', TAX, '--filter', '{}', '--yes', ...globalArgs])
    expect(error?.message).toMatch(/matches every term/)
    expect(calls).toHaveLength(0)
  })
})

describe('destructive Database commands ask first', () => {
  for (const argv of [
    ['db', 'aggregates', 'delete', AGG, '--schema', SCH],
    ['db', 'integration', 'disable', INT],
    ['db', 'integration', 'delete', INT],
    ['db', 'taxonomy', 'delete', TAX],
    ['db', 'term', 'delete-many', TAX, '--all'],
  ]) {
    it(`${argv.slice(1, 3).join(' ')} without --yes in a non-interactive shell sends nothing`, async () => {
      const {error} = await runCommand([...argv, ...globalArgs])
      expect(error?.message).toMatch(/Confirmation required/)
      expect(calls).toHaveLength(0)
    })

    it(`${argv.slice(1, 3).join(' ')} --dry-run sends nothing`, async () => {
      const {error} = await runCommand([...argv, '--dry-run', ...globalArgs])
      expect(error).toBeUndefined()
      expect(calls).toHaveLength(0)
    })
  }
})
