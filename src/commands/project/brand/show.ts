import {writeFileSync} from 'node:fs'

import {Args, Flags} from '@oclif/core'

import {ProjectCommand} from '../../../lib/project.js'

export default class ProjectBrandShow extends ProjectCommand {
  static description = `Download the project logo or icon the way the public gets it

Calls the public route on the API host (no sign-in), the address the public
project config hands out as branding.logoUrl / iconUrl. It answers only while
the brand is public (\`project brand expose\`) and a logo / icon is set;
every other case is the same 404. --output saves the picture; without it the
command prints its size.`

  static examples = [
    '<%= config.bin %> project brand show logo --output logo.png',
    '<%= config.bin %> project brand show icon --json',
  ]

  static args = {
    kind: Args.string({required: true, description: 'Which picture', options: ['logo', 'icon']}),
  }

  static flags = {
    output: Flags.string({char: 'o', description: 'File to save the picture to'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(ProjectBrandShow)
    const {client, projectId} = this.projectClient(flags)

    const bytes = await client.api.public.getPublicProjectBrandAsset({projectId, kind: args.kind})
    const size = bytes?.byteLength ?? 0
    if (flags.output) writeFileSync(flags.output, bytes)

    const result = {kind: args.kind, bytes: size, ...(flags.output ? {savedTo: flags.output} : {})}
    if (!this.jsonEnabled()) {
      this.log(flags.output ? `Saved the ${args.kind} (${size} bytes) to ${flags.output}.` : `The ${args.kind} is ${size} bytes. Pass --output <file> to save it.`)
    }

    return result
  }
}
