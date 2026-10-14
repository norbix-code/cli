import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import {envListAnswer} from './_env.js'

/**
 * `--language` / NORBIX_LANGUAGE: the gateway's only language input is the
 * standard Accept-Language header (the cultureCode field and the
 * CultureCode / norbix-language headers are gone). The request goes all the
 * way to a replaced `fetch`, so nothing leaves the process.
 */

let headers: Headers[]
let realFetch: typeof globalThis.fetch

beforeEach(() => {
  headers = []
  realFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const envList = envListAnswer(input, init)
    if (envList) return envList
    headers.push(new Headers(init?.headers ?? {}))
    return new Response('{}', {status: 200, headers: {'Content-Type': 'application/json'}})
  }) as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
  delete process.env.NORBIX_LANGUAGE
})

const globalArgs = ['--project', 'test-project', '--api-key', 'test-api-key', '--region', 'nb-eu-germany']

describe('--language sends Accept-Language', () => {
  it('sends the flag value on SDK calls', async () => {
    const {error} = await runCommand(['push', 'templates', ...globalArgs, '--language', 'lt'])
    expect(error).toBeUndefined()
    expect(headers).toHaveLength(1)
    expect(headers[0]?.get('Accept-Language')).toBe('lt')
    expect(headers[0]?.get('norbix-language')).toBeNull()
    expect(headers[0]?.get('CultureCode')).toBeNull()
  })

  it('reads NORBIX_LANGUAGE', async () => {
    process.env.NORBIX_LANGUAGE = 'de'
    const {error} = await runCommand(['push', 'templates', ...globalArgs])
    expect(error).toBeUndefined()
    expect(headers[0]?.get('Accept-Language')).toBe('de')
  })

  it('sends nothing when no language is given', async () => {
    const {error} = await runCommand(['push', 'templates', ...globalArgs])
    expect(error).toBeUndefined()
    expect(headers[0]?.get('Accept-Language')).toBeNull()
  })

  it('raw sends it too', async () => {
    const {error} = await runCommand(['raw', '/v3/logs', ...globalArgs, '--language', 'lt'])
    expect(error).toBeUndefined()
    expect(headers[0]?.get('Accept-Language')).toBe('lt')
  })
})

describe('a command with its own --language keeps that meaning', () => {
  it('push campaign create --language does not become Accept-Language', async () => {
    const {error} = await runCommand([
      'push', 'campaign', 'create', '--template', 't1', '--integration', 'int_1', '--audience', 'all-users',
      '--language', 'lt', ...globalArgs,
    ])
    expect(error).toBeUndefined()
    expect(headers[0]?.get('Accept-Language')).toBeNull()
  })
})
