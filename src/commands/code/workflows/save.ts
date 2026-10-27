import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {formatWorkflow, readDefinition} from '../../../lib/workflows.js'

export default class CodeWorkflowsSave extends BaseCommand {
  static description = `Beta: save a workflow definition as the draft

The file is the definition (YAML or JSON: by the .yaml / .yml / .json extension, by content for \`-\` stdin). Without workflowId a new workflow is created; with it, that workflow's draft is updated. Read-only fields (version, isEnabled) are ignored. Publish the draft with \`code workflows publish <id>\`; check it first with \`code workflows validate\`. Needs the Scheduler module enabled.`

  static examples = [
    '<%= config.bin %> code workflows save --file flow.yaml',
    'cat flow.json | <%= config.bin %> code workflows save --file -',
    '<%= config.bin %> code workflows save --file flow.yaml --env TEST --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    file: Flags.string({char: 'f', required: true, description: 'The definition: a .yaml / .yml / .json file, or - for stdin'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(CodeWorkflowsSave)
    const definition = await readDefinition(flags.file)
    const client = this.client(flags)

    const res = await client.hub.code.saveCodeWorkflow({definition} as unknown as Parameters<typeof client.hub.code.saveCodeWorkflow>[0])

    this.print(formatWorkflow('saved (draft)', res))
    return res
  }
}
