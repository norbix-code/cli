import {BaseCommand} from '../../../../base.js'

export default class CodeWorkflowsBetaDisable extends BaseCommand {
  static description = `Beta: refused — workflows can no longer be switched off

Since 2026-11-17 workflows are part of every project: the gateway answers
CM-ERRORS-WORKFLOWS-045 and changes nothing. The command stays so scripts do
not break. To stop one workflow use \`norbix code workflows disable <id>\`.`

  static state = 'deprecated'

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
    await this.confirmOrFail('Ask the gateway to turn workflows off (it refuses since 2026-11-17)?', flags)

    const res = await client.hub.code.disableCodeWorkflows()

    this.print('Workflows beta disabled.')
    return res
  }
}
