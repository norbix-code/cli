import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class EmailSystemTemplates extends BaseCommand {
  static description = `List the ready-made (system) email templates

Pick one as a starting point, then copy its translations into
\`email template create --translations\`.`

  static examples = [
    '<%= config.bin %> email system-templates',
    '<%= config.bin %> email system-templates --tag onboarding --channel Transactional',
  ]

  static flags = {
    tag: Flags.string({description: 'Group tag, e.g. newsletter or onboarding (repeat for several)', multiple: true}),
    theme: Flags.string({description: 'Visual theme (repeat for several)', multiple: true}),
    channel: Flags.string({description: 'Communication channel', options: ['Transactional', 'Marketing', 'System']}),
    trigger: Flags.string({description: 'Only templates made for this trigger type', options: ['Membership', 'Schema', 'Files', 'Payments']}),
    'page-size': Flags.integer({description: 'Records per page'}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(EmailSystemTemplates)
    const client = this.client(flags)

    const res = await client.hub.notifications.getSystemEmailTemplates({
      groupTags: flags.tag,
      themes: flags.theme,
      communicationChannel: flags.channel,
      forTrigger: flags.trigger,
      pageSize: flags['page-size'],
      startingAfter: flags.after,
    } as unknown as Parameters<typeof client.hub.notifications.getSystemEmailTemplates>[0])

    this.print(res)
    return res
  }
}
