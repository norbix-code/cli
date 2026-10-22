import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import {envListAnswer} from '../tests/_env.js'
import {deliveryFrom, describe as report} from '../src/commands/membership/password/reset/request.js'

/**
 * `norbix membership password reset request` (gateway N45 item 6).
 *
 * The real command runs through oclif with `fetch` replaced: the admin test
 * route is called on the API with the env header, the hub's project log is
 * read by the answer's correlation id, and the report names the integration
 * that sent the e-mail.
 */

const PROJECT = 'test-project'
const API_KEY = 'test-api-key'
const REGION = 'nb-eu-germany'
const CORRELATION = '0e563daa3ce7d2389f7ecc185e01656d'
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
    return new Response(JSON.stringify(match ? match[1] : {}), {status: 200, headers: {'Content-Type': 'application/json'}})
  }) as typeof globalThis.fetch
}

const queued = {
  queued: true,
  env: 'TEST',
  correlationId: CORRELATION,
  expiresAtUtc: '2026-10-22T08:45:32Z',
  integrationId: 'int_57wC6x4g7mHr2uuUO7hMJB',
  integrationName: 'Test Me',
  provider: 'Fake',
  responseStatus: {isSuccess: true, errors: []},
}

const sentEntry = {
  list: {
    items: [
      {
        eventCode: 'membership:email:sent',
        meta: {
          stage: 'send',
          integrationId: 'int_57wC6x4g7mHr2uuUO7hMJB',
          integrationName: 'Test Me',
          provider: 'Fake',
          template: 'tmpl_3ckGBebabo8Z5BiaOgfdG4',
          language: 'lt',
        },
      },
    ],
  },
}

beforeEach(() => {
  calls = []
  realFetch = globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
})

describe('norbix membership password reset request', () => {
  it('calls the admin route in the env and reports the integration that sent it', async () => {
    fakeFetch([
      ['/membership/userauth/password/reset/test', queued],
      ['/logs', sentEntry],
    ])

    const {result, error} = await runCommand<{delivery: unknown; queued: boolean}>([
      'membership', 'password', 'reset', 'request', 'tester@example.com', '--env', 'TEST', '--wait', '5', ...globalArgs,
    ])

    expect(error).toBeUndefined()
    const post = calls.find((c) => c.url.includes('/password/reset/test'))!
    expect(post.method).toBe('POST')
    expect(new URL(post.url).pathname).toBe('/v3/membership/userauth/password/reset/test')
    expect(post.headers['norbix-env']).toBe('TEST')
    expect(post.body).toEqual({email: 'tester@example.com'})
    const logs = calls.find((c) => new URL(c.url).pathname.endsWith('/logs'))!
    expect(logs.url).toContain(`logCorrelationId=${CORRELATION}`)
    expect(result?.queued).toBe(true)
    expect(result?.delivery).toEqual({
      status: 'sent',
      integrationId: 'int_57wC6x4g7mHr2uuUO7hMJB',
      integrationName: 'Test Me',
      provider: 'Fake',
      template: 'tmpl_3ckGBebabo8Z5BiaOgfdG4',
      templateName: undefined,
      language: 'lt',
      languageRule: undefined,
      fallbackReason: undefined,
    })
  })

  it('says why nothing was sent and does not wait for the hub', async () => {
    fakeFetch([['/membership/userauth/password/reset/test', {...queued, queued: false, reason: 'no-login', correlationId: undefined}]])

    const {result, error} = await runCommand<{reason: string; delivery: {status: string}}>([
      'membership', 'password', 'reset', 'request', 'nobody@example.com', '--env', 'TEST', ...globalArgs,
    ])

    expect(error).toBeUndefined()
    expect(result?.reason).toBe('no-login')
    expect(result?.delivery.status).toBe('unknown')
    expect(calls.some((c) => new URL(c.url).pathname.endsWith('/logs'))).toBe(false)
  })

  it('sends nothing on --dry-run', async () => {
    fakeFetch([])

    const {result, error} = await runCommand<{dryRun: boolean; http: {url: string; headers: Record<string, string>}}>([
      'membership', 'password', 'reset', 'request', 'tester@example.com', '--env', 'TEST', '--dry-run', ...globalArgs,
    ])

    expect(error).toBeUndefined()
    expect(result?.dryRun).toBe(true)
    expect(result?.http.url).toContain('/v3/membership/userauth/password/reset/test')
    expect(result?.http.headers.Authorization).toBe('Bearer ***')
    expect(calls.filter((c) => c.url.includes('/password/reset/'))).toHaveLength(0)
  })
})

describe('the text report', () => {
  it('names the integration and the template, or the fallback reason', () => {
    const sent = deliveryFrom(sentEntry.list.items)
    expect(report(queued, sent, 5)).toBe([
      'Queued in TEST (correlation 0e563daa3ce7d2389f7ecc185e01656d; the link expires 2026-10-22T08:45:32Z).',
      '  Integration for TEST: Test Me (Fake, int_57wC6x4g7mHr2uuUO7hMJB).',
      'Sent by the hub through Test Me (Fake, int_57wC6x4g7mHr2uuUO7hMJB).',
      '  Template tmpl_3ckGBebabo8Z5BiaOgfdG4, language lt.',
    ].join('\n'))
    expect(report({...queued, queued: false, reason: 'no-login'}, {status: 'unknown'}, 5)).toContain(
      "No login with that address in TEST's users database.",
    )
    expect(report(queued, {status: 'unknown'}, 5)).toContain('No project-log entry from the hub within 5s')
  })

  it('ignores the request-side entry and reads the hub one', () => {
    expect(deliveryFrom([{eventCode: 'membership:email:not-sent', meta: {stage: 'request', reason: 'no-login'}}])).toEqual({status: 'unknown'})
    expect(deliveryFrom([{eventCode: 'membership:email:not-sent', meta: {stage: 'send', reason: 'expired before it could be sent'}}]).status).toBe('not-sent')
  })
})

/**
 * Gateway N46 (reopened): the admin answer names the template and language
 * the hub will use, or `fallback: <code (status)>: <reason>` — Happy Tummy's
 * MJML renderer refused the hub's token, so every reset went out as the fixed
 * English text while the template and language were fine.
 */
describe('template, language and fallback (N46)', () => {
  const chosen = {
    ...queued,
    templateId: 'tmpl_4OFYLs4G9VYV223hjuAGhR',
    templateName: 'Password reset',
    templateSource: 'project',
    language: 'en',
    languageRule: 'english',
    templateLanguages: ['en'],
  }
  const refused = {
    ...chosen,
    fallback: "mjml-render-failed (401): the MJML renderer refused the hub's token",
    mjmlRenderer: 'unauthorized (401)',
  }

  it('prints the template and language the hub will use', () => {
    expect(report({...chosen, mjmlRenderer: 'ok'}, {status: 'unknown'}, 0)).toBe([
      'Queued in TEST (correlation 0e563daa3ce7d2389f7ecc185e01656d; the link expires 2026-10-22T08:45:32Z).',
      '  Integration for TEST: Test Me (Fake, int_57wC6x4g7mHr2uuUO7hMJB).',
      '  Template: Password reset (tmpl_4OFYLs4G9VYV223hjuAGhR, project), language en (english; the template has: en).',
      '  MJML renderer: ok.',
    ].join('\n'))
  })

  it('prints fallback: mjml-render-failed (401) when the renderer refuses the token', () => {
    const text = report(refused, {status: 'unknown'}, 0)
    expect(text).toContain("  fallback: mjml-render-failed (401): the MJML renderer refused the hub's token")
    expect(text).toContain('  MJML renderer: unauthorized (401).')
  })

  it('puts the fallback in --json', async () => {
    fakeFetch([['/membership/userauth/password/reset/test', refused]])

    const {result, error} = await runCommand<{fallback: string; mjmlRenderer: string; templateId: string; language: string}>([
      'membership', 'password', 'reset', 'request', 'tester@example.com', '--env', 'TEST', '--wait', '0', '--json', ...globalArgs,
    ])

    expect(error).toBeUndefined()
    expect(result?.fallback).toBe("mjml-render-failed (401): the MJML renderer refused the hub's token")
    expect(result?.mjmlRenderer).toBe('unauthorized (401)')
    expect(result?.templateId).toBe('tmpl_4OFYLs4G9VYV223hjuAGhR')
    expect(result?.language).toBe('en')
  })

  it('reads the hub fallback first: the hub names the chosen template even when it could not render it', () => {
    const delivery = deliveryFrom([
      {
        eventCode: 'membership:email:sent',
        meta: {
          stage: 'send',
          integrationId: 'int_2XKN',
          integrationName: 'Happy Tummy TEST',
          provider: 'AwsSes',
          template: 'tmpl_4OFYLs4G9VYV223hjuAGhR',
          templateName: 'Password reset',
          language: 'en',
          languageRule: 'english',
          fallbackReason: "mjml-render-failed (401): the MJML renderer refused the hub's token",
        },
      },
    ])
    expect(report(chosen, delivery, 5)).toContain(
      "  Fixed English text — fallback: mjml-render-failed (401): the MJML renderer refused the hub's token",
    )
    expect(report(chosen, {...delivery, fallbackReason: undefined}, 5)).toContain(
      '  Template Password reset (tmpl_4OFYLs4G9VYV223hjuAGhR), language en (english).',
    )
  })
})
