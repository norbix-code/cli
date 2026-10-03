import {BaseCommand} from '../../../base.js'
import {emailTemplateBody, emailTemplateFlags} from '../../../lib/email.js'

export default class EmailTemplateCreate extends BaseCommand {
  static description = `Create an email template

One language: --subject and --body (or --body-file, e.g. a .mjml file). The
body is MJML with Razor tokens (@Model.Name) unless you pick another --engine.
Several languages: --translations with a JSON array of
{language, content: {subject, body: {code, templateEngine}}}.

Check the code first with \`email template render\`.`

  static examples = [
    '<%= config.bin %> email template create --name Welcome --subject "Hi @Model.Name" --body-file welcome.mjml',
    '<%= config.bin %> email template create --name Welcome --translations @welcome.json',
  ]

  static flags = emailTemplateFlags

  async run(): Promise<unknown> {
    const {flags} = await this.parse(EmailTemplateCreate)
    const client = this.client(flags)

    const res = await client.hub.notifications.createEmailTemplate(
      (await emailTemplateBody(flags)) as unknown as Parameters<typeof client.hub.notifications.createEmailTemplate>[0],
    )

    this.print(res)
    return res
  }
}
