import {Args, Flags} from '@oclif/core'

import {TemplateDoorCommand, type SchemaTemplateSearch} from '../../lib/template-doors.js'

export default class AiSchemaTemplates extends TemplateDoorCommand {
  static description = `Search the schema registry: reviewed collection shapes to build from

Employees, blog_posts, orders …: search by keyword BEFORE you design a
collection. Each hit says where the word matched (id, title, alias, tag,
summary), which shared blocks and taxonomies the entity uses and which entities
are related. Without a word the first entities are listed by id.

An entity that is there is created from the registry, never re-typed. Read its
full shape with \`norbix ai schema-template <ids>\`.`

  static examples = [
    '<%= config.bin %> ai schema-templates employee',
    '<%= config.bin %> ai schema-templates "blog comments" --take 5',
    '<%= config.bin %> ai schema-templates --json',
  ]

  static args = {
    query: Args.string({description: 'One or a few words, e.g. employee'}),
  }

  static flags = {
    take: Flags.integer({description: 'How many hits: 10 by default, 25 at most', min: 1, max: 25}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiSchemaTemplates)
    const data = await this.door<SchemaTemplateSearch>(
      flags, 'search_schema_templates', {query: args.query, take: flags.take}, 'norbix ai schema-templates --help',
    )

    if (!this.jsonEnabled()) {
      for (const t of data.templates ?? []) {
        const matched = t.matchedOn?.length ? `  (matched on: ${t.matchedOn.join(', ')})` : ''
        this.log(`${t.id}  ${t.title}${matched}`)
        this.log(`  ${t.summary}`)
        if (t.related?.length) this.log(`  related: ${t.related.join(', ')}`)
        this.log('')
      }
      this.log(`${data.templates?.length ?? 0} of ${data.total ?? 0}. Read the full shape: norbix ai schema-template <id>[,<id>]`)
    }

    return data
  }
}
