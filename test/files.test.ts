import {runCommand} from '@oclif/test'
import {mkdtempSync, readFileSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'

/**
 * The six `norbix files` commands.
 *
 * Each test runs the real command through oclif and replaces `fetch`, so the
 * request the command would send is captured instead of leaving the machine.
 * What is checked: the command reaches the right endpoint, the arguments the
 * user typed end up in the request, and the multi-step flows (upload, download)
 * do every step in the right order.
 *
 * Each test sets up everything it needs — its own fake responses and, where a
 * file is involved, its own temporary file — so the order the tests run in does
 * not matter.
 */

const PROJECT = 'test-project'
const API_KEY = 'test-api-key'
const INTEGRATION = '55555555-5555-5555-5555-555555555555'

/** One request the command tried to make. */
interface Call {
  method: string
  url: string
  body?: unknown
}

let calls: Call[]
let realFetch: typeof globalThis.fetch

/**
 * Replace fetch. `responses` maps a piece of the URL to the JSON (or bytes) to
 * answer with; anything unmatched answers with an empty object.
 */
function fakeFetch(responses: Array<[string, unknown]> = []): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = init?.method ?? 'GET'
    let body: unknown
    if (init?.body && typeof init.body === 'string') {
      try {
        body = JSON.parse(init.body)
      } catch {
        body = init.body
      }
    }
    calls.push({method, url, body})

    const match = responses.find(([fragment]) => url.includes(fragment))
    const payload = match ? match[1] : {}
    if (payload instanceof Uint8Array) {
      return new Response(payload, {status: 200})
    }
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {'Content-Type': 'application/json'},
    })
  }) as typeof globalThis.fetch
}

// A region is required whenever the default norbix.ai addresses are used, so
// every test passes one. The assertions look at the path, not the host, so the
// region does not matter to them.
const REGION = 'nb-eu-germany'
const globalArgs = [
  '--project',
  PROJECT,
  '--api-key',
  API_KEY,
  '--region',
  REGION,
  '--integration',
  INTEGRATION,
]

beforeEach(() => {
  calls = []
  realFetch = globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
})

describe('norbix files list', () => {
  it('calls the list endpoint for the integration', async () => {
    fakeFetch([[`/files/${INTEGRATION}`, {list: {items: []}, folders: ['invoices/']}]])

    const {error} = await runCommand(['files', 'list', 'invoices/', ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(new URL(calls[0].url).pathname).toBe(`/v2/files/${INTEGRATION}`)
    expect(calls[0].url).toContain('path=invoices')
  })

  it('fails with a clear message when no integration is given', async () => {
    fakeFetch()

    const {error} = await runCommand([
      'files',
      'list',
      '--project',
      PROJECT,
      '--api-key',
      API_KEY,
      '--region',
      REGION,
    ])

    expect(error?.message).toContain('No files integration ID')
    expect(calls).toHaveLength(0)
  })
})

describe('norbix files info', () => {
  it('calls the info endpoint with the file path', async () => {
    fakeFetch([['/info', {file: {path: 'invoices/invoice.pdf'}}]])

    const {error} = await runCommand(['files', 'info', 'invoices/invoice.pdf', ...globalArgs])

    expect(error).toBeUndefined()
    expect(new URL(calls[0].url).pathname).toBe(`/v2/files/${INTEGRATION}/info`)
    expect(calls[0].url).toContain('invoice.pdf')
  })
})

describe('norbix files sign', () => {
  it('asks for a signed URL and passes the lifetime through', async () => {
    fakeFetch([['/sign', {url: 'https://storage.example/signed'}]])

    const {error} = await runCommand([
      'files',
      'sign',
      'invoices/invoice.pdf',
      '--expires',
      '3600',
      ...globalArgs,
    ])

    expect(error).toBeUndefined()
    expect(new URL(calls[0].url).pathname).toBe(`/v2/files/${INTEGRATION}/sign`)
    expect(calls[0].url).toContain('expirationSeconds=3600')
  })
})

describe('norbix files upload', () => {
  it('gets an upload URL, sends the bytes, then commits', async () => {
    const local = join(mkdtempSync(join(tmpdir(), 'norbix-upload-')), 'invoice.pdf')
    writeFileSync(local, '%PDF-fake')
    fakeFetch([['/upload-url', {url: 'https://storage.example/put'}]])

    const {error} = await runCommand(['files', 'upload', local, 'invoices/invoice.pdf', ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(3)

    // 1. ask for the upload address
    expect(calls[0].method).toBe('POST')
    expect(new URL(calls[0].url).pathname).toBe(`/v2/files/${INTEGRATION}/upload-url`)
    expect(calls[0].body).toMatchObject({
      path: 'invoices/invoice.pdf',
      contentType: 'application/pdf',
    })

    // 2. send the bytes straight to storage
    expect(calls[1].method).toBe('PUT')
    expect(calls[1].url).toBe('https://storage.example/put')

    // 3. tell Norbix the upload finished
    expect(calls[2].method).toBe('POST')
    expect(new URL(calls[2].url).pathname).toBe(`/v2/files/${INTEGRATION}/commit`)
    expect(calls[2].body).toMatchObject({
      path: 'invoices/invoice.pdf',
      sizeBytes: 9,
      fileName: 'invoice.pdf',
    })
  })

  it('guesses the content type from the file name', async () => {
    const local = join(mkdtempSync(join(tmpdir(), 'norbix-upload-')), 'notes.txt')
    writeFileSync(local, 'hello')
    fakeFetch([['/upload-url', {url: 'https://storage.example/put'}]])

    await runCommand(['files', 'upload', local, ...globalArgs])

    expect(calls[0].body).toMatchObject({path: 'notes.txt', contentType: 'text/plain'})
  })
})

describe('norbix files download', () => {
  it('signs the file, fetches it, and writes it to disk', async () => {
    const target = join(mkdtempSync(join(tmpdir(), 'norbix-download-')), 'copy.pdf')
    // The storage address ends in "/signed", so match it before the gateway's
    // own "/sign" endpoint — first match wins.
    fakeFetch([
      ['storage.example/signed', new TextEncoder().encode('%PDF-fake')],
      ['/sign', {url: 'https://storage.example/signed'}],
    ])

    const {error} = await runCommand([
      'files',
      'download',
      'invoices/invoice.pdf',
      target,
      ...globalArgs,
    ])

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(2)
    expect(new URL(calls[0].url).pathname).toBe(`/v2/files/${INTEGRATION}/sign`)
    expect(calls[1].url).toBe('https://storage.example/signed')
    expect(readFileSync(target, 'utf8')).toBe('%PDF-fake')
  })
})

describe('norbix files delete', () => {
  it('deletes the file when --yes is given', async () => {
    fakeFetch()

    const {error} = await runCommand([
      'files',
      'delete',
      'invoices/invoice.pdf',
      '--yes',
      ...globalArgs,
    ])

    expect(error).toBeUndefined()
    expect(calls[0].method).toBe('DELETE')
    expect(new URL(calls[0].url).pathname).toBe(`/v2/files/${INTEGRATION}`)
    expect(calls[0].url).toContain('invoice.pdf')
  })
})
