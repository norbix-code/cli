import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {EXIT} from '../../../lib/exit-codes.js'
import {formatValidation, readDefinition} from '../../../lib/workflows.js'

export default class CodeWorkflowsValidate extends BaseCommand {
  static description = `Beta: check a workflow definition without saving it

Runs every save check and writes nothing. Prints whether it is valid, then each error and warning: code, step, message, path and line / column. Warnings never make it invalid. Exits 6 when it is not valid (also with --json, which prints the answer).`

  static examples = [
    '<%= config.bin %> code workflows validate --file flow.yaml',
    '<%= config.bin %> code workflows validate --file flow.json --json',
  ]

  static flags = {
    file: Flags.string({char: 'f', required: true, description: 'The definition: a .yaml / .yml / .json file, or - for stdin'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(CodeWorkflowsValidate)
    const definition = await readDefinition(flags.file)
    const client = this.client(flags)

    const res = await client.hub.code.validateCodeWorkflow({definition} as unknown as Parameters<typeof client.hub.code.validateCodeWorkflow>[0])

    if (res.isValid) {
      this.print(formatValidation(res))
      return res
    }

    // Not valid: the report (or the JSON answer) is the output, the exit code says so (6).
    if (this.jsonEnabled()) this.logJson(res)
    else this.log(formatValidation(res))
    this.exit(EXIT.VALIDATION)
  }
}
