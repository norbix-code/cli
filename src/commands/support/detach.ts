import {Args} from '@oclif/core'

import {BaseCommand} from '../../base.js'

export default class SupportDetach extends BaseCommand {
  static description = `Remove a file you added to a support case

Only a file you added, and not on a closed case.`

  static examples = [
    '<%= config.bin %> support detach sup_1o5A0SxVXzWo9yqOfmQf8F supf_3kQ0x… --yes',
    '<%= config.bin %> support detach sup_1o5A0SxVXzWo9yqOfmQf8F supf_3kQ0x… --dry-run',
  ]

  static args = {
    caseId: Args.string({required: true, description: 'Support case id (sup_…)'}),
    attachmentId: Args.string({required: true, description: 'File id (supf_…), from `norbix support attachments`'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(SupportDetach)
    const client = this.client(flags)
    await this.confirmOrFail(`Remove file ${args.attachmentId} from support case ${args.caseId}?`, flags)
    const res = await client.hub.support.deleteSupportCaseAttachment({caseId: args.caseId, attachmentId: args.attachmentId})
    this.print(`Removed ${args.attachmentId} from ${args.caseId}.`)
    return res
  }
}
