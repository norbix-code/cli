import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class MembershipTriggerEventValues extends BaseCommand {
  static description = `List the values each membership trigger event carries, by name

For example "Registered user → e-mail address" is key User.Email with resolver
New. To bind a template token of a membership trigger's e-mail, SMS or push
action to one of them, save the token mapping as {"key": <template token>,
"value": <key>, "resolver": <resolver>} — never resolver Custom, which sends the
key as fixed text. "initiatorNote" says why Initiator.* is not the person of the
event.`

  static examples = [
    '<%= config.bin %> membership trigger event-values',
    '<%= config.bin %> membership trigger event-values --when OnUpdated --json',
  ]

  static flags = {
    when: Flags.string({
      description: 'Only this event',
      options: ['OnRegistered', 'OnInvited', 'OnVerified', 'OnUpdated', 'OnDeleted', 'OnBlocked', 'OnReactivated', 'OnUserCreated'],
    }),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(MembershipTriggerEventValues)
    const client = this.client(flags)

    const res = await client.hub.membership.getMembershipTriggerEventValues({})
    const events = res.result?.events ?? []
    const shown = flags.when ? events.filter((e) => e.when === flags.when) : events
    this.print(flags.when ? (shown[0] ?? {}) : (res.result ?? res))
    return flags.when ? {...res, result: {events: shown}} : res
  }
}
