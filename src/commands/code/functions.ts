import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class CodeFunctions extends BaseCommand {
  static description = `List the cloud functions a code integration may call

Read live from the provider (AWS Lambda, Google Cloud Functions) with the integration's credentials — nothing is stored in Norbix. Azure Functions integrations have no list: name the function in \`code invoke\`. One row per function: id, display name, runtime, region, last modified, tags.`

  static examples = [
    '<%= config.bin %> code functions --integration int_6rBACnEaxQ0x1jTiHtAuWV',
    '<%= config.bin %> code functions --integration int_6rBACnEaxQ0x1jTiHtAuWV --prefix orders- --tag norbix=bookshop',
    '<%= config.bin %> code functions --integration int_6rBACnEaxQ0x1jTiHtAuWV --json | jq -r \'.list.items[].functionId\'',
  ]

  static flags = {
    integration: Flags.string({required: true, description: 'Code integration ID (int_…); list them with `norbix integrations code`'}),
    prefix: Flags.string({description: 'Only functions whose id starts with this'}),
    tag: Flags.string({description: 'Only functions carrying this tag: "key" or "key=value"'}),
    'page-size': Flags.integer({description: 'Records per page'}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(CodeFunctions)
    const client = this.client(flags)

    const res = await client.hub.code.getCodeFunctions({
      integrationId: flags.integration,
      prefix: flags.prefix,
      tag: flags.tag,
      pageSize: flags['page-size'],
      startingAfter: flags.after,
    })

    this.print(res)
    return res
  }
}
