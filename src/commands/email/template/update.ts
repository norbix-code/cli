import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {emailTemplateBody, emailTemplateFlags} from '../../../lib/email.js'

export default class EmailTemplateUpdate extends BaseCommand {
  static description = `Replace an email template's name, channel, tags and content

The whole template is sent, so pass every language you want to keep.`

  static examples = [
    '<%= config.bin %> email template update 66b2f0a1... --name Welcome --subject "Hi @Model.Name" --body-file welcome.mjml',
  ]

  static args = {
    id: Args.string({required: true, description: 'Template ID'}),
  }

  static flags = emailTemplateFlags

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailTemplateUpdate)
    const client = this.client(flags)

    const res = await client.hub.notifications.updateEmailTemplate({
      ...(await emailTemplateBody(flags)),
      viewId: args.id,
    } as unknown as Parameters<typeof client.hub.notifications.updateEmailTemplate>[0])

    this.print(`Template ${args.id} updated.`)
    return res
  }
}
