import {BaseCommand} from '../../../base.js'
import {templateBody, templateFlags} from '../../../lib/push.js'

export default class PushTemplateCreate extends BaseCommand {
  static description = `Create a push template

One language: --title and --body. Several languages: --translations with a
JSON array of {language, content: {title, body}}.`

  static examples = [
    '<%= config.bin %> push template create --name Welcome --title "Hi @Model.Name" --body "Thanks for joining"',
    '<%= config.bin %> push template create --name Welcome --translations @welcome.json',
  ]

  static flags = templateFlags

  async run(): Promise<unknown> {
    const {flags} = await this.parse(PushTemplateCreate)
    const client = this.client(flags)

    const res = await client.hub.notifications.createPushTemplate(
      (await templateBody(flags)) as unknown as Parameters<typeof client.hub.notifications.createPushTemplate>[0],
    )

    this.print(res)
    return res
  }
}
