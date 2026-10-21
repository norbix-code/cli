import {BaseCommand} from '../../base.js'

export default class LogsClean extends BaseCommand {
  static description = `Delete every log entry stored in the project's Norbix Logging

Asks first; --yes skips the question (needed in scripts and CI). Lines already
sent to other logging integrations (Datadog, CloudWatch, …) stay there.`

  static examples = ['<%= config.bin %> logs clean', '<%= config.bin %> logs clean --yes', '<%= config.bin %> logs clean --dry-run']

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(LogsClean)
    const client = this.client(flags)

    await this.confirmOrFail("Delete every log entry stored in the project's Norbix Logging?", flags)

    const res = await client.hub.logs.cleanLogs({})

    this.print('Logs cleaned.')
    return res
  }
}
