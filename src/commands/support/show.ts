import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class SupportShow extends BaseCommand {
  static description = 'Show one support case with its conversation (replies from Norbix support included)'

  static examples = ['<%= config.bin %> support show sup_1o5A0SxVXzWo9yqOfmQf8F --json']

  static args = {
    caseId: Args.string({required: true, description: 'Support case id (sup_…)'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(SupportShow)
    const res = await this.client(flags).hub.support.getSupportCase({caseId: args.caseId})
    this.print(res)
    return res
  }
}
