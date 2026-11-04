import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {TRIGGER_TYPES} from '../../lib/triggers.js'

export default class TriggerDefinition extends BaseCommand {
  static description = `Show one trigger in the shape its save takes

Read → change → save: the answer is the body of \`<module> trigger save --file\`
(the trigger under "trigger", with "type", "when", "action", …), whatever the
module. --type names the kind; a Schema trigger also needs --schema (the
collection it watches). Save it back with the trigger's id:
\`norbix trigger definition trg_1 --type Files --json > t.json\`, edit, then
\`norbix files trigger save --file t.json --id trg_1\`.`

  static examples = [
    '<%= config.bin %> trigger definition trg_8d1e0b --type Files --json',
    '<%= config.bin %> trigger definition trg_8d1e0b --type Schema --schema 66b2f0a1c3d4e5f6a7b8c9d0 --json',
  ]

  static args = {
    id: Args.string({required: true, description: 'Trigger ID (trg_…)'}),
  }

  static flags = {
    type: Flags.string({required: true, options: TRIGGER_TYPES, description: 'Which kind of trigger'}),
    schema: Flags.string({description: 'The collection (schema) id the trigger watches — required for a Schema trigger'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(TriggerDefinition)
    const client = this.client(flags)

    const res = await client.hub.triggers.getTriggerDefinition({
      id: args.id,
      triggerType: flags.type as never,
      schemaId: flags.schema,
    })

    this.print(res)
    return res
  }
}
