import {describe, expect, it} from 'vitest'

import AccountBundles from '../src/commands/account/bundles.js'
import AccountChangeBundle from '../src/commands/account/change-bundle.js'
import AccountClusters from '../src/commands/account/clusters.js'
import AccountClustersUpgrade from '../src/commands/account/clusters/upgrade.js'
import AccountMe from '../src/commands/account/me.js'
import AccountMeSetPhone from '../src/commands/account/me/set-phone.js'
import AccountTeam from '../src/commands/account/team.js'
import {type RecordedCall, recordingNotifications, runCommand} from './_helpers.js'

/**
 * Which SDK method each account command picks and which fields it fills.
 * `client.hub.account` is a recorder; `account-routes.test.ts` proves the
 * verb and path through the real transport.
 */
async function run(command: Parameters<typeof runCommand>[0], argv: string[]) {
  const calls: RecordedCall[] = []
  const result = await runCommand(command, argv, {account: recordingNotifications(calls)})
  return {calls, output: result.output}
}

describe('account team', () => {
  it('sends no field without flags (owner left out, every project)', async () => {
    const {calls} = await run(AccountTeam, [])
    expect(calls).toEqual([{method: 'getAccountCollaborators', request: {}}])
  })

  it('maps paging and filters to the flat request fields', async () => {
    const {calls} = await run(AccountTeam, [
      '--page-size', '50', '--after', 'acc_usr_20', '--before', 'acc_usr_90', '--in-project', 'prj_1', '--include-owner',
    ])
    expect(calls).toEqual([
      {
        method: 'getAccountCollaborators',
        request: {projectId: 'prj_1', includeAccountOwner: true, pageSize: 50, startingAfter: 'acc_usr_20', endingBefore: 'acc_usr_90'},
      },
    ])
  })
})

describe('account me', () => {
  it('reads your own record', async () => {
    const {calls} = await run(AccountMe, [])
    expect(calls).toEqual([{method: 'getMyAccountUserProfile', request: {}}])
  })
})

describe('account me set-phone', () => {
  it('saves the phone and says so', async () => {
    const {calls, output} = await run(AccountMeSetPhone, ['+37060000000'])
    expect(calls).toEqual([{method: 'updateMyAccountUserPhone', request: {phone: '+37060000000'}}])
    expect(output).toEqual(['Phone number set to +37060000000.'])
  })

  it('--clear sends an empty phone', async () => {
    const {calls, output} = await run(AccountMeSetPhone, ['--clear'])
    expect(calls).toEqual([{method: 'updateMyAccountUserPhone', request: {phone: ''}}])
    expect(output).toEqual(['Phone number cleared.'])
  })

  it('refuses no phone and no --clear', async () => {
    await expect(run(AccountMeSetPhone, [])).rejects.toThrow(/Pass a phone number/)
  })
})

describe('account bundles / change-bundle', () => {
  it('bundles reads the list with no field', async () => {
    const {calls} = await run(AccountBundles, [])
    expect(calls).toEqual([{method: 'getManagedServiceBundles', request: {}}])
  })

  it('change-bundle maps the two flags to the gateway enums and says the change went to Stripe', async () => {
    const {calls, output} = await run(AccountChangeBundle, ['--bundle', 'scale', '--period', 'monthly', '--yes'])
    expect(calls).toEqual([{method: 'changeManagedServiceBundle', request: {bundle: 'Scale', billingPeriod: 'Monthly'}}])
    expect(output).toEqual([
      'The change to the Scale bundle, billed monthly, was sent to Stripe. `norbix account status` shows it when Stripe has confirmed it.',
    ])
  })

  it('change-bundle --period annual reads "billed annually" in the answer and in the question', async () => {
    const {calls, output} = await run(AccountChangeBundle, ['--bundle', 'starter', '--period', 'annual', '--yes'])
    expect(calls).toEqual([{method: 'changeManagedServiceBundle', request: {bundle: 'Starter', billingPeriod: 'Annual'}}])
    expect(output[0]).toMatch(/^The change to the Starter bundle, billed annually, was sent to Stripe\./)

    await expect(run(AccountChangeBundle, ['--bundle', 'starter', '--period', 'annual'])).rejects.toThrow(
      'Confirmation required: Move the account to the Starter bundle, billed annually? This changes what the account pays.',
    )
  })

  it('change-bundle without --yes calls nothing', async () => {
    const calls: RecordedCall[] = []
    await expect(
      runCommand(AccountChangeBundle, ['--bundle', 'scale', '--period', 'monthly'], {account: recordingNotifications(calls)}),
    ).rejects.toThrow(/Confirmation required: Move the account to the Scale bundle, billed monthly\?/)
    expect(calls).toEqual([])
  })
})

describe('account clusters / clusters upgrade', () => {
  it('clusters reads the list with no field', async () => {
    const {calls} = await run(AccountClusters, [])
    expect(calls).toEqual([{method: 'getFlexClusters', request: {}}])
  })

  it('clusters upgrade sends the cluster id and tierCode M10', async () => {
    const {calls} = await run(AccountClustersUpgrade, ['fxc_1', '--yes'])
    expect(calls).toEqual([{method: 'upgradeFlexCluster', request: {flexClusterId: 'fxc_1', tierCode: 'M10'}}])
  })

  it('clusters upgrade without --yes calls nothing', async () => {
    const calls: RecordedCall[] = []
    await expect(runCommand(AccountClustersUpgrade, ['fxc_1'], {account: recordingNotifications(calls)})).rejects.toThrow(
      /Confirmation required: Move cluster fxc_1 to M10\?/,
    )
    expect(calls).toEqual([])
  })
})
