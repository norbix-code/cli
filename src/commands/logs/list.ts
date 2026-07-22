import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class LogsList extends BaseCommand {
  static description = 'Read project logs, newest first'

  static examples = [
    '<%= config.bin %> logs list',
    '<%= config.bin %> logs list --level Error --module Database',
    '<%= config.bin %> logs list --search "timeout" --page-size 100 --json',
  ]

  static flags = {
    level: Flags.string({description: 'Severity: Information, Warning or Error'}),
    module: Flags.string({description: 'Module: Database, Email, Membership, ...'}),
    search: Flags.string({description: 'Free-text search over title and message'}),
    'event-code': Flags.string({description: 'Exact event code (e.g. db:record:insert)'}),
    correlation: Flags.string({description: 'Correlation ID filter'}),
    from: Flags.string({description: 'From timestamp (UTC, ISO 8601)'}),
    to: Flags.string({description: 'To timestamp (UTC, ISO 8601)'}),
    'page-size': Flags.integer({description: 'Records per page', default: 50}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(LogsList)
    const client = this.client(flags)

    const res = await client.hub.logs.getLogs({
      level: flags.level,
      module: flags.module,
      search: flags.search,
      eventCode: flags['event-code'],
      logCorrelationId: flags.correlation,
      fromUtc: flags.from,
      toUtc: flags.to,
      pageSize: flags['page-size'],
      startingAfter: flags.after,
    })

    this.print(res)
    return res
  }
}
