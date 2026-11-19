import {Args} from '@oclif/core'

import {TemplateDoorCommand, type AppTemplateCard} from '../../lib/template-doors.js'

export default class AiTemplates extends TemplateDoorCommand {
  static description = `List the app templates: worked examples of a whole Norbix backend

Blog, CRM, HR …: each with an id, tags, the registry collections it uses and a
summary. Read them BEFORE you design a new app. With a few words about the app
("hr portal"), the templates whose tags match come first; every template is
listed either way. Then read one with \`norbix ai template <id>\`.

A template is reading material: nothing is created, and you decide what to reuse.`

  static examples = [
    '<%= config.bin %> ai templates',
    '<%= config.bin %> ai templates "hr portal"',
    '<%= config.bin %> ai templates --json',
  ]

  static args = {
    query: Args.string({description: 'A few words about the app being built'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiTemplates)
    const data = await this.door<{templates: AppTemplateCard[]}>(flags, 'get_app_templates', {query: args.query}, 'norbix ai templates --help')

    if (!this.jsonEnabled()) {
      for (const t of data.templates ?? []) {
        const matched = t.matchedTags?.length ? `  (matches: ${t.matchedTags.join(', ')})` : ''
        this.log(`${t.id}  ${t.name}, version ${t.version}${matched}`)
        this.log(`  ${t.summary}`)
        this.log(`  collections: ${(t.collections ?? []).map((c) => c.entity).join(', ')}`)
        this.log('')
      }
      this.log('Read one: norbix ai template <id>')
    }

    return data
  }
}
