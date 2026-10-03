import {Args} from '@oclif/core'

import {ProjectCommand} from '../../../lib/project.js'

export default class ProjectLegalShow extends ProjectCommand {
  static description = `Show one legal document the way the public reads it

Calls the public route on the API host, so it shows what visitors get:
\`available: false\` until the document is saved and exposed
(\`project legal expose\`).`

  static examples = ['<%= config.bin %> project legal show terms', '<%= config.bin %> project legal show privacy --json']

  static args = {
    kind: Args.string({required: true, description: 'Which document', options: ['terms', 'privacy']}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(ProjectLegalShow)
    const {client, projectId} = this.projectClient(flags)

    const res = await client.api.public.getPublicProjectLegal({projectId, kind: args.kind})

    this.print(res)
    return res
  }
}
