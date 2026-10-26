import {NotificationsCommand, notificationsArgs, notificationsFlags} from '../../lib/notification-commands.js'

export default class EmailNotifications extends NotificationsCommand {
  static description = NotificationsCommand.describe('email')

  static examples = [
    '<%= config.bin %> email notifications 66b2f0a1c3d4e5f6a7b8c9d0',
    '<%= config.bin %> email notifications 66b2f0a1c3d4e5f6a7b8c9d0 --state failed --json',
  ]

  static args = notificationsArgs
  static flags = notificationsFlags
  protected readonly channel = 'email' as const

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(EmailNotifications)
    return this.list(args, flags)
  }
}
