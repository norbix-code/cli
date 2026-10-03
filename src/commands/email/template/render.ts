import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {parseTokens, textOrFile} from '../../../lib/email.js'

export default class EmailTemplateRender extends BaseCommand {
  static description = `Render MJML (with Razor tokens) to HTML

Use it to check a template body before you save it. When the code needs a
token you did not pass, the answer lists the missing ones.`

  static examples = [
    '<%= config.bin %> email template render --file welcome.mjml --token Name=Ada',
    '<%= config.bin %> email template render --code "<mjml><mj-body><mj-text>Hi @Model.Name</mj-text></mj-body></mjml>" --preview',
  ]

  static flags = {
    code: Flags.string({description: 'MJML / Razor source', exclusive: ['file']}),
    file: Flags.string({description: 'Read the source from this file'}),
    token: Flags.string({description: 'Token value as key=value (repeat for several)', multiple: true}),
    preview: Flags.boolean({description: 'Render for a preview (less strict)', default: false}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(EmailTemplateRender)
    const code = textOrFile(flags.code, flags.file)
    if (!code) this.error('Pass the source with --code or --file.')
    const client = this.client(flags)

    const res = await client.hub.notifications.getMjml({
      code,
      tokens: parseTokens(flags.token),
      isForPreview: flags.preview,
    } as unknown as Parameters<typeof client.hub.notifications.getMjml>[0])

    this.print(res)
    return res
  }
}
