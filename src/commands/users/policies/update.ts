import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {readJsonInput} from '../../../lib/json.js'
import {READ_FIRST_DRY_RUN, nothingRead} from '../../../lib/membership.js'

export default class UsersPoliciesUpdate extends BaseCommand {
  static description = `Replace the permissions of a policy

--document is the complete new permission document (JSON, @file.json or -):
permissions you leave out are taken off. The command reads the policy first,
so --name and --description keep their values unless you pass them. The
document must name the policy's pid (see \`norbix users policies create --help\`).

${READ_FIRST_DRY_RUN}`

  static examples = [
    '<%= config.bin %> users policies update pol_3kJ9xJ2mQ0aB --document @orders-read.json',
    '<%= config.bin %> users policies update pol_3kJ9xJ2mQ0aB --name "Orders read" --document @orders-read.json --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Policy ID'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    document: Flags.string({required: true, description: 'The complete new permission document: JSON, @file.json or -'}),
    name: Flags.string({description: 'New policy name'}),
    description: Flags.string({description: 'New description'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersPoliciesUpdate)
    const policyDocumentJson = await readJsonInput(flags.document, 'document')

    const client = this.client(flags)
    let current: {name?: string; description?: string} = {}
    if (!flags['dry-run']) {
      const read = ((await client.hub.membership.getPolicy({id: args.id})) as {policy?: typeof current} | undefined)?.policy
      if (!read?.name) throw nothingRead(`policy ${args.id}`, 'Check the ID with `norbix users policies`.')
      current = read
    }

    const description = flags.description ?? current.description
    const res = await client.hub.membership.updatePolicy({
      id: args.id,
      policyName: (flags.name ?? current.name) as string,
      ...(description === undefined ? {} : {description}),
      policyDocumentJson,
    })
    this.print(`Policy ${args.id} updated.`)
    return res
  }
}
