import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class CodeIntegrations extends BaseCommand {
  static description = `List the code integrations set up for this project: the cloud-function accounts a trigger, a task or \`norbix code invoke\` may call (AWS Lambda, Azure Functions, Google Cloud Functions, …)`

  static examples = ['<%= config.bin %> code integrations', '<%= config.bin %> code integrations --page-size 50']

  static flags = {
    'page-size': Flags.integer({description: 'Records per page'}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(CodeIntegrations)
    const client = this.client(flags)

    const res = await client.hub.code.getCodeIntegrations({
      pageSize: flags['page-size'],
      startingAfter: flags.after,
    })

    this.print(res)
    return res
  }
}
