import {BaseCommand} from '../../../../base.js'

export default class CodeWorkflowsBetaEnable extends BaseCommand {
  static description = `Beta: turn the Workflows beta on for this environment

The module switch (on by default). Every workflow route answers again; triggers and scheduler tasks start workflows again.`

  static examples = [
    '<%= config.bin %> code workflows beta enable',
    '<%= config.bin %> code workflows beta enable --env TEST --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(CodeWorkflowsBetaEnable)
    const client = this.client(flags)

    const res = await client.hub.code.enableCodeWorkflows()

    this.print('Workflows beta enabled.')
    return res
  }
}
