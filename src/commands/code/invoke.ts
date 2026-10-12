import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {readPayload} from '../../lib/code.js'

export default class CodeInvoke extends BaseCommand {
  static description = `Call a cloud function by hand

Sends the function a \`manual.invoke\` envelope with your payload in \`data.payload\`; \`context.runAs\` is you unless --run-as names a service user. Sync (the default) waits for the result and prints the status code, the duration in ms, the function's output and the provider's request id; --async only reports that the call was accepted. Needs \`code:execute\` on the integration.`

  static examples = [
    `<%= config.bin %> code invoke --integration int_6rBACnEaxQ0x1jTiHtAuWV --function orders-on-update --qualifier prod --payload '{"orderId":"6ac54a59212c29912eaddd81","dryRun":true}'`,
    '<%= config.bin %> code invoke --integration int_6rBACnEaxQ0x1jTiHtAuWV --function orders-nightly-payouts --payload-file payload.json --async',
    '<%= config.bin %> code invoke --integration int_6rBACnEaxQ0x1jTiHtAuWV --function orders-on-update --run-as usr_2R5So1Lbfc7MNr5lkY522S --json',
    `<%= config.bin %> code invoke --integration int_6rBACnEaxQ0x1jTiHtAuWV --function orders-on-update --payload '{"orderId":"6ac54a59212c29912eaddd81"}' --dry-run`,
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    integration: Flags.string({required: true, description: 'Code integration ID (int_…)'}),
    function: Flags.string({required: true, description: 'Function id, as `code functions` lists it'}),
    qualifier: Flags.string({description: 'Alias or version to call (see `code qualifiers`); default: the unqualified function'}),
    payload: Flags.string({description: `JSON object sent as data.payload (inline, @file or - for stdin)`}),
    'payload-file': Flags.string({description: 'Read the payload from this JSON file'}),
    async: Flags.boolean({description: 'Fire and forget: do not wait for the result', default: false}),
    'run-as': Flags.string({description: 'Service user (usr_…) the function acts as; default: you'}),
    config: Flags.string({description: 'JSON object passed to the function as the envelope config (inline, @file or -)'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(CodeInvoke)
    const payload = await readPayload(flags)
    const client = this.client(flags)

    const res = await client.hub.code.invokeCodeFunction({
      functionRef: {integrationId: flags.integration, functionId: flags.function, qualifier: flags.qualifier},
      payload,
      invocationType: flags.async ? 'Async' : 'Sync',
      runAsUserId: flags['run-as'],
      config: flags.config,
    } as Parameters<typeof client.hub.code.invokeCodeFunction>[0])

    this.print(res)
    return res
  }
}
