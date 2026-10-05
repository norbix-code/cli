import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class AccountTeam extends BaseCommand {
  static description = `List account collaborators (team members)

Pages with --page-size (default 20 on the server) and the --after / --before
cursors. --in-project keeps only the members with access to that project (it
is a filter, not the global --project context, so NORBIX_PROJECT_ID never
narrows the list by itself). The account owner is left out unless
--include-owner is set.`

  static examples = [
    '<%= config.bin %> account team',
    '<%= config.bin %> account team --include-owner --page-size 50',
    '<%= config.bin %> account team --in-project 66a1b2c3d4e5f6a7b8c9d0e1 --after acc_usr_20',
  ]

  static flags = {
    'in-project': Flags.string({description: 'Only members with access to this project ID'}),
    'include-owner': Flags.boolean({description: 'Also list the account owner', default: false}),
    'page-size': Flags.integer({description: 'Records per page (server default 20)'}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
    before: Flags.string({description: 'Cursor: fetch the page before this item'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(AccountTeam)
    const client = this.client(flags)

    // Flat paging fields: the gateway no longer binds the nested `pagingArgs`
    // from the query string (@norbix.ai/ts 4.8.0). Only set fields are sent,
    // so a plain `account team` sends the same request as before.
    const res = await client.hub.account.getAccountCollaborators({
      ...(flags['in-project'] ? {projectId: flags['in-project']} : {}),
      ...(flags['include-owner'] ? {includeAccountOwner: true} : {}),
      ...(flags['page-size'] === undefined ? {} : {pageSize: flags['page-size']}),
      ...(flags.after ? {startingAfter: flags.after} : {}),
      ...(flags.before ? {endingBefore: flags.before} : {}),
    })

    this.print(res)
    return res
  }
}
