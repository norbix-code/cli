import {Args, Flags} from '@oclif/core'

import {AiToolsCommand} from '../../../lib/ai-tools.js'
import {usageError} from '../../../lib/cli-error.js'

export default class AiToolCall extends AiToolsCommand {
  static description = `Call one AI tool by name, as an MCP client would

The tool runs under your identity and answers with its envelope ({ok, data} or
{ok: false, errors}). The project that is set is sent as for any project
command (the env rule applies; --account-level sends none). The env comes from
an "env" argument, then the --env header; a PROD write needs "env":"PROD" in
--args. Tools can change data, so the command asks first (--yes skips it).`

  static examples = [
    '<%= config.bin %> ai tool call get_schemas --args \'{"take":5}\' --yes',
    '<%= config.bin %> ai tool call get_schemas --dry-run',
  ]

  static args = {
    name: Args.string({required: true, description: 'Tool name (ai tools)'}),
  }

  static flags = {
    args: Flags.string({description: 'The arguments as a JSON object', default: '{}'}),
    ...AiToolsCommand.accountFlag,
    ...AiToolsCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(AiToolCall)
    let parsed: unknown
    try {
      parsed = JSON.parse(flags.args)
    } catch {
      throw usageError('--args is not JSON.', 'Pass a JSON object, e.g. --args \'{"take":5}\'.', 'norbix ai tool call --help')
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw usageError('--args is not a JSON object.', 'Pass a JSON object, e.g. --args \'{"take":5}\'.', 'norbix ai tool call --help')
    }

    const {client} = this.scopedClient(flags)
    await this.confirmOrFail(`Call AI tool ${args.name}?`, flags)

    const res = await client.hub.account.invokeAiTool({toolName: args.name, argumentsJson: JSON.stringify(parsed)})

    this.print(res)
    return res
  }
}
