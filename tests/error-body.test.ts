import {afterAll, beforeAll, describe, expect, it} from 'vitest'

import {formatErrorText, toEnvelope, type ErrorEnvelope} from '../src/lib/cli-error.js'
import {responseError} from '../src/lib/http-response.js'
import {cli, makeHome, parseSingleJson, startFakeGateway, type FakeGateway} from './_cli.js'

/**
 * N53 (Happy Tummy): a 503 / 429 / HTML answer must never end silently or
 * with a generic message. The envelope carries the status, every gateway
 * error item, the start of a body that is not a Norbix error, and the retry
 * hint; the exit code is non-zero.
 */

/** A stand-in for the SDK's NorbixError family (duck-typed by name + status). */
function sdkError(name: string, init: Record<string, unknown> & {message: string; status: number}): Error {
  const err = Object.assign(new Error(init.message), init)
  err.name = name
  return err
}

const HTML = `<html>\n<head><title>503 Service Temporarily Unavailable</title></head>\n<body>${'x'.repeat(800)}</body></html>`

describe('toEnvelope: error bodies', () => {
  it('503 with JSON: status, every errorCode + message, exit 8', () => {
    const env = toEnvelope(
      sdkError('NorbixError', {
        message: 'Storage is not available',
        status: 503,
        code: 'CM-ERRORS-FILES-020',
        fieldErrors: [
          {errorCode: 'CM-ERRORS-FILES-020', message: 'Storage is not available'},
          {errorCode: 'CM-ERRORS-FILES-021', message: 'The bucket did not answer in time'},
        ],
        raw: {responseStatus: {errorCode: 'CM-ERRORS-FILES-020'}},
      }),
    )
    expect(env.exit).toBe(8)
    expect(env.status).toBe(503)
    expect(env.errors).toEqual([
      {code: 'CM-ERRORS-FILES-020', message: 'Storage is not available'},
      {code: 'CM-ERRORS-FILES-021', message: 'The bucket did not answer in time'},
    ])
    expect(env.body).toBeUndefined()
    const text = formatErrorText(env)
    expect(text).toContain('status: 503')
    expect(text).toContain('- CM-ERRORS-FILES-021 The bucket did not answer in time')
  })

  it('503 with HTML: the start of the body (≤ 500 chars), exit 8', () => {
    const env = toEnvelope(sdkError('NorbixError', {message: 'Request failed (HTTP 503)', status: 503, raw: HTML, fieldErrors: []}))
    expect(env.exit).toBe(8)
    expect(env.status).toBe(503)
    expect(env.body).toMatch(/^<html> <head><title>503 Service Temporarily Unavailable<\/title>/)
    expect(env.body!.length).toBeLessThanOrEqual(501)
    expect(env.body!.endsWith('…')).toBe(true)
    expect(formatErrorText(env)).toContain('body: <html> <head><title>503 Service Temporarily Unavailable')
  })

  it('a JSON body without error items is shown too', () => {
    const env = toEnvelope(sdkError('NorbixError', {message: 'Request failed (HTTP 502)', status: 502, raw: {upstream: 'down'}, fieldErrors: []}))
    expect(env.body).toBe('{"upstream":"down"}')
  })

  it('429 register busy: retryAfterSeconds from the error context, the register hint', () => {
    const env = toEnvelope(
      sdkError('NorbixError', {
        message: 'The project already has 2 register calls running.',
        status: 429,
        code: 'CM-ERRORS-FILES-031',
        fieldErrors: [{errorCode: 'CM-ERRORS-FILES-031', message: 'The project already has 2 register calls running.', meta: {RetryAfterSeconds: 15}}],
      }),
    )
    expect(env.exit).toBe(8)
    expect(env.retryAfterSeconds).toBe(15)
    expect(env.hint).toMatch(/^Register busy/)
    expect(env.hint).toContain('Retry after 15 seconds')
    expect(formatErrorText(env)).toContain('retryAfterSeconds: 15')
  })

  it('429 with only a Retry-After header: the generic retry hint', () => {
    const env = toEnvelope(sdkError('NorbixError', {message: 'Too many requests', status: 429, retryAfterSeconds: 3, fieldErrors: []}))
    expect(env.retryAfterSeconds).toBe(3)
    expect(env.hint).toBe('Rate limited. Retry after 3 seconds.')
  })

  it('network error: exit 7, the reason from the cause, no body', () => {
    const cause = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:1'), {code: 'ECONNREFUSED'})
    const raw = Object.assign(new TypeError('fetch failed'), {cause})
    const env = toEnvelope(sdkError('NorbixNetworkError', {message: 'fetch failed', status: 0, code: 'NORBIX_NETWORK_ERROR', raw, url: 'http://127.0.0.1:1/v3/x'}))
    expect(env.exit).toBe(7)
    expect(env.message).toBe('fetch failed (ECONNREFUSED)')
    expect(env.status).toBeUndefined()
    expect(env.body).toBeUndefined()
  })

  it('a bare fetch that never connected is a network error, not an internal one', () => {
    const err = Object.assign(new TypeError('fetch failed'), {cause: {code: 'ENOTFOUND'}})
    const env = toEnvelope(err)
    expect(env.exit).toBe(7)
    expect(env.message).toBe('fetch failed (ENOTFOUND)')
  })

  it('responseError (direct fetch sites) keeps status, items, body and retry', () => {
    const html = toEnvelope(responseError(503, HTML, 'http://h/v3/x'))
    expect(html).toMatchObject({exit: 8, status: 503, message: 'HTTP 503'})
    expect(html.body).toContain('503 Service Temporarily Unavailable')

    const busy = toEnvelope(
      responseError(429, {responseStatus: {errors: [{errorCode: 'CM-ERRORS-FILES-031', message: 'busy', context: {RetryAfterSeconds: 15}}]}}, 'http://h/v3/x'),
    )
    expect(busy).toMatchObject({exit: 8, status: 429, code: 'CM-ERRORS-FILES-031', retryAfterSeconds: 15, message: 'HTTP 429: CM-ERRORS-FILES-031 busy'})
    expect(busy.hint).toMatch(/Register busy.*15 seconds/)
  })
})

describe('the built CLI against a failing gateway', () => {
  let gateway: FakeGateway
  let home: string

  beforeAll(async () => {
    gateway = await startFakeGateway()
    home = makeHome(gateway.port)
  })

  afterAll(async () => {
    await gateway.close()
  })

  const envelope = (stdout: string) => (parseSingleJson(stdout) as {error: ErrorEnvelope}).error

  for (const via of [
    {name: 'SDK command', argv: (p: string) => ['users', 'get', p]},
    {name: 'raw', argv: (p: string) => ['raw', `/v3/${p}`]},
  ]) {
    describe(via.name, () => {
      it('503 JSON: status and both error items, exit 8', async () => {
        const text = await cli(home, [...via.argv('json503'), '--profile', 'x'])
        expect(text.code).toBe(8)
        expect(text.stdout).toBe('')
        expect(text.stderr).toContain('status: 503')
        expect(text.stderr).toContain('CM-ERRORS-FILES-020')
        expect(text.stderr).toContain('The bucket did not answer in time')

        const json = await cli(home, [...via.argv('json503'), '--profile', 'x', '--json'])
        expect(json.code).toBe(8)
        const e = envelope(json.stdout)
        expect(e.status).toBe(503)
        expect(e.errors?.map((i) => i.code)).toEqual(['CM-ERRORS-FILES-020', 'CM-ERRORS-FILES-021'])
      })

      it('503 HTML: status and the start of the page, exit 8', async () => {
        const text = await cli(home, [...via.argv('html503'), '--profile', 'x'])
        expect(text.code).toBe(8)
        expect(text.stderr).toContain('status: 503')
        expect(text.stderr).toContain('body: <html> <head><title>503 Service Temporarily Unavailable</title>')

        const json = await cli(home, [...via.argv('html503'), '--profile', 'x', '--json'])
        expect(json.code).toBe(8)
        const e = envelope(json.stdout)
        expect(e.status).toBe(503)
        expect(e.body!.length).toBeLessThanOrEqual(501)
      })

      it('429 register busy: the retry hint, exit 8', async () => {
        const text = await cli(home, [...via.argv('busy429'), '--profile', 'x'])
        expect(text.code).toBe(8)
        expect(text.stderr).toContain('status: 429')
        expect(text.stderr).toContain('CM-ERRORS-FILES-031')
        expect(text.stderr).toContain('retryAfterSeconds: 15')
        expect(text.stderr).toMatch(/Hint: Register busy.*Retry after 15 seconds/)

        const json = await cli(home, [...via.argv('busy429'), '--profile', 'x', '--json'])
        expect(json.code).toBe(8)
        expect(envelope(json.stdout)).toMatchObject({code: 'CM-ERRORS-FILES-031', status: 429, retryAfterSeconds: 15})
      })

      it('network error: exit 7 naming the host', async () => {
        const r = await cli(home, [...via.argv('anything'), '--profile', 'y', '--json'])
        expect(r.code).toBe(7)
        const e = envelope(r.stdout)
        expect(e.code).toBe('NORBIX_NETWORK_ERROR')
        expect(e.message).toContain('127.0.0.1:1')
      })
    })
  }
})
