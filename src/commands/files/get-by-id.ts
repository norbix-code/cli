import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {integrationFlag, resolveIntegration} from '../../lib/files.js'

export default class FilesGetById extends BaseCommand {
  static description = `Show one file by its stable id

A file field on a record stores this id, and \`db find --expand\` returns it as
the \`id\` of the expanded reference. The answer carries the file's resource,
path, isPublic and publicUrl. An id no storage of the integration holds is
"not found".`

  static examples = ['<%= config.bin %> files get-by-id nbfl_7hK2abc']

  static args = {
    id: Args.string({required: true, description: 'File id (the value a file field stores)'}),
  }

  static flags = {
    integration: integrationFlag,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(FilesGetById)
    const client = this.client(flags)
    const integration = resolveIntegration(flags.integration, this.resolveContext(flags).filesIntegrationId)
    if (!integration) {
      this.error('No files integration ID. Pass --integration or run `norbix config set filesIntegrationId <id>`.')
    }

    const res = await client.api.files.getFileById({
      filesIntegrationId: integration,
      id: args.id,
    })

    this.print(res)
    return res
  }
}
