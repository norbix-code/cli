import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {readJsonObject} from '../../../lib/email.js'

export default class EmailTemplateAttach extends BaseCommand {
  static description = `Attach an uploaded file to an email template

Every e-mail sent with the template carries the file. Upload it first
(\`norbix files upload\`) and pass the file reference the upload returned —
{resource, integrationId, provider, path, isPublic} — as --file-ref (inline
JSON, @file.json, or - for stdin). --language attaches it to one translation
only.`

  static examples = [
    '<%= config.bin %> email template attach 66b2f0a1... --file-ref @terms-ref.json',
    '<%= config.bin %> email template attach 66b2f0a1... --file-ref @terms-ref.json --language lt',
  ]

  static args = {
    id: Args.string({required: true, description: 'Template ID'}),
  }

  static flags = {
    'file-ref': Flags.string({required: true, description: 'File reference as a JSON object, @file or -'}),
    language: Flags.string({description: 'Attach to this translation only'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailTemplateAttach)
    const client = this.client(flags)

    const fileRef = await readJsonObject(flags['file-ref'], 'file-ref')
    const res = await client.hub.notifications.attachFileToTemplate({
      templateId: args.id,
      language: flags.language,
      fileRef,
    } as unknown as Parameters<typeof client.hub.notifications.attachFileToTemplate>[0])

    this.print(`File attached to template ${args.id}.`)
    return res
  }
}
