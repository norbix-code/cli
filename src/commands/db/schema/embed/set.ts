import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../../base.js'
import {usageError} from '../../../../lib/cli-error.js'
import {READ_FIRST_DRY_RUN, boolFlag, boolOf, listOf, nothingRead} from '../../../../lib/membership.js'

export default class DbSchemaEmbedSet extends BaseCommand {
  static description = `Change the AI embed setting of a database schema

The gateway replaces the whole setting at once (enabled, fields, embedding
integration, per user), so the command reads the schema first and changes
only what you pass. --per-user true needs "records have an owner"
(\`db schema settings set <id> --record-owner true\`).

${READ_FIRST_DRY_RUN}`

  static examples = [
    '<%= config.bin %> db schema embed set sch_7lPCzWonEvTQsheGDCaKq --enabled true --fields title,body',
    '<%= config.bin %> db schema embed set sch_7lPCzWonEvTQsheGDCaKq --enabled false',
    '<%= config.bin %> db schema embed set sch_7lPCzWonEvTQsheGDCaKq --embedding-integration int_1 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Schema ID (sch_…)'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    enabled: boolFlag('Embed the records on insert / update / delete'),
    fields: Flags.string({description: 'Top-level fields whose values form the text, comma separated (repeatable)', multiple: true}),
    'embedding-integration': Flags.string({description: 'Embedding integration ID', exclusive: ['default-embedding-integration']}),
    'default-embedding-integration': Flags.boolean({description: "Use the project's default embedding integration", default: false}),
    'per-user': boolFlag("Each record's knowledge belongs to its owner only"),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbSchemaEmbedSet)
    const changes: Record<string, unknown> = {}
    const enabled = boolOf(flags.enabled)
    const perUser = boolOf(flags['per-user'])
    const fields = listOf(flags.fields)
    if (enabled !== undefined) changes.enabled = enabled
    if (perUser !== undefined) changes.perUser = perUser
    if (fields) changes.fields = fields
    if (flags['embedding-integration'] !== undefined) changes.embeddingIntegrationId = flags['embedding-integration']
    if (flags['default-embedding-integration']) changes.embeddingIntegrationId = undefined

    if (Object.keys(changes).length === 0) throw usageError('Pass at least one change, e.g. --enabled true.')

    const client = this.client(flags)
    let current: Record<string, unknown> = {}
    if (!flags['dry-run']) {
      const read = await client.hub.database.getDatabaseSchema({id: args.id})
      if (!read?.item) throw nothingRead(`schema ${args.id}`, 'Check the schema id (sch_…), the project and --env.')
      current = (read.item.embed ?? {enabled: false, fields: [], perUser: false}) as unknown as Record<string, unknown>
    }

    const embed = {...current, ...changes}
    const res = await client.hub.database.updateDatabaseSchemaEmbed({id: args.id, embed} as never)
    this.print(`Embed setting of schema ${args.id} saved.`)
    return res
  }
}
