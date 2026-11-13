import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class UsersApiKeys extends BaseCommand {
  static description = `List the API keys of a project service user

A project service user (\`norbix users register --service\`) signs in to the
project's Api with these keys. Each row: key ID, name, scopes, environment,
when it was made and expires, and whether it works. The key itself is shown
only once, by \`norbix users api-keys issue\`. Account service users (for the
CLI, CI and agents) are \`norbix apikeys\`.`

  static examples = ['<%= config.bin %> users api-keys usr_66b2f0a1c3d4', '<%= config.bin %> users api-keys usr_66b2f0a1c3d4 --json']

  static args = {
    id: Args.string({required: true, description: 'Service user login ID (usr_…)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersApiKeys)
    const client = this.client(flags)

    const res = await client.hub.membership.listServiceUserApiKeys({id: args.id})
    const keys = res.keys ?? []
    this.print(keys.length > 0 ? keys : `Service user ${args.id} has no API keys. Make one: norbix users api-keys issue ${args.id} --name <name>`)
    return res
  }
}
