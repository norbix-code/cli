import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

/** The task types the gateway knows (`SchedulerTaskType`); only EmailCampaign can be saved today. */
const TASK_TYPES = ['EmailCampaign', 'PushCampaign', 'SmsCampaign', 'CodeFunctionalCall', 'WebhookCall']

export default class SchedulerList extends BaseCommand {
  static description = 'List scheduler tasks'

  static examples = [
    '<%= config.bin %> scheduler list',
    '<%= config.bin %> scheduler list --type EmailCampaign --enabled',
    '<%= config.bin %> scheduler list --no-enabled --page-size 50',
  ]

  static flags = {
    type: Flags.string({description: 'Only tasks of this type', options: TASK_TYPES}),
    enabled: Flags.boolean({
      description: 'Only enabled tasks (--no-enabled: only disabled ones); leave out for both',
      allowNo: true,
    }),
    'page-size': Flags.integer({description: 'Records per page'}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(SchedulerList)
    const client = this.client(flags)

    // `type` is the generated string enum; the option list above holds its values.
    const res = await client.hub.scheduler.getSchedulerTasks({
      type: flags.type,
      enabled: flags.enabled,
      pageSize: flags['page-size'],
      startingAfter: flags.after,
    } as Parameters<typeof client.hub.scheduler.getSchedulerTasks>[0])

    this.print(res)
    return res
  }
}
