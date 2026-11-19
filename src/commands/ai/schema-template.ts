import {Args, Flags} from '@oclif/core'

import {parseJsonText, TemplateDoorCommand, type EntityGraph} from '../../lib/template-doors.js'

export default class AiSchemaTemplate extends TemplateDoorCommand {
  static description = `Read schema registry entities with their related ones

The full shape of the named entities: their intermediate-format documents
(fields, kinds, blocks, taxonomies, relationships), plus related entities up to
--depth. Use it for an app with several collections. At most 10 entities come
back.

Reading creates nothing. To create the collections, apply the same ids as a
bundle (the AI tool apply_database_schema_bundle).`

  static examples = [
    '<%= config.bin %> ai schema-template employees',
    '<%= config.bin %> ai schema-template blog_posts,comments --depth 0',
    '<%= config.bin %> ai schema-template employees --json',
  ]

  static args = {
    names: Args.string({required: true, description: 'Comma-separated entity ids (norbix ai schema-templates)'}),
  }

  static flags = {
    depth: Flags.integer({description: '0 = the named ones only, 1 = with directly related ones (default), 3 at most', min: 0, max: 3}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiSchemaTemplate)
    const data = await this.door<EntityGraph>(
      flags, 'get_entity_graph', {names: args.names, depth: flags.depth}, 'norbix ai schema-template --help',
    )
    const result = {
      capped: data.capped ?? false,
      unknown: data.unknown ?? [],
      entities: (data.entities ?? []).map((e) => ({id: e.id, related: e.related, ifDocument: parseJsonText(e.ifDocument)})),
    }

    this.print(result)
    return result
  }
}
