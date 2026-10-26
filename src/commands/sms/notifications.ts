import {NotificationsCommand, notificationsArgs, notificationsFlags} from '../../lib/notification-commands.js'

export default class SmsNotifications extends NotificationsCommand {
  static description = NotificationsCommand.describe('sms')

  static examples = [
    '<%= config.bin %> sms notifications 66b2f0a1c3d4e5f6a7b8c9d0',
    '<%= config.bin %> sms notifications 66b2f0a1c3d4e5f6a7b8c9d0 --state failed --json',
  ]

  static args = notificationsArgs
  static flags = notificationsFlags
  protected readonly channel = 'sms' as const

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(SmsNotifications)
    return this.list(args, flags)
  }
}
