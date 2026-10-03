import {Flags} from '@oclif/core'

import {readJsonObject} from '../../lib/push.js'
import {ProjectCommand} from '../../lib/project.js'

export default class ProjectSetLogo extends ProjectCommand {
  static description = `Set or clear the project logo

--file-resource is the stored file to use, as the files module describes it:
{resource: {id, originalFileName, extension, storedFileName}, integrationId,
provider, path, isPublic, publicUrl} — inline JSON, @file.json or - for stdin.
Upload the image first with \`files upload\`, then point at it here.`

  static examples = [
    '<%= config.bin %> project set-logo --file-resource @logo-ref.json',
    '<%= config.bin %> project set-logo --clear',
  ]

  static flags = {
    'file-resource': Flags.string({description: 'The stored file as a JSON object, @file or -', exclusive: ['clear']}),
    clear: Flags.boolean({description: 'Remove the logo', default: false}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ProjectSetLogo)
    if (!flags['file-resource'] && !flags.clear) this.error('Pass --file-resource, or --clear to remove the logo.')
    const fileResource = flags['file-resource'] ? await readJsonObject(flags['file-resource'], 'file-resource') : undefined
    const {client, projectId} = this.projectClient(flags)

    const res = await client.hub.account.updateProjectLogo({projectId, fileResource} as Parameters<
      typeof client.hub.account.updateProjectLogo
    >[0])

    this.print(flags.clear ? 'Logo removed.' : 'Logo saved.')
    return res
  }
}
