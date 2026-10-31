import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {formatTriggerRun, TRIGGER_TYPES} from '../../lib/triggers.js'

/** One module's reader cannot read another's runs: these answers mean "try the next type". */
const NOT_THIS_TYPE = new Set([403, 404])

export default class TriggerRun extends BaseCommand {
  static description = `Show one trigger run

One run (a trr_… id from \`trigger runs\`): the result and its reason, who it ran
as, who caused it, what it produced, and the correlation id for the logs. Never
the event's data.

The Hub reads a run by id and trigger type. --type names the type; without it
the five types are tried in turn, one call each, so pass it from a script.`

  static examples = [
    '<%= config.bin %> trigger run trr_1p4R3gTobGZpD6fX',
    '<%= config.bin %> trigger run trr_1p4R3gTobGZpD6fX --type Membership --json',
  ]

  static args = {
    id: Args.string({required: true, description: 'Trigger run ID (trr_…)'}),
  }

  static flags = {
    type: Flags.string({options: TRIGGER_TYPES, description: 'Which kind of trigger the run belongs to'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(TriggerRun)
    const client = this.client(flags)
    const read = (triggerType: string) =>
      client.hub.triggers.getTriggerRun({id: args.id, triggerType: triggerType as never})

    if (flags.type) {
      const res = await read(flags.type)
      this.print(formatTriggerRun(res))
      return res
    }

    let refused: unknown
    for (const type of TRIGGER_TYPES) {
      try {
        const res = await read(type)
        this.print(formatTriggerRun(res))
        return res
      } catch (error) {
        if (!NOT_THIS_TYPE.has((error as {status?: number}).status ?? 0)) throw error
        refused = error
      }
    }

    throw refused
  }
}
