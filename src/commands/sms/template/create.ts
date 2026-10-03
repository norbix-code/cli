import {BaseCommand} from '../../../base.js'
import {smsTemplateBody, smsTemplateFlags} from '../../../lib/sms.js'

export default class SmsTemplateCreate extends BaseCommand {
  static description = `Create an SMS template

One language: --body (and an optional --subject, the sender id). Several
languages: --translations with a JSON array of {language, content: {subject, body}}.`

  static examples = [
    '<%= config.bin %> sms template create --name Welcome --body "Hi @Model.Name, your code is @Model.Code"',
    '<%= config.bin %> sms template create --name Welcome --translations @welcome.json',
  ]

  static flags = smsTemplateFlags

  async run(): Promise<unknown> {
    const {flags} = await this.parse(SmsTemplateCreate)
    const client = this.client(flags)

    const res = await client.hub.notifications.createSmsTemplate(
      (await smsTemplateBody(flags)) as unknown as Parameters<typeof client.hub.notifications.createSmsTemplate>[0],
    )

    this.print(res)
    return res
  }
}
