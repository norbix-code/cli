import {readdirSync, statSync} from 'node:fs'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'

import {afterAll, beforeAll, describe, expect, it} from 'vitest'

import {cli, makeHome, parseSingleJson, startFakeGateway, type FakeGateway} from './_cli.js'

/** Every command file under dist/commands, as the id a user types. */
function commandIdsOnDisk(): string[] {
  const root = fileURLToPath(new URL('../dist/commands', import.meta.url))
  const walk = (dir: string, prefix: string[]): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) return walk(full, [...prefix, name])
      return name.endsWith('.js') ? [[...prefix, name.slice(0, -3)].join(' ')] : []
    })
  return walk(root, []).sort()
}

interface SchemaDoc {
  cli: string
  version: string
  contract: string
  exitCodes: Record<string, {name: string}>
  commands: Array<{
    id: string
    description: string
    destructive: boolean
    supportsDryRun: boolean
    args: Array<{name: string; required: boolean}>
    flags: Array<{name: string; type: string; global?: boolean; env?: string}>
    examples: string[]
  }>
  dynamic: {hub: string; api: string; valueRules: string}
}

let gateway: FakeGateway
let home: string

beforeAll(async () => {
  gateway = await startFakeGateway()
  home = makeHome(gateway.port)
})

afterAll(async () => {
  await gateway.close()
})

describe('norbix schema', () => {
  let schema: SchemaDoc

  beforeAll(async () => {
    const r = await cli(home, ['schema', '--json'])
    expect(r.code).toBe(0)
    expect(r.stderr).toBe('')
    schema = parseSingleJson(r.stdout) as SchemaDoc
  })

  it('lists every command in dist/commands', () => {
    expect(schema.commands.map((c) => c.id)).toEqual(commandIdsOnDisk())
  })

  it('marks every command with destructive and supportsDryRun booleans', () => {
    for (const c of schema.commands) {
      expect(typeof c.destructive, c.id).toBe('boolean')
      expect(typeof c.supportsDryRun, c.id).toBe('boolean')
      if (c.destructive) expect(c.supportsDryRun, `${c.id} is destructive so it must support --dry-run`).toBe(true)
    }
  })

  it('names the contract and the exit codes', () => {
    expect(schema.cli).toBe('norbix')
    expect(schema.contract).toContain('docs/agent-contract.md')
    expect(Object.keys(schema.exitCodes)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])
    expect(schema.dynamic.hub).toContain('norbix hub <module> --help')
  })

  it('every mutating command has a --dry-run example, every destructive one a --yes example', () => {
    const missing: string[] = []
    for (const c of schema.commands) {
      if (c.supportsDryRun && !c.examples.some((e) => e.includes('--dry-run'))) missing.push(`${c.id}: --dry-run`)
      if (c.destructive && !c.examples.some((e) => e.includes('--yes'))) missing.push(`${c.id}: --yes`)
      if (c.examples.length === 0) missing.push(`${c.id}: no example`)
      if (c.examples.some((e) => e.includes('...'))) missing.push(`${c.id}: placeholder value`)
    }

    expect(missing).toEqual([])
  })

  it('carries the global flags with their env vars', () => {
    const users = schema.commands.find((c) => c.id === 'users delete')!
    const project = users.flags.find((f) => f.name === 'project')!
    expect(project).toMatchObject({type: 'string', env: 'NORBIX_PROJECT_ID', global: true})
    expect(users.flags.find((f) => f.name === 'yes')).toMatchObject({type: 'boolean'})
    expect(users.args).toEqual([{name: 'id', required: true, description: 'User ID'}])
  })

  it('describes one command or one topic on request', async () => {
    const one = parseSingleJson((await cli(home, ['schema', 'users', 'delete', '--json'])).stdout) as SchemaDoc
    expect(one.commands.map((c) => c.id)).toEqual(['users delete'])

    const topic = parseSingleJson((await cli(home, ['schema', 'db', '--json'])).stdout) as SchemaDoc
    expect(topic.commands.length).toBeGreaterThan(5)
    expect(topic.commands.every((c) => c.id.startsWith('db '))).toBe(true)

    const r = await cli(home, ['schema', 'nothing', '--json'])
    expect(r.code).toBe(2)
  })

  it('prints a table without --json', async () => {
    const r = await cli(home, ['schema'])
    expect(r.code).toBe(0)
    expect(r.stdout).toMatch(/users delete\s+Delete a user\s+\[destructive, dry-run\]/)
  })

  it('is stable (snapshot of ids, flags and markers)', () => {
    const compact = schema.commands.map((c) => ({
      id: c.id,
      destructive: c.destructive,
      supportsDryRun: c.supportsDryRun,
      args: c.args.map((a) => (a.required ? a.name : `[${a.name}]`)),
      flags: c.flags.filter((f) => !f.global).map((f) => `${f.name}:${f.type}`),
    }))
    expect(compact).toMatchSnapshot()
  })
})

describe('norbix hub <module> --json', () => {
  it('lists every method with its route and request fields', async () => {
    const r = await cli(home, ['hub', 'scheduler', '--json'])
    expect(r.code).toBe(0)
    const doc = parseSingleJson(r.stdout) as {module: string; methods: Array<{method: string; words: string; destructive: boolean; http: string; path: string; fields: Array<{name: string; kind: string; required: boolean}>}>}
    expect(doc.module).toBe('scheduler')
    const del = doc.methods.find((m) => m.method === 'deleteSchedulerTask')!
    expect(del).toMatchObject({words: 'task delete', destructive: true, http: 'DELETE', path: '/{version}/scheduler/tasks/{Id}'})
    expect(del.fields).toEqual([{name: 'id', type: 'string', kind: 'string', required: true}])
  })

  it('shows the fields in scope help', async () => {
    const r = await cli(home, ['hub', 'scheduler', 'task', 'delete', '--help'])
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('fields: id (string, required)')
    expect(r.stdout).toContain('--field:str')
  })
})
