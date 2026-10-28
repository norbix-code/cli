import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import {render} from '../src/commands/integrations/keyless-setup.js'
import {envListAnswer} from './_env.js'

/**
 * `norbix integrations keyless-setup <module> <cloud>` (gateway
 * feat/keyless-cloud), run through oclif and the real `@norbix.ai/ts`
 * transport with `fetch` replaced: the one request it sends, the human
 * output and the `--json` document. Nothing leaves the process.
 */

interface Call {
  method: string
  path: string
  query: Record<string, string>
}

const ANSWER = {
  integrationId: 'int_1',
  env: 'PROD',
  module: 'files',
  cloud: 'aws',
  issuer: 'https://issuer.example',
  available: true,
  subject: 'p/test-project/e/PROD/files/i/int_1',
  audience: 'sts.amazonaws.com',
  script: 'aws iam create-role --role-name norbix-files ...',
}

let calls: Call[]
let realFetch: typeof globalThis.fetch

beforeEach(() => {
  calls = []
  realFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const envList = envListAnswer(input, init)
    if (envList) return envList
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    calls.push({method: init?.method ?? 'GET', path: url.pathname, query: Object.fromEntries(url.searchParams)})
    return new Response(JSON.stringify(ANSWER), {status: 200, headers: {'Content-Type': 'application/json'}})
  }) as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
})

const globalArgs = ['--project', 'test-project', '--api-key', 'test-api-key', '--region', 'nb-eu-germany']

describe('norbix integrations keyless-setup', () => {
  it('sends GET /v3/integrations/keyless/setup with module, cloud and the integration id', async () => {
    const {error} = await runCommand([
      'integrations', 'keyless-setup', 'files', 'aws', '--integration-id', 'int_1', ...globalArgs,
    ])

    expect(error).toBeUndefined()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.method).toBe('GET')
    expect(calls[0]?.path).toBe('/v3/integrations/keyless/setup')
    expect(calls[0]?.query).toMatchObject({module: 'files', cloud: 'aws', integrationId: 'int_1'})
  })

  it('leaves the integration id out when none is given', async () => {
    const {error} = await runCommand(['integrations', 'keyless-setup', 'email', 'azure', ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls[0]?.query).toMatchObject({module: 'email', cloud: 'azure'})
    expect(calls[0]?.query).not.toHaveProperty('integrationId')
  })

  it('returns the gateway answer (what --json prints)', async () => {
    const {result, error} = await runCommand(['integrations', 'keyless-setup', 'files', 'aws', '--json', ...globalArgs])

    expect(error).toBeUndefined()
    expect(result).toEqual(ANSWER)
  })

  it('the human view prints issuer, subject, audience, availability and the script', () => {
    expect(render(ANSWER)).toEqual([
      'Integration id: int_1',
      'Environment:    PROD',
      'Module:         files',
      'Cloud:          aws',
      'Issuer:         https://issuer.example',
      'Subject:        p/test-project/e/PROD/files/i/int_1',
      'Audience:       sts.amazonaws.com',
      'Available:      yes',
      '',
      'Script:',
      'aws iam create-role --role-name norbix-files ...',
    ])
  })

  it('the human view gives the reason when keyless is not available, and no script', () => {
    const lines = render({integrationId: 'int_2', module: 'code', cloud: 'google', available: false, unavailableReason: 'no signing key'})

    expect(lines).toContain('Available:      no — no signing key')
    expect(lines).not.toContain('Script:')
  })

  it('refuses an unknown module before sending anything', async () => {
    const {error} = await runCommand(['integrations', 'keyless-setup', 'sms', 'aws', ...globalArgs])

    expect(error?.message).toMatch(/Expected sms to be one of/)
    expect(calls).toHaveLength(0)
  })

  it('keeps `norbix integrations <module>` working next to the new subcommand', async () => {
    const {error} = await runCommand(['integrations', 'files', ...globalArgs])

    expect(error).toBeUndefined()
    expect(calls[0]?.path).toBe('/v3/files/integrations')
  })
})
