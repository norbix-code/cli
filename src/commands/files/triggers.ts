import {BaseCommand} from '../../base.js'

export default class FilesTriggers extends BaseCommand {
  static description = 'List the files triggers'

  static examples = ['<%= config.bin %> files triggers', '<%= config.bin %> files triggers --json']

  async run(): Promise<unknown> {
    const {flags} = await this.parse(FilesTriggers)
    const client = this.client(flags)

    const res = await client.hub.files.getFilesTriggers({})

    this.print(res)
    return res
  }
}
