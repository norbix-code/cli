import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class CodeQualifiers extends BaseCommand {
  static description = `List the aliases and versions of a cloud function

A qualifier picks which build of the function a trigger, a task or \`code invoke\` calls: a Lambda alias (prod, staging) or version number, a Google revision. One row each: name, kind (Alias or Version), the version an alias points at.`

  static examples = [
    '<%= config.bin %> code qualifiers --integration int_6rBACnEaxQ0x1jTiHtAuWV --function orders-on-update',
  ]

  static flags = {
    integration: Flags.string({required: true, description: 'Code integration ID (int_…)'}),
    function: Flags.string({required: true, description: 'Function id, as `code functions` lists it (the Lambda name or ARN, the Google function name)'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(CodeQualifiers)
    const client = this.client(flags)

    const res = await client.hub.code.getCodeFunctionQualifiers({
      integrationId: flags.integration,
      functionId: flags.function,
    })

    this.print(res)
    return res
  }
}
