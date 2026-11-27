import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class CodeWorkflowsList extends BaseCommand {
  static description = `The workflows of the project in this environment

Newest first. One row per workflow: workflowId, name, the published version, hasDraft, isEnabled (and disabledReason, e.g. runaway), the last run and how many runs wait. --search keeps the workflows whose name has that text (any case). Pages with --limit and the --after / --before cursors of the answer.`

  static examples = [
    '<%= config.bin %> code workflows list',
    '<%= config.bin %> code workflows list --disabled --limit 50 --json',
    '<%= config.bin %> code workflows list --search invoice',
  ]

  static flags = {
    enabled: Flags.boolean({description: 'Only enabled workflows', exclusive: ['disabled']}),
    disabled: Flags.boolean({description: 'Only disabled workflows', exclusive: ['enabled']}),
    search: Flags.string({description: 'Only workflows whose name has this text (any case)'}),
    limit: Flags.integer({description: 'Page size (rows per page)', min: 1}),
    after: Flags.string({description: 'Cursor: fetch the page after this item'}),
    before: Flags.string({description: 'Cursor: fetch the page before this item'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(CodeWorkflowsList)
    const client = this.client(flags)

    const res = await client.hub.code.getCodeWorkflows({
      ...(flags.enabled ? {isEnabled: true} : {}),
      ...(flags.disabled ? {isEnabled: false} : {}),
      ...(flags.search ? {search: flags.search} : {}),
      ...(flags.limit ? {pageSize: flags.limit} : {}),
      ...(flags.after ? {startingAfter: flags.after} : {}),
      ...(flags.before ? {endingBefore: flags.before} : {}),
    })

    this.print(res)
    return res
  }
}
