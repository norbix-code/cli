import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {smsTemplateBody, smsTemplateFlags} from '../../../lib/sms.js'

export default class SmsTemplateUpdate extends BaseCommand {
  static description = `Replace an SMS template's name, channel, tags and content

The whole template is sent, so pass every language you want to keep.`

  static examples = [
    '<%= config.bin %> sms template update 66b2f0a1... --name Welcome --body "Hi @Model.Name"',
  ]

  static args = {
    id: Args.string({required: true, description: 'Template ID'}),
  }

  static flags = smsTemplateFlags

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(SmsTemplateUpdate)
    const client = this.client(flags)

    const res = await client.hub.notifications.updateSmsTemplate({
      ...(await smsTemplateBody(flags)),
      viewId: args.id,
    } as unknown as Parameters<typeof client.hub.notifications.updateSmsTemplate>[0])

    this.print(`Template ${args.id} updated.`)
    return res
  }
}
