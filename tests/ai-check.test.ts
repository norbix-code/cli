import {mkdirSync, mkdtempSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {beforeEach, describe, expect, it} from 'vitest'

import {cli, makeHome, parseSingleJson} from './_cli.js'

const home = makeHome(1)
let project: string

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'norbix-ai-check-'))
})

const write = (file: string, text: string) => {
  mkdirSync(join(project, file, '..'), {recursive: true})
  writeFileSync(join(project, file), text)
}

interface Failure {
  error: {code: string; exit: number; context: {findings: Array<{rule: string; file: string; line?: number; match: string}>}}
}

describe('norbix ai check', () => {
  it('passes a project that builds on Norbix', async () => {
    write('package.json', JSON.stringify({dependencies: {'@norbix.ai/ts': '4.43.0'}, devDependencies: {stripe: '23.0.0'}}))
    const r = await cli(home, ['ai', 'check', '--dir', project, '--json'])
    expect(r.code).toBe(0)
    expect(parseSingleJson(r.stdout)).toEqual({ok: true, findings: [], allowed: []})
  })

  it('finds packages, a cloud scheduler, the CLI in app code and raw HTTP, and skips node_modules', async () => {
    write('backend/package.json', JSON.stringify({dependencies: {'@google-cloud/storage': '8.4.0', 'node-cron': '4.0.0'}}))
    write('backend/template.yaml', 'Tick:\n  Type: AWS::Scheduler::Schedule\n')
    write('backend/src/norbix.js', "const child = spawn('norbix', args)\n")
    write('app/src/api.ts', "await fetch('https://api.example.com/v3/membership/auth/1')\n")
    write('node_modules/x/package.json', JSON.stringify({dependencies: {stripe: '1.0.0'}}))

    const r = await cli(home, ['ai', 'check', '--dir', project, '--json'])
    expect(r.code).toBe(6)
    const {error} = parseSingleJson(r.stdout) as Failure
    expect(error.code).toBe('BUILT_BESIDE_NORBIX')
    expect(error.context.findings.map((f) => `${f.rule} ${f.file}${f.line ? `:${f.line}` : ''}`).sort()).toEqual([
      'files backend/package.json',
      'raw-http app/src/api.ts:1',
      'runtime-cli backend/src/norbix.js:1',
      'scheduler backend/package.json',
      'scheduler backend/template.yaml:2',
    ])
  })

  it('a rule allowed with a reason passes and stays in the report; an empty reason does not count', async () => {
    write('package.json', JSON.stringify({dependencies: {stripe: '23.0.0'}}))
    write('norbix.boundaries.json', JSON.stringify({allow: {payments: ''}}))
    expect((await cli(home, ['ai', 'check', '--dir', project, '--json'])).code).toBe(6)

    write('norbix.boundaries.json', JSON.stringify({allow: {payments: 'Stripe Tax is not in Norbix Payments'}}))
    const r = await cli(home, ['ai', 'check', '--dir', project, '--json'])
    expect(r.code).toBe(0)
    expect((parseSingleJson(r.stdout) as {allowed: Array<{match: string; reason: string}>}).allowed).toMatchObject([
      {match: 'stripe', reason: 'Stripe Tax is not in Norbix Payments'},
    ])
  })

  it('a broken allow file is a usage error', async () => {
    write('norbix.boundaries.json', '{nope')
    const r = await cli(home, ['ai', 'check', '--dir', project, '--json'])
    expect(r.code).toBe(2)
  })
})
