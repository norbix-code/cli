import {mkdtempSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'

import DbSchemaDelete from '../src/commands/db/schema/delete.js'

/**
 * One row per `db` command: run it the way a user types it, through oclif and
 * the real `@norbix.ai/ts` transport, and check the verb and path of the
 * request it sends — then, for the commands that build a body, the body.
 *
 * `fetch` is replaced, so nothing leaves the process and no database is
 * touched. A wrong route token (`{Id}` vs `{TaxonomyId}`) fails here.
 */

const ID = '66b2f0a1'
const TAX = 't4x0n0my'
const COL = 'orders'
const USER = 'u5e7'

interface Call {
  method: string
  path: string
  query: URLSearchParams
  body?: Record<string, unknown>
}

let calls: Call[]
let realFetch: typeof globalThis.fetch

beforeEach(() => {
  calls = []
  realFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    calls.push({
      method: init?.method ?? 'GET',
      path: url.pathname,
      query: url.searchParams,
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined,
    })
    return new Response('{}', {status: 200, headers: {'Content-Type': 'application/json'}})
  }) as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
})

const globalArgs = ['--project', 'test-project', '--api-key', 'test-api-key', '--region', 'nb-eu-germany']

// Files the "from a JSON file" commands read. No value contains a space:
// @oclif/test's runCommand splits argv on spaces.
const dir = mkdtempSync(join(tmpdir(), 'norbix-db-routes-'))
const TRIGGER_FILE = join(dir, 'trigger.json')
const WRAPPED_TRIGGER_FILE = join(dir, 'wrapped-trigger.json')
const SCHEMA_FILE = join(dir, 'orders.schema.json')
const UI_FILE = join(dir, 'orders.ui.json')
const SEED_FILE = join(dir, 'seed.json')
const trigger = {name: 'Notify', schemaId: 'sch_1', events: ['Insert'], action: {type: 'Email', templateId: 'tpl_1'}}
const dataSchema = {type: 'object', properties: {status: {type: 'string'}}}
const uiSchema = {status: {'ui:widget': 'select'}}
const seed = [{collectionName: COL, count: 3}]
writeFileSync(TRIGGER_FILE, JSON.stringify(trigger))
writeFileSync(WRAPPED_TRIGGER_FILE, JSON.stringify({trigger}))
writeFileSync(SCHEMA_FILE, JSON.stringify(dataSchema))
writeFileSync(UI_FILE, JSON.stringify(uiSchema))
writeFileSync(SEED_FILE, JSON.stringify(seed))

const P = '/v2/database'

/** [argv, verb, path] — argv without the leading `db`. */
const routes: Array<[string[], string, string]> = [
  // Records (data-plane API)
  [['find', COL], 'GET', `${P}/collections/${COL}`],
  [['get', COL, ID], 'GET', `${P}/collections/${COL}/${ID}`],
  [['count', COL], 'GET', `${P}/collections/${COL}/count`],
  [['distinct', COL, 'status'], 'GET', `${P}/collections/${COL}/distinct`],
  [['insert', COL, '--doc', '{"status":"new"}'], 'POST', `${P}/collections/${COL}`],
  [['insert-many', COL, '--docs', '[{"status":"new"}]'], 'POST', `${P}/collections/${COL}/many`],
  [['update', COL, '--id', ID, '--update', '{"status":"paid"}'], 'PUT', `${P}/collections/${COL}/${ID}`],
  [['update', COL, '--many', '--filter', '{"status":"new"}', '--update', '{"status":"paid"}', '--yes'], 'PUT', `${P}/collections/${COL}/many`],
  [['update', COL, '--all', '--update', '{"status":"paid"}', '--yes'], 'PUT', `${P}/collections/${COL}/many`],
  [['replace', COL, '--id', ID, '--doc', '{"status":"new"}'], 'PUT', `${P}/collections/${COL}/${ID}/replace`],
  [['delete', COL, '--id', ID, '--yes'], 'DELETE', `${P}/collections/${COL}/${ID}`],
  [['delete', COL, '--many', '--filter', '{"status":"new"}', '--yes'], 'DELETE', `${P}/collections/${COL}/many`],
  [['delete', COL, '--all', '--yes'], 'DELETE', `${P}/collections/${COL}/many`],
  [['aggregate', COL, '--pipeline', '[]'], 'POST', `${P}/collections/${COL}/aggregate`],
  [['aggregate', COL, '--id', ID], 'POST', `${P}/collections/${COL}/aggregates/${ID}/execute`],
  [['change-owner', COL, ID, '--user', USER], 'PUT', `${P}/collections/${COL}/${ID}/responsibility`],

  // Collections (Hub)
  [['indexes', COL], 'GET', `${P}/collections/${COL}/indexes`],
  [['seed', '--collections', JSON.stringify(seed), '--yes'], 'POST', `${P}/collections/seed`],
  [['aggregates'], 'GET', `${P}/aggregates`],

  // Schemas
  [['schemas'], 'GET', `${P}/schemas`],
  [['schema', ID], 'GET', `${P}/schemas/${ID}`],
  [['schema', 'create', '--name', COL, '--file', SCHEMA_FILE], 'POST', `${P}/schemas`],
  [['schema', 'update', ID, '--file', SCHEMA_FILE], 'PUT', `${P}/schemas/${ID}/draft`],
  [['schema', 'draft', ID], 'GET', `${P}/schemas/${ID}/draft`],
  [['schema', 'discard', ID, '--yes'], 'DELETE', `${P}/schemas/${ID}/draft`],
  [['schema', 'publish', ID, '--yes'], 'POST', `${P}/schemas/${ID}/publish`],
  [['schema', 'delete', ID, '--yes'], 'DELETE', `${P}/schemas/${ID}`],
  [['schema', 'versions', ID], 'GET', `${P}/schemas/${ID}/versions`],
  [['schema', 'diff', ID, '--from', '1', '--to', '2'], 'GET', `${P}/schemas/${ID}/versions/diff`],

  // Schema triggers
  [['triggers'], 'GET', `${P}/schemas/triggers`],
  [['trigger', ID], 'GET', `${P}/schemas/triggers/${ID}`],
  [['trigger', 'create', '--file', TRIGGER_FILE], 'POST', `${P}/schemas/triggers`],
  [['trigger', 'enable', ID], 'PATCH', `${P}/schemas/triggers/${ID}/enable`],
  [['trigger', 'disable', ID, '--yes'], 'PATCH', `${P}/schemas/triggers/${ID}/disable`],
  [['trigger', 'delete', ID, '--yes'], 'DELETE', `${P}/schemas/triggers/${ID}`],

  // Integrations
  [['integrations'], 'GET', `${P}/integrations`],
  [['integration', ID], 'GET', `${P}/integrations/${ID}`],
  [['integration', 'test', ID], 'POST', `${P}/integrations/test`],
  [['integration', 'default', ID], 'PUT', `${P}/integrations/${ID}/default`],

  // Taxonomies and terms
  [['taxonomies'], 'GET', `${P}/taxonomies`],
  [['taxonomy', TAX], 'GET', `${P}/taxonomies/${TAX}`],
  [['terms', 'countries'], 'GET', `${P}/taxonomies/countries/terms`],
  [['terms', 'countries', '--parent', ID], 'GET', `${P}/taxonomies/countries/terms/${ID}/children`],
  [['term', TAX, ID], 'GET', `${P}/taxonomies/${TAX}/terms/${ID}`],
  [['term', 'tree', 'countries'], 'GET', `${P}/taxonomies/countries/terms/tree`],
  [['term', 'tree', 'countries', '--merged'], 'GET', `${P}/taxonomies/countries/merged-tree`],
  [['term', 'create', TAX, '--doc', '{"name":"Lithuania"}'], 'POST', `${P}/taxonomies/${TAX}/terms`],
  [['term', 'update', TAX, ID, '--set', '{"order":1}'], 'PUT', `${P}/taxonomies/${TAX}/terms/${ID}`],
  [['term', 'delete', TAX, ID, '--yes'], 'DELETE', `${P}/taxonomies/${TAX}/terms/${ID}`],
]

describe('every db command reaches its route', () => {
  for (const [argv, verb, path] of routes) {
    it(`db ${argv.join(' ')} → ${verb} ${path}`, async () => {
      const {error} = await runCommand(['db', ...argv, ...globalArgs])

      expect(error).toBeUndefined()
      expect(calls).toHaveLength(1)
      expect(calls[0]?.method).toBe(verb)
      expect(calls[0]?.path).toBe(path)
    })
  }
})

it('covers 47 distinct db routes', () => {
  // `db distinct`/`db delete`/`db update`/`db aggregate` each have two shapes;
  // count distinct verb + path pairs so a duplicated row is caught.
  expect(new Set(routes.map(([, verb, path]) => `${verb} ${path}`)).size).toBe(47)
})

/** Run a command and return the one request it sent. */
async function callOf(argv: string[]): Promise<Call> {
  const {error} = await runCommand(['db', ...argv, ...globalArgs])
  expect(error).toBeUndefined()
  expect(calls).toHaveLength(1)
  return calls[0] as Call
}

async function bodyOf(argv: string[]): Promise<Record<string, unknown>> {
  return (await callOf(argv)).body ?? {}
}

/** Query and body of one request, as one object (DELETE sends its fields in the query). */
async function sentOf(argv: string[]): Promise<Record<string, unknown>> {
  const call = await callOf(argv)
  return {...Object.fromEntries(call.query), ...call.body}
}

describe('db update / delete of many records', () => {
  it('update --many sends the filter and the plain fields, without allRecords', async () => {
    expect(await bodyOf(['update', COL, '--many', '--filter', '{"status":"new"}', '--update', '{"status":"paid"}', '--yes'])).toEqual({
      filter: '{"status":"new"}',
      update: '{"status":"paid"}',
    })
  })

  it('update --all sends an empty filter with allRecords: true', async () => {
    expect(await bodyOf(['update', COL, '--all', '--update', '{"status":"paid"}', '--yes'])).toEqual({
      filter: '{}',
      allRecords: true,
      update: '{"status":"paid"}',
    })
  })

  it('delete --many sends the filter, without allRecords', async () => {
    const sent = await sentOf(['delete', COL, '--many', '--filter', '{"status":"new"}', '--yes'])
    expect(sent).toMatchObject({filter: '{"status":"new"}'})
    expect(sent).not.toHaveProperty('allRecords')
  })

  it('delete --all sends an empty filter with allRecords: true', async () => {
    expect(await sentOf(['delete', COL, '--all', '--yes'])).toMatchObject({filter: '{}', allRecords: 'true'})
  })

  for (const command of ['update', 'delete']) {
    const update = command === 'update' ? ['--update', '{"status":"paid"}'] : []

    it(`${command} --many with an empty filter is refused and points at --all`, async () => {
      const {error} = await runCommand(['db', command, COL, '--many', '--filter', '{}', ...update, '--yes', ...globalArgs])
      expect(error?.message).toMatch(/matches every record/)
      expect(calls).toHaveLength(0)
    })

    it(`${command} --all without --yes in a non-interactive shell sends nothing`, async () => {
      const {error} = await runCommand(['db', command, COL, '--all', ...update, ...globalArgs])
      expect(error?.message).toMatch(/Confirmation required: .*EVERY record/)
      expect(calls).toHaveLength(0)
    })

    it(`${command} --all cannot be combined with --filter`, async () => {
      const {error} = await runCommand(['db', command, COL, '--all', '--many', '--filter', '{"a":1}', ...update, '--yes', ...globalArgs])
      expect(error?.message).toMatch(/cannot also be provided/)
      expect(calls).toHaveLength(0)
    })
  }

  it('update with a $ operator is refused before anything is sent', async () => {
    const {error} = await runCommand(['db', 'update', COL, '--id', ID, '--update', '{"$inc":{"n":1}}', ...globalArgs])
    expect(error?.message).toMatch(/\$inc; a record update takes the plain fields/)
    expect(calls).toHaveLength(0)
  })

  it('update with a JSON array is refused', async () => {
    const {error} = await runCommand(['db', 'update', COL, '--id', ID, '--update', '[1]', ...globalArgs])
    expect(error?.message).toMatch(/must be a JSON object/)
    expect(calls).toHaveLength(0)
  })
})

describe('db term', () => {
  // The taxonomy and term ids travel in the path (rows above), not the body.
  it('create sends the term as a JSON string document', async () => {
    expect(await bodyOf(['term', 'create', TAX, '--doc', '{"name":"Lithuania","order":1}'])).toEqual({
      document: '{"name":"Lithuania","order":1}',
    })
  })

  it('update sends the fields to $set as a JSON string', async () => {
    expect(await bodyOf(['term', 'update', TAX, ID, '--set', '{"order":2}', '--integration', 'db_1'])).toEqual({
      databaseIntegrationId: 'db_1',
      update: '{"order":2}',
    })
  })

  it('terms passes the filter, page size and sort in the query', async () => {
    const {query} = await callOf(['terms', 'countries', '--filter', '{"name":"Lithuania"}', '--page-size', '5', '--desc'])
    expect(query.get('filter')).toBe('{"name":"Lithuania"}')
    expect(query.get('pageSize')).toBe('5')
    expect(query.get('sortDescending')).toBe('true')
  })

  it('tree passes the root term and the depth', async () => {
    const {query} = await callOf(['term', 'tree', 'countries', '--root', ID, '--depth', '2'])
    expect(query.get('rootTermId')).toBe(ID)
    expect(query.get('depth')).toBe('2')
  })

  it('tree refuses --merged together with --root', async () => {
    const {error} = await runCommand(['db', 'term', 'tree', 'countries', '--merged', '--root', ID, ...globalArgs])
    expect(error?.message).toMatch(/cannot also be provided/)
    expect(calls).toHaveLength(0)
  })

  it('delete without --yes in a non-interactive shell sends nothing', async () => {
    const {error} = await runCommand(['db', 'term', 'delete', TAX, ID, ...globalArgs])
    expect(error?.message).toMatch(/Confirmation required/)
    expect(calls).toHaveLength(0)
  })
})

describe('db trigger', () => {
  it('create sends the file as the trigger, with type Schema added', async () => {
    expect(await bodyOf(['trigger', 'create', '--file', TRIGGER_FILE])).toEqual({trigger: {type: 'Schema', ...trigger}})
  })

  it('create accepts a file that already holds {"trigger": ...}, and --schema / --id win', async () => {
    expect(await bodyOf(['trigger', 'create', '--file', WRAPPED_TRIGGER_FILE, '--schema', 'sch_2', '--id', ID])).toEqual({
      trigger: {type: 'Schema', ...trigger, schemaId: 'sch_2', triggerId: ID},
    })
  })

  it('create reports a file that is not JSON and sends nothing', async () => {
    const bad = join(dir, 'bad.json')
    writeFileSync(bad, 'not-json')
    const {error} = await runCommand(['db', 'trigger', 'create', '--file', bad, ...globalArgs])
    expect(error?.message).toMatch(/--file is not valid JSON/)
    expect(calls).toHaveLength(0)
  })

  for (const verb of ['enable', 'disable', 'delete']) {
    it(`${verb} sends triggerType Schema and the schema id`, async () => {
      const argv = ['trigger', verb, ID, '--schema', 'sch_1', ...(verb === 'enable' ? [] : ['--yes'])]
      const call = await callOf(argv)
      const sent = {...Object.fromEntries(call.query), ...call.body}
      expect(sent).toMatchObject({triggerType: 'Schema', schemaId: 'sch_1'})
    })
  }
})

describe('db integration', () => {
  it('test sends the integration id in the body', async () => {
    expect(await bodyOf(['integration', 'test', ID])).toEqual({integrationId: ID})
  })
})

describe('db schema writes', () => {
  it('create sends the name, the data schema and the UI schema as JSON strings', async () => {
    expect(
      await bodyOf(['schema', 'create', '--name', COL, '--file', SCHEMA_FILE, '--ui-file', UI_FILE, '--settings', '{"softDelete":true}']),
    ).toEqual({
      schemaName: COL,
      dataSchema: JSON.stringify(dataSchema),
      visualSchema: JSON.stringify(uiSchema),
      settings: {softDelete: true},
    })
  })

  it('update writes the draft from the file', async () => {
    expect(await bodyOf(['schema', 'update', ID, '--file', SCHEMA_FILE])).toEqual({dataSchema: JSON.stringify(dataSchema)})
  })

  it('update with neither file sends nothing', async () => {
    const {error} = await runCommand(['db', 'schema', 'update', ID, ...globalArgs])
    expect(error?.message).toMatch(/--file, --ui-file/)
    expect(calls).toHaveLength(0)
  })

  it('publish sends confirmed: true', async () => {
    expect(await bodyOf(['schema', 'publish', ID, '--yes'])).toEqual({confirmed: true})
  })

  it('publish without --yes in a non-interactive shell sends nothing', async () => {
    const {error} = await runCommand(['db', 'schema', 'publish', ID, ...globalArgs])
    expect(error?.message).toMatch(/Confirmation required/)
    expect(calls).toHaveLength(0)
  })

  it('delete without --yes in a non-interactive shell warns that the records go too, and sends nothing', async () => {
    const {error} = await runCommand(['db', 'schema', 'delete', ID, ...globalArgs])
    expect(error?.message).toBe(`Confirmation required: Delete schema ${ID} and all its records in this environment?`)
    expect(calls).toHaveLength(0)
  })

  it('delete help says the records are dropped and when the delete is refused', () => {
    expect(DbSchemaDelete.description).toContain('Delete a database schema and its records')
    expect(DbSchemaDelete.description).toContain('CM-ERRORS-SCHEMA-017')
    expect(DbSchemaDelete.description).toContain('CM-ERRORS-SCHEMA-018')
  })

  it('diff passes both versions in the query', async () => {
    const {query} = await callOf(['schema', 'diff', ID, '--from', '1', '--to', '3'])
    expect(query.get('fromVersion')).toBe('1')
    expect(query.get('toVersion')).toBe('3')
  })
})

describe('db seed / change-owner', () => {
  it('seed sends the mode and the collections as a JSON string', async () => {
    expect(await bodyOf(['seed', '--collections', `@${SEED_FILE}`, '--mode', 'realistic', '--yes'])).toEqual({
      mode: 'realistic',
      collections: JSON.stringify(seed),
    })
  })

  it('seed defaults to dummy mode', async () => {
    expect(await bodyOf(['seed', '--collections', JSON.stringify(seed), '--yes'])).toMatchObject({mode: 'dummy'})
  })

  it('seed refuses a JSON object and sends nothing', async () => {
    const {error} = await runCommand(['db', 'seed', '--collections', '{"collectionName":"orders"}', '--yes', ...globalArgs])
    expect(error?.message).toMatch(/must be a JSON array/)
    expect(calls).toHaveLength(0)
  })

  it('change-owner sends the new owner', async () => {
    expect(await bodyOf(['change-owner', COL, ID, '--user', USER])).toEqual({newResponsibleUserId: USER})
  })
})
