import {Args, Flags} from '@oclif/core'
import {readFile} from 'node:fs/promises'

import {BaseCommand} from '../../../base.js'
import {usageError} from '../../../lib/cli-error.js'
import {formatWorkflow} from '../../../lib/workflows.js'

export default class CodeWorkflowsStartEvent extends BaseCommand {
  static description = `Set the event that starts a workflow

Saves the start event into the workflow's draft (the draft is made from the latest published version when there is none). Nothing starts yet: check the draft and publish it with \`code workflows publish <id>\` — publishing writes the trigger of that module, linked to the workflow. That trigger cannot be changed from the trigger commands (CM-ERRORS-WORKFLOWS-052); disabling, enabling or deleting the workflow does the same to it.

--source is database, membership, files, payments or ai; --event is that source's event (database.record.inserted, membership.user.registered, payments.order.paid, …; \`code workflows schema\` and the docs list them all). --schema names the collection (database only). --condition is optional sandbox code that must return true for a run to start; it reads Old, New and Event, like a trigger's activation code. The same start again saves nothing; a workflow that already has a different start is refused (CM-ERRORS-WORKFLOWS-054).`

  static examples = [
    `<%= config.bin %> code workflows start-event wf_3kQ9mZ2vXc8LpR4wT7yH1n --source database --event database.record.inserted --schema moto_listings --condition 'return New.status == "review";'`,
    '<%= config.bin %> code workflows start-event wf_3kQ9mZ2vXc8LpR4wT7yH1n --source membership --event membership.user.registered',
    '<%= config.bin %> code workflows start-event wf_3kQ9mZ2vXc8LpR4wT7yH1n --source database --event database.record.updated --schema orders --condition-file start.cs --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Workflow ID (wf_…)'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    source: Flags.string({required: true, description: 'What starts the workflow', options: ['database', 'membership', 'files', 'payments', 'ai']}),
    event: Flags.string({required: true, description: 'The event of that source, e.g. database.record.inserted'}),
    schema: Flags.string({description: 'database: the collection name'}),
    condition: Flags.string({description: 'Code that must return true for a run to start (reads Old, New, Event)'}),
    'condition-file': Flags.string({description: 'Read the condition from this file'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeWorkflowsStartEvent)
    if (flags.source === 'database' && !flags.schema) {
      throw usageError('--schema is needed for a database start.', '--schema moto_listings (the collection name).')
    }
    if (flags.source !== 'database' && flags.schema) {
      throw usageError('--schema is only for a database start.', 'Leave --schema out for membership, files, payments and ai.')
    }
    if (flags.condition !== undefined && flags['condition-file'] !== undefined) {
      throw usageError('Pass either --condition or --condition-file, not both.', `--condition 'return New.status == "review";'`)
    }

    const condition = flags['condition-file'] === undefined ? flags.condition : await readFile(flags['condition-file'], 'utf8')
    const start = {
      source: flags.source,
      event: flags.event,
      ...(flags.schema ? {schema: flags.schema} : {}),
      ...(condition !== undefined && condition.trim() !== '' ? {condition} : {}),
    }

    const client = this.client(flags)

    const res = await client.hub.code.setCodeWorkflowStartEvent({id: args.id, start})

    this.print(`${formatWorkflow('start event saved in the draft', res)}\nPublish it to write the trigger: norbix code workflows publish ${args.id} --yes`)
    return res
  }
}
