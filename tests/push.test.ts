import {describe, expect, it} from 'vitest'

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
    {command: PushIntegrationDisable, method: 'disablePushIntegration', argv: [ID]},
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
