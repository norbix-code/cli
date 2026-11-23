import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class SupportAttachments extends BaseCommand {
  static description = 'List the files on one of your support cases'

  static examples = ['<%= config.bin %> support attachments sup_1o5A0SxVXzWo9yqOfmQf8F', '<%= config.bin %> support attachments sup_1o5A0SxVXzWo9yqOfmQf8F --json']

  static args = {
    caseId: Args.string({required: true, description: 'Support case id (sup_…)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(SupportAttachments)
    const res = await this.client(flags).hub.support.getSupportCaseAttachments({caseId: args.caseId})
    this.print(res)
    return res
  }
}
