import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {readJsonObject} from '../../lib/payments.js'
import {executionIdentityFlag, formatIdentityCheck, TRIGGER_TYPES} from '../../lib/triggers.js'

export default class TriggerIdentityCheck extends BaseCommand {
  static description = `Check who a trigger action would run as, before saving the trigger

Answers whether you may name the execution identity (--execution-identity; left
out = the environment's default) for this kind of trigger and this action, and
what the identity lacks for the action (e.g. email:create for an Email
action). Nothing is saved. The action is the same object a trigger file holds
under "action": {"type": "Email", "integrationId": "int_…", …}.`

  static examples = [
    '<%= config.bin %> trigger identity-check --type Schema --action \'{"type":"Email","integrationId":"int_1","templateId":"tpl_1"}\'',
    '<%= config.bin %> trigger identity-check --type Files --action @action.json --execution-identity usr_66b2f0a1',
    '<%= config.bin %> trigger identity-check --type Payments --action @action.json --json',
  ]

  static flags = {
    type: Flags.string({required: true, options: TRIGGER_TYPES, description: 'Which kind of trigger'}),
    action: Flags.string({required: true, description: 'The trigger action as JSON (inline, @file or `-`)'}),
    'execution-identity': executionIdentityFlag,
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(TriggerIdentityCheck)
    const client = this.client(flags)

    const action = await readJsonObject(flags.action, 'action')

    const res = await client.hub.triggers.checkTriggerExecutionIdentity({
      triggerType: flags.type as never,
      executionIdentityId: flags['execution-identity'],
      action: action as never,
    })

    this.print(formatIdentityCheck(res))
    return res
  }
}
