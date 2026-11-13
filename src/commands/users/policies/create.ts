import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {readJsonInput} from '../../../lib/json.js'

export default class UsersPoliciesCreate extends BaseCommand {
  static description = `Create a policy (a set of permissions)

--document is the permission document, an IAM-style JSON object: inline,
@file.json, or - for stdin. Look at a built-in one first:
\`norbix users policies <id> --json\`.`

  static examples = [
    '<%= config.bin %> users policies create --name "Orders read" --document @orders-read.json',
    '<%= config.bin %> users policies create --name "Orders read" --description "Read orders" --document @orders-read.json --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    name: Flags.string({required: true, description: 'Policy name, unique in the project'}),
    description: Flags.string({description: 'What the policy allows'}),
    document: Flags.string({description: 'Permission document: JSON, @file.json or -'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(UsersPoliciesCreate)
    const policyDocumentJson = flags.document === undefined ? undefined : await readJsonInput(flags.document, 'document')
    const client = this.client(flags)

    const res = await client.hub.membership.createPolicy({
      policyName: flags.name,
      ...(flags.description ? {description: flags.description} : {}),
      ...(policyDocumentJson ? {policyDocumentJson} : {}),
    })
    const id = (res as {id?: string} | undefined)?.id
    this.print(id ? `Policy ${flags.name} created (${id}).` : `Policy ${flags.name} created.`)
    return res
  }
}
