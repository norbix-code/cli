import {NorbixError} from '@norbix.ai/ts'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class EmailPreview extends BaseCommand {
  static description = `Show the subject and HTML of one sent e-mail

Two ways in:
  <hash> / --hash        the opaque hash from a preview link — the signed link is
                         the key, so no login and no project are needed
  --notification <id>    a notification of your project (from
                         \`email campaign batch\`) — needs a login with email:read

When you are logged in, your session is sent with a hash too.`

  static examples = [
    '<%= config.bin %> email preview 8f2a91c4...',
    '<%= config.bin %> email preview --hash 8f2a91c4... --region nb-eu-germany',
    '<%= config.bin %> email preview --notification n9d4...',
  ]

  static args = {
    hash: Args.string({required: false, description: 'Preview hash from the preview link'}),
  }

  static flags = {
    hash: Flags.string({description: 'Preview hash from the preview link (same as the argument)'}),
    notification: Flags.string({description: 'Notification ID — signed-in preview of your own project', exclusive: ['hash']}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailPreview)
    const hash = flags.hash ?? args.hash

    if (flags.notification) {
      if (hash) this.error('Pass either a preview hash or --notification, not both.')
      const client = this.client(flags)
      const projectId = this.resolveContext(flags).projectId
      const res = await client.hub.notifications.previewEmailNotification({
        projectId,
        notificationId: flags.notification,
      })
      this.print(res)
      return res
    }

    if (!hash) {
      this.error('Pass the preview hash (`norbix email preview <hash>` or `--hash <hash>`), or `--notification <id>`.')
    }

    // The signed link opens without sign-in, so neither a login nor a project
    // is forced here. A login, when there is one, is still used.
    const client = this.client(flags, {requireAuth: false, requireProject: false})

    const res = await client.hub.notifications.previewEmailNotification({hash})

    this.print(res)
    return res
  }

  protected async catch(error: Error & {exitCode?: number}): Promise<unknown> {
    // With a hash, a 401 means the link is bad or expired, not that a session ran out.
    if (error instanceof NorbixError && (error as {status?: number}).status === 401) {
      const {code} = error as {code?: string}
      return this.error(
        `${code ? `${code}: ` : ''}${error.message}\nThe preview link is invalid or has expired, or you may not read this e-mail.`,
      )
    }

    return super.catch(error)
  }
}
