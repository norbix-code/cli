import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {readJsonObject, SCHEMA_TRIGGER} from '../../../lib/database.js'

export default class DbTriggerCreate extends BaseCommand {
  static description = `Create or update a schema trigger from a JSON file

The file holds the trigger: name, schemaId, the record events it reacts to,
and an action ({type, ...}) — the same shape \`db trigger <id> --json\` shows.
"type" is set to "Schema" when the file leaves it out. --schema sets schemaId,
--id sets triggerId (update instead of create).

When several triggers fire for the same record event they run as a queue:
--order sets the trigger's place (lower runs first; no order = after the
numbered ones) and --break-on-error stops the later triggers when this one's
action fails (--no-break-on-error turns it off). Both override the file.`

  static examples = [
    '<%= config.bin %> db trigger create --file trigger.json',
    '<%= config.bin %> db trigger create --file trigger.json --schema 66b2f0a1c3d4e5f6a7b8c9d0',
    'cat trigger.json | <%= config.bin %> db trigger create --file -',
    '<%= config.bin %> db trigger create --file trigger.json --dry-run',
    '<%= config.bin %> db trigger create --file trigger.json --id 66b2f0a1c3d4e5f6a7b8c9d0 --order 1 --break-on-error',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    file: Flags.string({required: true, description: 'Trigger JSON file (or `-` for stdin)'}),
    schema: Flags.string({description: 'Schema ID (overrides schemaId in the file)'}),
    id: Flags.string({description: 'Trigger ID — set it to update instead of create'}),
    order: Flags.integer({
      min: 0,
      description: 'Place in the queue of the event: lower runs first, 0 or more (overrides "order" in the file)',
    }),
    'break-on-error': Flags.boolean({
      allowNo: true,
      description: 'Stop the later triggers of the same event when this one fails (overrides "breakOnError" in the file)',
    }),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(DbTriggerCreate)
    const client = this.client(flags)

    const source = flags.file === '-' ? '-' : `@${flags.file}`
    const parsed = await readJsonObject(source, 'file')
    // Accept the bare trigger or the whole request body ({"trigger": {...}}).
    const fromFile = (
      parsed.trigger && typeof parsed.trigger === 'object' ? parsed.trigger : parsed
    ) as Record<string, unknown>

    const trigger: Record<string, unknown> = {type: SCHEMA_TRIGGER, ...fromFile}
    if (flags.schema) trigger.schemaId = flags.schema
    if (flags.id) trigger.triggerId = flags.id
    if (flags.order !== undefined) trigger.order = flags.order
    if (flags['break-on-error'] !== undefined) trigger.breakOnError = flags['break-on-error']

    // The schema-trigger fields are not on the generated base type, so the
    // body is cast: the server picks the shape from `type`.
    const res = await client.hub.database.saveSchemaTrigger({trigger} as unknown as Parameters<
      typeof client.hub.database.saveSchemaTrigger
    >[0])

    this.print(res)
    return res
  }
}
