import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class FilesIntegrations extends BaseCommand {
  static description = `List the files integrations set up for this project: the storage places this project keeps files in (an S3 bucket, an Azure container, a Google Cloud Storage bucket, …)`

  static examples = ['<%= config.bin %> files integrations', '<%= config.bin %> files integrations --page-size 50']

  static flags = {
    'page-size': Flags.integer({description: 'Records per page'}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(FilesIntegrations)
    const client = this.client(flags)

    const res = await client.hub.files.getFilesIntegrations({
      pageSize: flags['page-size'],
      startingAfter: flags.after,
    })

    this.print(res)
    return res
  }
}
