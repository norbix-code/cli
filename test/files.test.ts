import {runCommand} from '@oclif/test'
import {mkdtempSync, readFileSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

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

describe('norbix files publish / unpublish', () => {
  it('publishes one file and prints the link anyone can open', async () => {
    fakeFetch([['/files/item/public', {id: 'nbpf_7hK2abc', status: 'Success'}]])

    const {error, result} = await runCommand([
      'files',
      'publish',
      'invoices/2026/invoice.pdf',
      ...globalArgs,
    ])

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('POST')
    expect(new URL(calls[0].url).pathname).toBe('/v2/files/item/public')
    expect(calls[0].body).toEqual({
      filesIntegrationId: INTEGRATION,
      path: 'invoices/2026/invoice.pdf',
    })
    expect(result).toMatchObject({publicId: 'nbpf_7hK2abc'})
    // The link ends with the file's own name, not the whole path.
    expect((result as {publicUrl: string}).publicUrl).toContain(
      '/v3/files/public/nbpf_7hK2abc/invoice.pdf',
    )
  })

  it('publishes a whole folder with --folder and gives a link to put a path after', async () => {
    fakeFetch([['/files/folder/public', {id: 'nbpf_folder1', status: 'Success'}]])

    const {error, result} = await runCommand(['files', 'publish', 'invoices', '--folder', ...globalArgs])

    expect(error).toBeUndefined()
    expect(new URL(calls[0].url).pathname).toBe('/v2/files/folder/public')
    expect(calls[0].body).toEqual({filesIntegrationId: INTEGRATION, path: 'invoices'})
    expect((result as {publicUrl: string}).publicUrl).toMatch(
      /\/v3\/files\/public\/nbpf_folder1\/$/,
    )
  })

  it('unpublishes one file', async () => {
    fakeFetch()

    const {error} = await runCommand([
      'files',
      'unpublish',
      'invoices/2026/invoice.pdf',
      ...globalArgs,
    ])

    expect(error).toBeUndefined()
    expect(calls[0].method).toBe('POST')
    expect(new URL(calls[0].url).pathname).toBe('/v2/files/item/private')
    expect(calls[0].body).toEqual({
      filesIntegrationId: INTEGRATION,
      path: 'invoices/2026/invoice.pdf',
    })
  })

  it('unpublishes a whole folder with --folder', async () => {
    fakeFetch()

    const {error} = await runCommand(['files', 'unpublish', 'invoices', '--folder', ...globalArgs])

    expect(error).toBeUndefined()
    expect(new URL(calls[0].url).pathname).toBe('/v2/files/folder/private')
  })

  it('sends the session as a bearer token, as every other command does', async () => {
    const seen: Array<Record<string, string>> = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      calls.push({method: init?.method ?? 'GET', url})
      const headers = new Headers(init?.headers ?? {})
      seen.push(Object.fromEntries(headers.entries()))
      return new Response(JSON.stringify({id: 'nbpf_7hK2abc'}), {
        status: 200,
        headers: {'Content-Type': 'application/json'},
      })
    }) as typeof globalThis.fetch

    await runCommand(['files', 'publish', 'invoices/invoice.pdf', ...globalArgs])

    expect(seen[0].authorization).toBe(`Bearer ${API_KEY}`)
    expect(seen[0]['x-cm-projectid']).toBe(PROJECT)
    expect(seen[0]['nb-region']).toBe(REGION)
  })

  it('fails with a clear message when no integration is given', async () => {
    fakeFetch()

    const {error} = await runCommand([
      'files',
      'publish',
      'invoices/invoice.pdf',
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

  it('reports what the gateway refused, instead of a blank success', async () => {
    // The real case: a file cannot be made private on its own while a folder
    // above it is public (CM-ERRORS-FILES-021).
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      calls.push({method: init?.method ?? 'GET', url})
      return new Response(
        JSON.stringify({message: 'This file is public through the folder "invoices".'}),
        {status: 400, headers: {'Content-Type': 'application/json'}},
      )
    }) as typeof globalThis.fetch

    const {error} = await runCommand([
      'files',
      'unpublish',
      'invoices/invoice.pdf',
      ...globalArgs,
    ])

    expect(error?.message).toContain('public through the folder')
  })
})

describe('norbix files integrations test', () => {
  /** Answer every request with `payload` and the given status; record what was sent. */
  function answer(payload: unknown, status = 200): Array<Record<string, string>> {
    const seen: Array<Record<string, string>> = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      calls.push({method: init?.method ?? 'GET', url, body: init?.body})
      seen.push(Object.fromEntries(new Headers(init?.headers ?? {}).entries()))
      return new Response(JSON.stringify(payload), {
        status,
        headers: {'Content-Type': 'application/json'},
      })
    }) as typeof globalThis.fetch
    return seen
  }

  const auth = ['--project', PROJECT, '--api-key', API_KEY, '--region', REGION]

  /**
   * What the command printed. oclif writes through `console.log`, which vitest
   * takes over, so `runCommand`'s own `stdout` stays empty — read it here.
   */
  let printed: string[]
  beforeEach(() => {
    printed = []
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      printed.push(args.map(String).join(' '))
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })
  const stdoutOf = () => printed.join('\n')

  const allOk = {
    items: [
      {operation: 'UploadFile', result: 'OK'},
      {operation: 'GetFile', result: 'OK'},
      {operation: 'GetAllFiles', result: 'OK'},
      {operation: 'DeleteFile', result: 'OK'},
    ],
    responseStatus: {isSuccess: true, errors: []},
  }

  it('sends POST /v2/files/<id>/test on the API host, with the id in the path and the usual headers', async () => {
    const seen = answer(allOk)

    const {error} = await runCommand(['files', 'integrations', 'test', INTEGRATION, ...auth])

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('POST')
    const url = new URL(calls[0].url)
    expect(url.host).toBe(`${REGION}.api.norbix.ai`)
    expect(url.pathname).toBe(`/v2/files/${INTEGRATION}/test`)
    // The only field is the path token, so — like the SDK — no body is sent.
    expect(calls[0].body).toBeUndefined()
    expect(seen[0].authorization).toBe(`Bearer ${API_KEY}`)
    expect(seen[0]['x-cm-projectid']).toBe(PROJECT)
    expect(seen[0]['norbix-project-id']).toBe(PROJECT)
    expect(seen[0]['nb-region']).toBe(REGION)
  })

  it('escapes the id like every other path token', async () => {
    answer(allOk)

    await runCommand(['files', 'integrations', 'test', 'a/b?c', ...auth])

    expect(calls[0].url).toContain('/v2/files/a%2Fb%3Fc/test')
  })

  it('prints one line per step and succeeds when every step is OK', async () => {
    answer(allOk)

    const {error, result} = await runCommand(['files', 'integrations', 'test', INTEGRATION, ...auth])

    expect(error).toBeUndefined()
    const stdout = stdoutOf()
    expect(stdout).toMatch(/UploadFile\s+OK/)
    expect(stdout).toMatch(/GetFile\s+OK/)
    expect(stdout).toMatch(/GetAllFiles\s+OK/)
    expect(stdout).toMatch(/DeleteFile\s+OK/)
    expect(stdout).toContain('All 4 steps passed.')
    expect(result).toMatchObject({filesIntegrationId: INTEGRATION, ok: true})
  })

  it('fails with a non-zero exit and shows the error of the failed step', async () => {
    answer({
      items: [
        {operation: 'UploadFile', result: 'OK'},
        {operation: 'GetFile', result: 'FAILED', errors: ['The bucket answered 403 AccessDenied']},
        {operation: 'GetAllFiles', result: 'NOT_TESTED'},
        {operation: 'DeleteFile', result: 'NOT_TESTED'},
      ],
      responseStatus: {isSuccess: true, errors: []},
    })

    const {error} = await runCommand(['files', 'integrations', 'test', INTEGRATION, ...auth])

    expect(error?.message).toBe('The files integration test failed: GetFile FAILED (2 later steps not tested).')
    expect(error?.oclif?.exit).toBe(2)
    const stdout = stdoutOf()
    expect(stdout).toMatch(/GetFile\s+FAILED/)
    expect(stdout).toContain('- The bucket answered 403 AccessDenied')
    expect(stdout).toMatch(/GetAllFiles\s+NOT_TESTED/)
    expect(stdout).not.toContain('steps passed')
  })

  it('fails when the gateway answers 200 with isSuccess: false, and shows its errors', async () => {
    answer({responseStatus: {isSuccess: false, errors: [{message: 'Files integration was not found.', errorCode: 'CM-ERRORS-FILES-004'}]}})

    const {error} = await runCommand(['files', 'integrations', 'test', INTEGRATION, ...auth])

    expect(error?.message).toContain('Files integration was not found.')
    expect(error?.oclif?.exit).toBe(2)
  })

  it('turns a 403 into the usual error line: code, message, HTTP status', async () => {
    answer({responseStatus: {errorCode: 'Forbidden', message: 'Missing permission files:create'}}, 403)

    const {error} = await runCommand(['files', 'integrations', 'test', INTEGRATION, ...auth])

    expect(error?.message).toBe('Forbidden: Missing permission files:create (HTTP 403)')
  })

  /**
   * The gateway's real message and code live inside `responseStatus.errors[]`.
   * Reading the top of the block printed "Request failed with status 404" and
   * no code (10b-files slice ERRORS, issue #66).
   */
  it('takes the message and the code of a 404 from responseStatus.errors', async () => {
    answer(
      {
        responseStatus: {
          isSuccess: false,
          errors: [
            {message: 'Files integration was not found.', errorCode: 'CM-ERRORS-FILES-004'},
            {message: 'and a second one', errorCode: 'CM-ERRORS-FILES-016'},
          ],
        },
      },
      404,
    )

    const {error} = await runCommand(['files', 'integrations', 'test', INTEGRATION, ...auth])

    expect(error?.message).toBe('CM-ERRORS-FILES-004: Files integration was not found. (HTTP 404)')
  })

  it('falls back to a plain line when a 500 body is not JSON', async () => {
    globalThis.fetch = (async () =>
      new Response('<html>Bad Gateway</html>', {
        status: 500,
        headers: {'Content-Type': 'text/html'},
      })) as typeof globalThis.fetch

    const {error} = await runCommand(['files', 'integrations', 'test', INTEGRATION, ...auth])

    expect(error?.message).toBe('Request failed (HTTP 500)')
  })

  it('--json returns every step and still exits non-zero when a step failed', async () => {
    answer({
      items: [
        {operation: 'UploadFile', result: 'FAILED', errors: ['timeout']},
        {operation: 'GetFile', result: 'NOT_TESTED'},
      ],
      responseStatus: {isSuccess: true},
    })
    const before = process.exitCode

    try {
      const {error} = await runCommand(['files', 'integrations', 'test', INTEGRATION, '--json', ...auth])

      expect(error).toBeUndefined()
      expect(JSON.parse(stdoutOf())).toEqual({
        filesIntegrationId: INTEGRATION,
        ok: false,
        steps: [
          {operation: 'UploadFile', result: 'FAILED', errors: ['timeout']},
          {operation: 'GetFile', result: 'NOT_TESTED', errors: []},
        ],
        errors: [],
      })
      expect(process.exitCode).toBe(2)
    } finally {
      process.exitCode = before
    }
  })
})
