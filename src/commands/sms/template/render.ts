import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {parseTokens} from '../../../lib/sms.js'

export default class SmsTemplateRender extends BaseCommand {
  static description = `Render SMS text with token values

Use it to check a Razor template before you save it. When the template needs a
token you did not pass, the answer lists the missing ones.`

  static examples = ['<%= config.bin %> sms template render --code "Hi @Model.Name" --token Name=Ada']

  static flags = {
    code: Flags.string({required: true, description: 'Razor source of the text'}),
    token: Flags.string({description: 'Token value as key=value (repeat for several)', multiple: true}),
    preview: Flags.boolean({description: 'Render for a preview (less strict)', default: false}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(SmsTemplateRender)
    const client = this.client(flags)

    const res = await client.hub.notifications.renderSms({
      code: flags.code,
      tokens: parseTokens(flags.token),
      isForPreview: flags.preview,
    } as unknown as Parameters<typeof client.hub.notifications.renderSms>[0])

    this.print(res)
    return res
  }
}
