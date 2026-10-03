import {BaseCommand} from '../../base.js'

export default class EmailDisable extends BaseCommand {
  static description = `Turn off the email module for the project

Run \`email disable-dependencies\` first to see what still depends on email.`

  static examples = [
    '<%= config.bin %> email disable --yes',
    '<%= config.bin %> email disable --dry-run',
  ]

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(EmailDisable)
    const client = this.client(flags)

    await this.confirmOrFail('Turn off email for this project?', flags)

    const res = await client.hub.notifications.disableEmail({})

    this.print('Email disabled.')
    return res
  }
}
