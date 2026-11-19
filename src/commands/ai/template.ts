import {Args, Flags} from '@oclif/core'

import {parseJsonText, TemplateDoorCommand, type AppTemplate} from '../../lib/template-doors.js'

export default class AiTemplate extends TemplateDoorCommand {
  static description = `Read one app template: its guide and its collection specs

The guide (Markdown) names the modules, collections, roles and automations of
the app and the order to build them in. The collections come from the schema
registry: read them with \`norbix ai schema-template <ids>\`. --specs also prints
the specs of the collections that are not plain registry entities; --json
prints everything, with each spec as a JSON object.

Reading creates nothing. Decide what to reuse, then build.`

  static examples = [
    '<%= config.bin %> ai template hr',
    '<%= config.bin %> ai template hr --specs',
    '<%= config.bin %> ai template hr --json',
  ]

  static args = {
    id: Args.string({required: true, description: 'Template id (norbix ai templates)'}),
  }

  static flags = {
    specs: Flags.boolean({description: 'Also print the collection specs after the guide', default: false}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiTemplate)
    const data = await this.door<AppTemplate>(flags, 'get_app_template', {id: args.id}, 'norbix ai template --help')
    const specs = (data.collectionSpecs ?? []).map((s) => ({fileName: s.fileName, spec: parseJsonText(s.json)}))

    if (!this.jsonEnabled()) {
      this.log((data.guide ?? '').trimEnd())
      this.log('')
      if (flags.specs) {
        for (const s of specs) {
          this.log(`--- ${s.fileName}`)
          this.log(JSON.stringify(s.spec, null, 2))
        }
      } else if (specs.length > 0) {
        this.log(`Collection specs: ${specs.map((s) => s.fileName).join(', ')}  (print them with --specs)`)
      }
    }

    return {template: data.template, guide: data.guide, collectionSpecs: specs}
  }
}
