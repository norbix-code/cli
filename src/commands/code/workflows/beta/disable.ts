import {BaseCommand} from '../../../../base.js'

export default class CodeWorkflowsBetaDisable extends BaseCommand {
  static description = `Beta: turn the Workflows beta off for this environment

Every workflow route except \`schema\` refuses (CM-ERRORS-WORKFLOWS-001) and triggers and scheduler tasks skip their workflows. Runs in flight continue and a waiting run may still be resumed. Nothing is deleted.`

  static examples = [
    '<%= config.bin %> code workflows beta disable --yes',
    '<%= config.bin %> code workflows beta disable --dry-run',
  ]

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(CodeWorkflowsBetaDisable)
    const client = this.client(flags)
    await this.confirmOrFail('Turn off the Workflows beta (new runs stop starting)?', flags)

    const res = await client.hub.code.disableCodeWorkflows()

    this.print('Workflows beta disabled.')
    return res
  }
}
