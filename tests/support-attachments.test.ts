import {runCommand} from '@oclif/test'
import {mkdtempSync, readFileSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {supportFileType} from '../src/lib/support-files.js'
import {envListAnswer} from './_env.js'

/**
 * `norbix support attach | attachments | download | detach` and
 * `norbix payments integrations test-payment`, run the way a user types them,
 * through oclif and the real `@norbix.ai/ts` transport with `fetch` replaced.
 * Nothing leaves the process.
 */

interface Call {
  method: string
  path: string
  body?: unknown
  contentType?: string | null
}

let calls: Call[]
let realFetch: typeof globalThis.fetch
let answer: unknown
let bytesAnswer: Uint8Array | undefined
let printed: string[]
const dir = mkdtempSync(join(tmpdir(), 'norbix-cli-support-'))

beforeEach(() => {
  printed = []
  vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => {
    printed.push(parts.join(' '))
  })
  calls = []
  answer = {ok: true}
  bytesAnswer = undefined
  realFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const envList = envListAnswer(input, init)
    if (envList) return envList
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    const raw = init?.body
    calls.push({
      method: init?.method ?? 'GET',
      path: url.pathname,
      body: typeof raw === 'string' ? JSON.parse(raw) : raw,
      contentType: new Headers(init?.headers).get('Content-Type'),
    })
    if (bytesAnswer && url.pathname.endsWith('/download')) {
      return new Response(bytesAnswer, {status: 200, headers: {'Content-Type': 'application/octet-stream'}})
    }

    return new Response(JSON.stringify(answer), {status: 200, headers: {'Content-Type': 'application/json'}})
  }) as typeof globalThis.fetch
})

afterEach(() => {
  vi.restoreAllMocks()
  globalThis.fetch = realFetch
})

const globalArgs = ['--project', 'test-project', '--api-key', 'test-api-key', '--region', 'nb-eu-germany']
const CASE = 'sup_1'
const A = `/v3/support/cases/${CASE}/attachments`

describe('norbix support attach', () => {
  it('sends each file as one multipart file part, in order', async () => {
    const log = join(dir, 'app.log')
    const png = join(dir, 'screen.png')
    writeFileSync(log, 'line one')
    writeFileSync(png, 'png-bytes')
    answer = {id: 'supf_1'}

    const {error} = await runCommand(['support', 'attach', CASE, log, png, ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([`POST ${A}`, `POST ${A}`])
    const first = calls[0]!.body as FormData
    expect(first).toBeInstanceOf(FormData)
    expect(calls[0]!.contentType).toBeNull()
    const part = first.get('file') as File
    expect(part.name).toBe('app.log')
    expect(part.type).toBe('text/plain')
    expect(await part.text()).toBe('line one')
    expect(((calls[1]!.body as FormData).get('file') as File).type).toBe('image/png')
    expect(printed.join('\n')).toContain('Added app.log (8 bytes) → supf_1')
  })

  it('refuses a file kind the gateway refuses before anything is sent', async () => {
    const ok = join(dir, 'ok.txt')
    const bad = join(dir, 'run.exe')
    writeFileSync(ok, 'x')
    writeFileSync(bad, 'MZ')

    const {error} = await runCommand(['support', 'attach', CASE, ok, bad, ...globalArgs])

    expect(error?.message).toContain('cannot be added to a support case')
    expect(calls).toHaveLength(0)
  })

  it('refuses a missing file and sends nothing', async () => {
    const {error} = await runCommand(['support', 'attach', CASE, join(dir, 'nope.txt'), ...globalArgs])

    expect(error?.message).toContain('is not a file')
    expect(calls).toHaveLength(0)
  })

  it('--dry-run names the files and sends nothing', async () => {
    const log = join(dir, 'dry.log')
    writeFileSync(log, 'abc')

    const {error} = await runCommand(['support', 'attach', CASE, log, '--dry-run', ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(0)
    expect(printed.join('\n')).toContain('"fileName": "dry.log"')
  })
})

describe('norbix support attachments | download | detach', () => {
  it('attachments → GET /support/cases/{id}/attachments', async () => {
    answer = {result: [{id: 'supf_1', fileName: 'app.log', sizeBytes: 8}]}
    const {error} = await runCommand(['support', 'attachments', CASE, ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([`GET ${A}`])
  })

  it('download --out writes the bytes', async () => {
    bytesAnswer = new Uint8Array([1, 2, 3])
    const out = join(dir, 'got.bin')
    const {error} = await runCommand(['support', 'download', CASE, 'supf_1', '--out', out, ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([`GET ${A}/supf_1/download`])
    expect([...readFileSync(out)]).toEqual([1, 2, 3])
  })

  it('download without --out takes the name from the list', async () => {
    bytesAnswer = new Uint8Array([9])
    answer = {result: [{id: 'supf_1', fileName: 'from-list.txt'}]}
    const cwd = process.cwd()
    process.chdir(dir)
    try {
      const {error} = await runCommand(['support', 'download', CASE, 'supf_1', ...globalArgs])
      expect(error).toBeUndefined()
    } finally {
      process.chdir(cwd)
    }

    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([`GET ${A}`, `GET ${A}/supf_1/download`])
    expect([...readFileSync(join(dir, 'from-list.txt'))]).toEqual([9])
  })

  it('detach --yes → DELETE /support/cases/{id}/attachments/{fileId}', async () => {
    answer = {id: 'supf_1'}
    const {error} = await runCommand(['support', 'detach', CASE, 'supf_1', '--yes', ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([`DELETE ${A}/supf_1`])
  })

  it('detach without --yes in a script asks first and sends nothing', async () => {
    const {error} = await runCommand(['support', 'detach', CASE, 'supf_1', ...globalArgs])

    expect(error?.message).toContain('Confirmation required')
    expect(calls).toHaveLength(0)
  })
})

describe('norbix payments integrations test-payment', () => {
  it('→ POST /payments/integrations/test-payment with the integration and return URL, prints the link', async () => {
    answer = {payUrl: 'https://pay.example.test/1', reference: 'ref-1', amountMinor: 1, currency: 'EUR'}
    const {error} = await runCommand([
      'payments', 'integrations', 'test-payment', 'int_neopay', '--return-url', 'https://shop.example.test/paid', ...globalArgs,
    ])

    expect(error).toBeUndefined()
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(['POST /v3/payments/integrations/test-payment'])
    expect(calls[0]!.body).toMatchObject({integrationId: 'int_neopay', returnUrl: 'https://shop.example.test/paid'})
    expect(printed.join('\n')).toContain('Pay 0.01 EUR here: https://pay.example.test/1')
  })
})

describe('support file kinds', () => {
  it('match the gateway list', () => {
    expect(supportFileType('A.PDF')).toBe('application/pdf')
    expect(supportFileType('notes.yml')).toBe('application/yaml')
    expect(supportFileType('x.sh')).toBeUndefined()
  })
})
