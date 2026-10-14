import {mkdtempSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {afterAll, beforeAll, describe, expect, it} from 'vitest'

import {SCHEMA_RULES_POINTER, schemaWarnings} from '../src/lib/schema-rules.js'
import {cli, makeHome, parseSingleJson, startFakeGateway, type FakeGateway} from './_cli.js'

/**
 * ux-fixes item 13: a coding agent built a schema through the CLI with an app
 * link, an email, language and currency as bare text and created_by_user_id
 * as text. The CLI now (1) prints the design rules (`db schema rules`) and
 * (2) shows the Hub's design `warnings` after a schema save — on stderr, so
 * with --json stdout stays one JSON document.
 *
 * The built CLI runs as a child process against a fake gateway on 127.0.0.1.
 */

const WARNINGS = [
  `app_link: 'app_link' looks like a link: use a string with "format": "uri" (UI widget website), not bare text.`,
  `language: 'language' looks like a language: use a taxonomy-selection field (a language taxonomy, one term per language) so values are validated and translatable. Free text only when the value is deliberately not tied to any list.`,
]

const dir = mkdtempSync(join(tmpdir(), 'norbix-schema-rules-'))
const SCHEMA_FILE = join(dir, 'apps.schema.json')
writeFileSync(SCHEMA_FILE, JSON.stringify({type: 'object', properties: {app_link: {type: 'string'}, language: {type: 'string'}}}))

let warned: FakeGateway
let clean: FakeGateway
let warnedHome: string
let cleanHome: string

beforeAll(async () => {
  warned = await startFakeGateway({'/v3/database/schemas': {id: 'sch_1', warnings: WARNINGS}})
  clean = await startFakeGateway({'/v3/database/schemas': {id: 'sch_2'}})
  warnedHome = makeHome(warned.port)
  cleanHome = makeHome(clean.port)
})

afterAll(async () => {
  await warned.close()
  await clean.close()
})

describe('db schema rules', () => {
  it('prints the rules with the exact shapes for email, link, taxonomy and user fields', async () => {
    const r = await cli(cleanHome, ['db', 'schema', 'rules'])
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('{"type":"string","format":"email"}')
    expect(r.stdout).toContain('{"type":"string","format":"uri"}')
    expect(r.stdout).toContain('language / locale, currency code, country')
    expect(r.stdout).toContain('{"source":"taxonomy","taxonomyId":"<taxonomy id>","multiple":false}')
    expect(r.stdout).toContain('{"source":"user","displayField":"displayName","multiple":false}')
    expect(r.stdout).toContain('developer-facing flag')
  })

  it('--json returns the rules as data and sends nothing', async () => {
    const before = clean.hits.length
    const r = await cli(cleanHome, ['db', 'schema', 'rules', '--json'])
    expect(r.code).toBe(0)
    const doc = parseSingleJson(r.stdout) as {rules: Array<{when: string; shape: string}>; never: string[]}
    expect(doc.rules.find((x) => x.when.startsWith('email'))?.shape).toBe('{"type":"string","format":"email"}')
    expect(doc.never.some((n) => n.includes('createdBy'))).toBe(true)
    expect(clean.hits.length).toBe(before)
  })
})

describe('db schema create — design warnings', () => {
  it('prints the Hub warnings on stderr after a save', async () => {
    const r = await cli(warnedHome, ['db', 'schema', 'create', '--name', 'apps', '--file', SCHEMA_FILE, '--profile', 'x'])
    expect(r.code).toBe(0)
    expect(r.stderr).toContain('the schema was saved, but 2 fields break a design rule')
    expect(r.stderr).toContain(WARNINGS[0])
    expect(r.stderr).toContain('Rules: norbix db schema rules')
  })

  it('with --json, stdout is one JSON document that carries the warnings; the text goes to stderr', async () => {
    const r = await cli(warnedHome, ['db', 'schema', 'create', '--name', 'apps', '--file', SCHEMA_FILE, '--json', '--profile', 'x'])
    expect(r.code).toBe(0)
    expect((parseSingleJson(r.stdout) as {warnings: string[]}).warnings).toEqual(WARNINGS)
    expect(r.stderr).toContain(WARNINGS[1])
  })

  it('prints nothing extra when the schema follows the rules', async () => {
    const r = await cli(cleanHome, ['db', 'schema', 'create', '--name', 'apps', '--file', SCHEMA_FILE, '--profile', 'x'])
    expect(r.code).toBe(0)
    expect(r.stderr).not.toContain('design rule')
  })

  it('the create help points at db schema rules', async () => {
    const r = await cli(cleanHome, ['db', 'schema', 'create', '--help'])
    expect(r.stdout).toContain('db schema rules')
  })
})

describe('hub database — design warnings and the rules pointer', () => {
  it('hub database schema save prints the warnings too', async () => {
    const r = await cli(warnedHome, [
      'hub', 'database', 'schema', 'save', '--schemaName', 'apps', '--dataSchema', '{"type":"object","properties":{"app_link":{"type":"string"}}}', '--profile', 'x',
    ])
    expect(r.code).toBe(0)
    expect(r.stderr).toContain(WARNINGS[0])
  })

  it('hub account schema validate prints them as a check, not as a save', async () => {
    const gateway = await startFakeGateway({
      '/v3/account/ai/schemas/validate': {valid: true, issues: [], collections: ['apps'], warnings: [{where: 'apps.email', code: 'SchemaDesignEmailFormat', message: 'bare email'}]},
    })
    try {
      const r = await cli(makeHome(gateway.port), ['hub', 'account', 'schema', 'validate', '--schemaJson', '{"name":"apps","fields":[{"name":"email","type":"string"}]}', '--profile', 'x'])
      expect(r.code).toBe(0)
      expect(r.stderr).toContain('the schema check says 1 field breaks a design rule')
      expect(r.stderr).toContain('apps.email: bare email')
      expect(r.stderr).not.toContain('saved')
    } finally {
      await gateway.close()
    }
  })

  it('another id-returning hub method with warnings stays silent (only schema save / validate print them)', async () => {
    const gateway = await startFakeGateway({'/v3/database/taxonomies': {id: 'tax_1', warnings: ['not a schema warning']}})
    try {
      const r = await cli(makeHome(gateway.port), ['hub', 'database', 'taxonomy', 'save', '--name', 'Languages', '--profile', 'x'])
      expect(r.code).toBe(0)
      expect(r.stderr).not.toContain('design rule')
    } finally {
      await gateway.close()
    }
  })

  it('the database scope help points at db schema rules', async () => {
    const r = await cli(cleanHome, ['hub', 'database', 'schema', '--help'])
    expect(r.stdout).toContain(SCHEMA_RULES_POINTER)
  })
})

describe('schema bundle apply --dry-run — design warnings from the Hub check', () => {
  it('the dry-run report carries the validate_schema warnings next to valid / issues', async () => {
    const gateway = await startFakeGateway({
      '/v3/account/ai/schemas/validate': {
        valid: true,
        issues: [],
        collections: ['apps'],
        warnings: [{where: 'apps.app_link', code: 'SchemaDesignUriFormat', message: WARNINGS[0].slice('app_link: '.length)}],
      },
    })
    try {
      const home = makeHome(gateway.port)
      const bundle = '[{"entity":"apps","fields":[{"name":"app_link","kind":"string"}]}]'
      const r = await cli(home, ['hub', 'database', 'schema', 'bundle', 'apply', '--bundleJson', bundle, '--profile', 'x', '--dry-run', '--json'])
      expect(r.code).toBe(0)
      const doc = parseSingleJson(r.stdout) as {validation: {valid: boolean; warnings: string[]}}
      expect(doc.validation.valid).toBe(true)
      expect(doc.validation.warnings).toEqual([`apps.app_link: ${WARNINGS[0].slice('app_link: '.length)}`])
    } finally {
      await gateway.close()
    }
  })
})

describe('schemaWarnings', () => {
  it('reads the save answer (strings) and the validate answer ({where, code, message})', () => {
    expect(schemaWarnings({warnings: ['a: b']})).toEqual(['a: b'])
    expect(
      schemaWarnings({warnings: [{where: 'apps.email', code: 'SchemaDesignEmailFormat', message: "'email' looks like an email address"}]}),
    ).toEqual(["apps.email: 'email' looks like an email address"])
    expect(schemaWarnings({id: 'sch_1'})).toEqual([])
    expect(schemaWarnings(null)).toEqual([])
  })
})
