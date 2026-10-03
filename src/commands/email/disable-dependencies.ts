import {BaseCommand} from '../../base.js'

export default class EmailDisableDependencies extends BaseCommand {
  static description = 'List what still depends on email — check before `email disable`'

  static examples = ['<%= config.bin %> email disable-dependencies']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(EmailDisableDependencies)
    const client = this.client(flags)

    const res = await client.hub.notifications.getEmailDisableDependencies({})

    this.print(res)
    return res
  }
}
