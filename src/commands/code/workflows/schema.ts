import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {FORMATS, formatAs} from '../../../lib/workflows.js'

export default class CodeWorkflowsSchema extends BaseCommand {
  static description = `Beta: the workflow definition format — JSON Schema, step kinds, bindings

The JSON Schema of a definition, every step kind with its config schema, output schema (when known) and the permissions it needs, and the binding families usable in expressions. Works with the beta switch off. --format yaml prints the same document as YAML.`

  static examples = [
    '<%= config.bin %> code workflows schema',
    '<%= config.bin %> code workflows schema --format yaml > workflow-schema.yaml',
  ]

  static flags = {
    format: Flags.string({description: 'json or yaml', options: FORMATS, default: 'json'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(CodeWorkflowsSchema)
    const client = this.client(flags)

    const res = await client.hub.code.getCodeWorkflowSchema()

    this.print(formatAs(flags.format, res, res.schema))
    return res
  }
}
