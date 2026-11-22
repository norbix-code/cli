import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import {envListAnswer} from '../tests/_env.js'
import {verificationSaves} from '../src/commands/membership/settings/email-verification/set.js'

/**
 * E-mail verification of e-mail + password sign-ups (gateway
 * docs/tasks/password-email-verification.md): confirm and resend call the
 * public Api routes; the settings command sends the single-setting saves in
 * the order the gateway needs (callback before the sign-in block).
 */

const PROJECT = 'test-project'
const API_KEY = 'test-api-key'
const REGION = 'nb-eu-germany'
const globalArgs = ['--project', PROJECT, '--api-key', API_KEY, '--region', REGION]

interface Call {
  method: string
  url: string
  headers: Record<string, string>
  body?: unknown
}

let calls: Call[]
let realFetch: typeof globalThis.fetch

function fakeFetch(responses: Array<[string, unknown]>): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const envList = envListAnswer(input, init, ['PROD', 'TEST'])
    if (envList) return envList
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const headers: Record<string, string> = {}
    new Headers(init?.headers).forEach((v, k) => (headers[k] = v))
    calls.push({method: init?.method ?? 'GET', url, headers, body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined})
    const match = responses.find(([fragment]) => url.includes(fragment))
    return new Response(JSON.stringify(match ? match[1] : {responseStatus: {isSuccess: true, errors: []}}), {
      status: 200,
      headers: {'Content-Type': 'application/json'},
    })
  }) as typeof globalThis.fetch
}

beforeEach(() => {
  calls = []
  realFetch = globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
})

describe('norbix membership email-verification', () => {
  it('confirm sends the token to the public confirm route and prints the login', async () => {
    fakeFetch([
      [
        '/membership/userauth/email-verification/confirm',
        {authId: 'usr_2RnprGBdji8XyctM7JWOP3', verifiedAtUtc: '2026-11-22T10:14:07Z', responseStatus: {isSuccess: true, errors: []}},
      ],
    ])

    const {result, error} = await runCommand<{authId: string}>([
      'membership', 'email-verification', 'confirm', 'tok-from-the-link', '--env', 'TEST', ...globalArgs,
    ])

    expect(error).toBeUndefined()
    const post = calls.find((c) => c.url.includes('/email-verification/confirm'))!
    expect(post.method).toBe('POST')
    expect(new URL(post.url).pathname).toMatch(/\/membership\/userauth\/email-verification\/confirm$/)
    expect(post.headers['norbix-env']).toBe('TEST')
    expect(post.body).toEqual({token: 'tok-from-the-link'})
    expect(result?.authId).toBe('usr_2RnprGBdji8XyctM7JWOP3')
  })

  it('resend sends the address to the public resend route', async () => {
    fakeFetch([])

    const {error} = await runCommand(['membership', 'email-verification', 'resend', 'klientas@example.com', '--env', 'PROD', ...globalArgs])

    expect(error).toBeUndefined()
    const post = calls.find((c) => c.url.includes('/email-verification/resend'))!
    expect(post.method).toBe('POST')
    expect(post.body).toEqual({email: 'klientas@example.com'})
  })
})

describe('norbix membership settings email-verification set', () => {
  it('saves verification on, then the callback, then the block — in that order', async () => {
    fakeFetch([])

    const {error} = await runCommand([
      'membership', 'settings', 'email-verification', 'set',
      '--on', '--expiration', '30', '--callback', 'https://app.example.com/verify-email', '--require', '--env', 'PROD', ...globalArgs,
    ])

    expect(error).toBeUndefined()
    const saves = calls.filter((c) => c.method === 'PUT' && c.url.includes('/membership/authorization')).map((c) => c.body)
    expect(saves).toEqual([
      expect.objectContaining({setting: 'AllowUserVerification', needVerification: true, emailVerificationExpiration: 30}),
      expect.objectContaining({setting: 'UserVerificationCallback', verificationCallback: 'https://app.example.com/verify-email'}),
      expect.objectContaining({setting: 'RequireEmailVerification', requireEmailVerification: true}),
    ])
  })

  it('maps each flag to its single-setting save', () => {
    expect(verificationSaves({off: true})).toEqual([{setting: 'AllowUserVerification', needVerification: false}])
    expect(verificationSaves({require: false})).toEqual([{setting: 'RequireEmailVerification', requireEmailVerification: false}])
    expect(verificationSaves({template: 'tmpl_x'})).toEqual([
      {setting: 'AllowUserVerification', needVerification: true, verificationEmailTemplate: 'tmpl_x'},
    ])
    expect(verificationSaves({})).toEqual([])
  })

  it('refuses a call with nothing to save', async () => {
    fakeFetch([])
    const {error} = await runCommand(['membership', 'settings', 'email-verification', 'set', '--env', 'PROD', ...globalArgs])
    expect(error?.message).toContain('Pass --on')
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(0)
  })
})
