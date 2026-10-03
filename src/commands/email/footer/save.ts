import {BaseCommand} from '../../../base.js'
import {snippetBody, snippetFlags} from '../../../lib/email.js'

export default class EmailFooterSave extends BaseCommand {
  static description = `Create or update an email footer

One language: --content (HTML, Razor allowed) or --content-file. Several
languages: --translations with a JSON array of {language, content}. Pass --id
to update; the whole footer is sent, so include every language you want to keep.`

  static examples = [
    '<%= config.bin %> email footer save --name Default --content-file footer.html',
    '<%= config.bin %> email footer save --id 66b2f0a1... --name Default --translations @footer.json',
  ]

  static flags = snippetFlags('Footer')

  async run(): Promise<unknown> {
    const {flags} = await this.parse(EmailFooterSave)
    const client = this.client(flags)

    const res = await client.hub.notifications.saveEmailFooter(
      (await snippetBody(flags)) as unknown as Parameters<typeof client.hub.notifications.saveEmailFooter>[0],
    )

    this.print(res)
    return res
  }
}
