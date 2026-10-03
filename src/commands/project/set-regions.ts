import {Flags} from '@oclif/core'

import {ProjectCommand, projectOf} from '../../lib/project.js'

export default class ProjectSetRegions extends ProjectCommand {
  static description = `Set the project regions

The primary region can be set once and never changed afterwards — leave
--primary out to keep it. --additional is the full new list of extra regions
(repeat the flag); --clear-additional removes them all. With neither, the
current additional regions are read and sent back unchanged. See the region codes
with \`account regions\`.`

  static examples = [
    '<%= config.bin %> project set-regions --additional nb-us-east --additional nb-ap-singapore',
    '<%= config.bin %> project set-regions --primary nb-eu-germany',
    '<%= config.bin %> project set-regions --clear-additional',
  ]

  static flags = {
    primary: Flags.string({description: 'Primary region code (only when it is not set yet)'}),
    additional: Flags.string({description: 'Additional region code (repeat for several)', multiple: true, exclusive: ['clear-additional']}),
    'clear-additional': Flags.boolean({description: 'Remove every additional region', default: false}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ProjectSetRegions)
    if (!flags.primary && !flags.additional && !flags['clear-additional']) {
      this.error('Pass --primary, --additional or --clear-additional.')
    }

    const {client, projectId} = this.projectClient(flags)

    let additionalRegions = flags['clear-additional'] ? [] : flags.additional
    if (!additionalRegions) {
      // The list is a full replacement: keep the current one.
      const current = projectOf(await client.hub.account.getProject({projectId}))
      additionalRegions = ((current.additionalRegions as Array<{id: string}> | undefined) ?? []).map((r) => r.id)
    }

    const res = await client.hub.account.updateProjectRegions({
      projectId,
      primaryRegion: flags.primary,
      additionalRegions,
    })

    this.print('Regions saved.')
    return res
  }
}
