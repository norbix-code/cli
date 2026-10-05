import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {SCHEMA_TRIGGER} from '../../../lib/database.js'

export default class DbTriggerDisable extends BaseCommand {
  static description = 'Turn a schema trigger off'

  static examples = [
    '<%= config.bin %> db trigger disable 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    '<%= config.bin %> db trigger disable 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Trigger ID'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
    schema: Flags.string({description: 'Schema ID the trigger belongs to'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbTriggerDisable)
    const client = this.client(flags)
    await this.confirmOrFail(`Turn off schema trigger ${args.id}?`, flags)

    const res = await client.hub.database.disableSchemaTrigger({
      triggerId: args.id,
      triggerType: SCHEMA_TRIGGER,
      schemaId: flags.schema,
    })

    this.print(`Trigger ${args.id} disabled.`)
    return res
  }
}
