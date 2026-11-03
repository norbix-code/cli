import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class LogsIntegrations extends BaseCommand {
  static description = `List the logs integrations set up for this project: where copies of the project's log entries go (Datadog, AWS CloudWatch, Azure Monitor, MongoDB, …). Nothing is delivered to an integration until its last test passed`

  static examples = ['<%= config.bin %> logs integrations', '<%= config.bin %> logs integrations --page-size 50']

  static flags = {
    'page-size': Flags.integer({description: 'Records per page'}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(LogsIntegrations)
    const client = this.client(flags)

    const res = await client.hub.logs.getLoggingIntegrations({
      pageSize: flags['page-size'],
      startingAfter: flags.after,
    })

    this.print(res)
    return res
  }
}
