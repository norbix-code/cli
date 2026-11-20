import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class SupportReply extends BaseCommand {
  static description = 'Add a message to one of your support cases (Norbix support reads it)'

  static examples = ['<%= config.bin %> support reply sup_1o5A0SxVXzWo9yqOfmQf8F --message "It happens again since 09:00 UTC"']

  static args = {
    caseId: Args.string({required: true, description: 'Support case id (sup_…)'}),
  }

  static flags = {
    message: Flags.string({required: true, description: 'The message'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(SupportReply)
    const res = await this.client(flags).hub.support.appendSupportCaseMessage({caseId: args.caseId, message: flags.message})
    this.print(res)
    return res
  }
}
