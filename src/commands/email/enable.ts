import {BaseCommand} from '../../base.js'

export default class EmailEnable extends BaseCommand {
  static description = 'Turn on the email module for the project'

  static examples = [
    '<%= config.bin %> email enable',
    '<%= config.bin %> email enable --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(EmailEnable)
    const client = this.client(flags)

    const res = await client.hub.notifications.enableEmail({})

    this.print('Email enabled.')
    return res
  }
}
