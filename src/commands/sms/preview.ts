import {NorbixError} from '@norbix.ai/ts'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class SmsPreview extends BaseCommand {
  static description = `Render the text behind an SMS preview link

The hash is the opaque value the backend puts in a preview link — you cannot
build it yourself, so copy it out of the link.

The signed link is the key: no login and no project are needed. When you are
logged in, your session is still sent.`

  static examples = [
    '<%= config.bin %> sms preview 8f2a91c4...',
    '<%= config.bin %> sms preview --hash 8f2a91c4... --region nb-eu-germany',
  ]

  static args = {
    hash: Args.string({required: false, description: 'Preview hash from the preview link'}),
  }

  static flags = {
    hash: Flags.string({description: 'Preview hash from the preview link (same as the argument)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(SmsPreview)
    const hash = flags.hash ?? args.hash
    if (!hash) {
      this.error('Pass the preview hash: `norbix sms preview <hash>` or `--hash <hash>`.')
    }

    // The signed link opens without sign-in, so neither a login nor a project
    // is forced here. A login, when there is one, is still used.
    const client = this.client(flags, {requireAuth: false, requireProject: false})

    const res = await client.hub.notifications.previewSmsNotification({hash})

    this.print(res)
    return res
  }

  protected async catch(error: Error & {exitCode?: number}): Promise<unknown> {
    // A 401 here means the link is bad or expired, not that a session ran out.
    if (error instanceof NorbixError && (error as {status?: number}).status === 401) {
      const {code} = error as {code?: string}
      return this.error(
        `${code ? `${code}: ` : ''}${error.message}\nThe preview link is invalid or has expired. Ask for a new link.`,
      )
    }

    return super.catch(error)
  }
}
