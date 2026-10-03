import {BaseCommand} from '../../../base.js'
import {snippetBody, snippetFlags} from '../../../lib/email.js'

export default class EmailSignatureSave extends BaseCommand {
  static description = `Create or update an email signature

One language: --content (HTML, Razor allowed) or --content-file. Several
languages: --translations with a JSON array of {language, content}. Pass --id
to update; the whole signature is sent, so include every language you want to keep.`

  static examples = [
    '<%= config.bin %> email signature save --name Default --content-file signature.html',
    '<%= config.bin %> email signature save --id 66b2f0a1c3d4e5f6a7b8c9d0 --name Default --translations @signature.json',
    '<%= config.bin %> email signature save --name Default --content-file signature.html --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    ...snippetFlags('Signature'),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(EmailSignatureSave)
    const client = this.client(flags)

    const res = await client.hub.notifications.saveEmailSignature(
      (await snippetBody(flags)) as unknown as Parameters<typeof client.hub.notifications.saveEmailSignature>[0],
    )

    this.print(res)
    return res
  }
}
