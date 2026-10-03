import {Flags} from '@oclif/core'

import {ProjectCommand, projectOf, readTextFile} from '../../../lib/project.js'

export default class ProjectLegalSet extends ProjectCommand {
  static description = `Save the project's Terms & Conditions and Privacy Policy (Markdown)

The server stores both documents in one call and clears a document it does not
get, so a document you leave out is read from the project and sent back
unchanged. --clear-terms / --clear-privacy remove one on purpose. Show them to
the public with \`project legal expose\`.`

  static examples = [
    '<%= config.bin %> project legal set --terms-file terms.md --privacy-file privacy.md',
    '<%= config.bin %> project legal set --terms-file terms.md',
    '<%= config.bin %> project legal set --clear-privacy',
  ]

  static flags = {
    'terms-file': Flags.string({description: 'Terms & Conditions, a Markdown file', exclusive: ['clear-terms']}),
    'privacy-file': Flags.string({description: 'Privacy Policy, a Markdown file', exclusive: ['clear-privacy']}),
    'clear-terms': Flags.boolean({description: 'Remove the Terms & Conditions', default: false}),
    'clear-privacy': Flags.boolean({description: 'Remove the Privacy Policy', default: false}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ProjectLegalSet)
    const terms = flags['clear-terms'] ? '' : flags['terms-file'] ? readTextFile(flags['terms-file']) : undefined
    const privacy = flags['clear-privacy'] ? '' : flags['privacy-file'] ? readTextFile(flags['privacy-file']) : undefined
    if (terms === undefined && privacy === undefined) {
      this.error('Pass --terms-file, --privacy-file, --clear-terms or --clear-privacy.')
    }

    const {client, projectId} = this.projectClient(flags)

    let termsMarkdown = terms
    let privacyMarkdown = privacy
    if (termsMarkdown === undefined || privacyMarkdown === undefined) {
      const current = projectOf(await client.hub.account.getProject({projectId}))
      termsMarkdown ??= current.legalTermsMarkdown as string | undefined
      privacyMarkdown ??= current.legalPrivacyMarkdown as string | undefined
    }

    const res = await client.hub.account.updateProjectLegalDocuments({projectId, termsMarkdown, privacyMarkdown})

    this.print('Legal documents saved.')
    return res
  }
}
