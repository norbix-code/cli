import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {SCHEMA_TRIGGER} from '../../../lib/database.js'

export default class DbTriggerEnable extends BaseCommand {
  static description = 'Turn a schema trigger on'

  static examples = [
    '<%= config.bin %> db trigger enable 66b2f0a1c3d4e5f6a7b8c9d0',
    '<%= config.bin %> db trigger enable 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Trigger ID'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    schema: Flags.string({description: 'Schema ID the trigger belongs to'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbTriggerEnable)
    const client = this.client(flags)

    const res = await client.hub.database.enableSchemaTrigger({
      triggerId: args.id,
      triggerType: SCHEMA_TRIGGER,
      schemaId: flags.schema,
    })

    this.print(`Trigger ${args.id} enabled.`)
    return res
  }
}
