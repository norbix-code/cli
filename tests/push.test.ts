import {runCommand as runOclif} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'

import PushDeviceRegister from '../src/commands/push/device/register.js'
import PushIntegration from '../src/commands/push/integration.js'
import PushIntegrationDefault from '../src/commands/push/integration/default.js'
import PushIntegrationDelete from '../src/commands/push/integration/delete.js'
import PushIntegrationDisable from '../src/commands/push/integration/disable.js'
import PushIntegrationEnable from '../src/commands/push/integration/enable.js'
import PushIntegrationTest from '../src/commands/push/integration/test.js'
import PushIntegrations from '../src/commands/push/integrations.js'
import PushPreview from '../src/commands/push/preview.js'
import PushSettings from '../src/commands/push/settings.js'
import {runCommand} from './_helpers.js'

const ID = '66b2f0a1'

describe('push settings', () => {
  it('reads the project settings', async () => {
    const {calls} = await runCommand(PushSettings, [])
    expect(calls).toEqual([{method: 'getPushSettings', request: {}}])
  })

  it('passes an explicit settings id', async () => {
    const {calls} = await runCommand(PushSettings, ['--id', ID])
    expect(calls[0]?.request).toEqual({id: ID})
  })
})

describe('push preview', () => {
  it('sends the preview hash', async () => {
    const {calls} = await runCommand(PushPreview, ['8f2a91c4'])
    expect(calls).toEqual([{method: 'previewPushNotification', request: {hash: '8f2a91c4'}}])
  })

  it('takes the hash from --hash too', async () => {
    const {calls} = await runCommand(PushPreview, ['--hash', 'abc.def'])
    expect(calls).toEqual([{method: 'previewPushNotification', request: {hash: 'abc.def'}}])
  })

  it('refuses to run with no hash at all', async () => {
    await expect(runCommand(PushPreview, [])).rejects.toThrow(/preview hash/)
  })
})

/**
 * The signed preview link opens without sign-in: the hash is the key. These run
 * the real command through oclif and the real `@norbix.ai/ts` transport, with
 * `fetch` replaced — nothing leaves the process. The test HOME is empty (see
 * test/setup.ts), so there is no login session and no profile.
 */
describe('push preview — signed link, no login, no project', () => {
  interface Sent {
    url: URL
    headers: Headers
  }

  let sent: Sent[]
  let realFetch: typeof globalThis.fetch

  beforeEach(() => {
    sent = []
    realFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      sent.push({url: new URL(href), headers: new Headers(init?.headers)})
      return new Response(JSON.stringify({title: 'Hi', body: 'There'}), {
        status: 200,
        headers: {'Content-Type': 'application/json'},
      })
    }) as typeof globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it('does not ask for a project, and sends no project header', async () => {
    const {error} = await runOclif([
      'push', 'preview', '--hash', 'abc.def', '--api-key', 'k-1', '--region', 'nb-eu-germany',
    ])

    expect(error).toBeUndefined()
    expect(sent).toHaveLength(1)
    expect(sent[0]!.url.pathname).toBe('/v2/notifications/push/preview')
    expect(sent[0]!.url.searchParams.get('hash')).toBe('abc.def')
    expect(sent[0]!.headers.get('norbix-project-id')).toBeNull()
    expect(sent[0]!.headers.get('X-CM-ProjectId')).toBeNull()
  })

  it('still uses a login when there is one', async () => {
    const {error} = await runOclif([
      'push', 'preview', 'abc.def', '--api-key', 'k-1', '--project', 'p-1', '--region', 'nb-eu-germany',
    ])

    expect(error).toBeUndefined()
    expect(sent[0]!.headers.get('Authorization')).toBe('Bearer k-1')
    expect(sent[0]!.headers.get('norbix-project-id')).toBe('p-1')
  })

  it("does not stop with the CLI's own 'Not authenticated' / 'No project ID' errors", async () => {
    const {error} = await runOclif(['push', 'preview', '--hash', 'abc.def', '--region', 'nb-eu-germany'])

    expect(error?.message ?? '').not.toMatch(/Not authenticated\.|No project ID configured/)
  })

  /**
   * With @norbix.ai/ts 4.2.0 the preview method is scoped 'optional', so a call
   * with no login goes out with no Authorization header — the signed link is
   * the key. (2.1.0 refused it with NORBIX_NOT_AUTHENTICATED; this test pinned
   * that until the SDK was bumped.)
   */
  it('sends the request with no Authorization header when there is no login', async () => {
    const {error} = await runOclif(['push', 'preview', '--hash', 'abc.def', '--region', 'nb-eu-germany'])

    expect(error).toBeUndefined()
    expect(sent).toHaveLength(1)
    expect(sent[0]!.url.pathname).toBe('/v2/notifications/push/preview')
    expect(sent[0]!.headers.get('Authorization')).toBeNull()
  })
})

describe('push integrations', () => {
  it('lists with no paging by default', async () => {
    const {calls} = await runCommand(PushIntegrations, [])
    expect(calls[0]?.method).toBe('getPushIntegrations')
    expect(calls[0]?.request).toEqual({pageSize: undefined, startingAfter: undefined})
  })

  it('passes page size and cursor', async () => {
    const {calls} = await runCommand(PushIntegrations, ['--page-size', '50', '--after', 'cur_1'])
    expect(calls[0]?.request).toEqual({pageSize: 50, startingAfter: 'cur_1'})
  })

  it('shows one integration', async () => {
    const {calls} = await runCommand(PushIntegration, [ID])
    expect(calls).toEqual([{method: 'getPushIntegration', request: {id: ID}}])
  })
})

describe('push integration state changes', () => {
  // Each of these routes has an {Id} token, and the transport fills tokens by
  // exact name — so the request must carry `Id`, not `id`. Getting this wrong
  // throws NORBIX_MISSING_PATH_PARAM at runtime, which is why it is pinned.
  const cases = [
    {command: PushIntegrationEnable, method: 'enablePushIntegration', argv: [ID]},
    {command: PushIntegrationDisable, method: 'disablePushIntegration', argv: [ID, '--yes']},
    {command: PushIntegrationDefault, method: 'setPushIntegrationAsDefault', argv: [ID]},
    {command: PushIntegrationDelete, method: 'deletePushIntegration', argv: [ID, '--yes']},
  ]

  for (const {command, method, argv} of cases) {
    it(`${method} sends the id as the Id route token`, async () => {
      const {calls} = await runCommand(command, argv)
      expect(calls).toEqual([{method, request: {Id: ID}}])
    })
  }
})

describe('push integration test', () => {
  it('sends through the chosen integration', async () => {
    const {calls} = await runCommand(PushIntegrationTest, [
      '--integration',
      ID,
      '--token',
      'dGVzdA==',
      '--family',
      'Ios',
    ])
    expect(calls).toEqual([
      {
        method: 'testPushIntegration',
        request: {integrationId: ID, testToken: 'dGVzdA==', deliveryFamily: 'Ios'},
      },
    ])
  })

  it('requires an integration id', async () => {
    await expect(runCommand(PushIntegrationTest, ['--token', 'dGVzdA=='])).rejects.toThrow()
  })
})

describe('push device register', () => {
  it('registers a device against a user', async () => {
    const {calls} = await runCommand(PushDeviceRegister, [
      '--user',
      'usr_123',
      '--token',
      'dGVzdA==',
      '--os',
      'iOS',
      '--model',
      'iPhone 15',
    ])

    expect(calls[0]?.method).toBe('registerDevice')
    expect(calls[0]?.request).toEqual({
      userId: 'usr_123',
      pushDeviceDto: {
        deviceId: undefined,
        deviceOs: 'iOS',
        token: 'dGVzdA==',
        modelName: 'iPhone 15',
        deviceName: undefined,
      },
    })
  })

  it('requires a user id', async () => {
    await expect(
      runCommand(PushDeviceRegister, ['--token', 'dGVzdA==', '--os', 'iOS']),
    ).rejects.toThrow()
  })
})
