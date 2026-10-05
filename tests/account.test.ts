import {describe, expect, it} from 'vitest'

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
