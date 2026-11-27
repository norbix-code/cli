import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {CliError, usageError} from '../../../lib/cli-error.js'
import {EXIT} from '../../../lib/exit-codes.js'
import {formatRun, readObjectFlag} from '../../../lib/workflows.js'

/** Run states the answer may already be in for good: nothing to follow. */
const SETTLED = new Set(['succeeded', 'failed', 'cancelled', 'waiting'])

export default class CodeWorkflowsTest extends BaseCommand {
  static description = `Start a test run of a workflow with a test event

Starts the workflow as the event would: a database record (--source database --collection --record; --edits lays fields over it for an update), a Membership user (--source membership --user) or a manual start (--source manual --payload, checked against the inputs). It runs the draft when there is one, else the latest published version (--version picks another). The run is REAL: its steps send, write and call like any run. --follow polls the run until it finishes or parks on a wait.`

  static examples = [
    `<%= config.bin %> code workflows test wf_3kQ9mZ2vXc8LpR4wT7yH1n --source database --collection moto_listings --record 6ac54a59212c29912eaddd81 --follow`,
    `<%= config.bin %> code workflows test wf_3kQ9mZ2vXc8LpR4wT7yH1n --source database --event database.record.updated --collection moto_listings --record 6ac54a59212c29912eaddd81 --edits '{"status":"review"}'`,
    '<%= config.bin %> code workflows test wf_3kQ9mZ2vXc8LpR4wT7yH1n --source membership --event membership.user.registered --user usr_2R5So1Lbfc7MNr5lkY522S',
    `<%= config.bin %> code workflows test wf_3kQ9mZ2vXc8LpR4wT7yH1n --source manual --payload '{"orderId":"o1"}' --version 3 --dry-run`,
  ]

  static args = {
    id: Args.string({required: true, description: 'Workflow ID (wf_…)'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    source: Flags.string({required: true, description: 'The test event', options: ['database', 'membership', 'manual']}),
    event: Flags.string({description: 'The event, e.g. database.record.updated (default: inserted for database, updated for membership)'}),
    collection: Flags.string({description: 'database: the collection the record is in'}),
    record: Flags.string({description: 'database: the record id'}),
    user: Flags.string({description: 'membership: the user id (usr_…)'}),
    edits: Flags.string({description: 'An update only: JSON object of fields laid over the record or user (null removes a field)'}),
    'edits-file': Flags.string({description: 'Read --edits from this JSON file'}),
    payload: Flags.string({description: 'manual: JSON object the run receives'}),
    'payload-file': Flags.string({description: 'Read the payload from this JSON file'}),
    version: Flags.string({description: 'What to run: draft, or a published version number; default the draft when there is one'}),
    follow: Flags.boolean({description: 'When the run is still running, poll it until it finishes or waits, then print it', default: false}),
    timeout: Flags.integer({description: 'With --follow: give up after this many seconds (default 60)', min: 1, dependsOn: ['follow']}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeWorkflowsTest)
    if (flags.version !== undefined && !/^(draft|[1-9]\d*)$/.test(flags.version)) {
      throw usageError(`--version "${flags.version}" is neither draft nor a version number.`, '--version draft runs the draft; --version 3 runs published version 3.')
    }
    if (flags.source === 'database' && (!flags.collection || !flags.record)) {
      throw usageError('A database test needs --collection and --record.', '--collection moto_listings --record <record id>')
    }
    if (flags.source === 'membership' && !flags.user) {
      throw usageError('A membership test needs --user.', '--user usr_…')
    }

    const edits = await readObjectFlag(flags.edits, flags['edits-file'], 'edits')
    const payload = await readObjectFlag(flags.payload, flags['payload-file'])
    const client = this.client(flags)

    const res = await client.hub.code.testCodeWorkflow({
      id: args.id,
      source: flags.source,
      ...(flags.event ? {event: flags.event} : {}),
      ...(flags.collection ? {collection: flags.collection} : {}),
      ...(flags.record ? {recordId: flags.record} : {}),
      ...(flags.user ? {userId: flags.user} : {}),
      ...(edits ? {edits} : {}),
      ...(payload ? {payload} : {}),
      ...(flags.version === undefined ? {} : {runVersion: flags.version}),
    } as Parameters<typeof client.hub.code.testCodeWorkflow>[0])

    if (!flags.follow || !res.runId || SETTLED.has(res.status ?? '')) {
      this.print(res)
      return res
    }

    const timeoutSeconds = flags.timeout ?? 60
    if (!this.jsonEnabled()) this.logToStderr(`Run ${res.runId} is ${res.status}; following it (up to ${timeoutSeconds} s)…`)
    let run
    try {
      run = await client.hub.code.workflows.waitForRun(res.runId, {timeoutMs: timeoutSeconds * 1000})
    } catch (error) {
      if ((error as {name?: string}).name !== 'NorbixTimeoutError') throw error
      throw new CliError({
        exit: EXIT.NETWORK,
        code: 'TIMEOUT',
        message: `Run ${res.runId} is still running after ${timeoutSeconds} s.`,
        hint: `Read it later: norbix code workflows run ${res.runId} (or follow longer with --timeout).`,
        docs: 'norbix code workflows test --help',
      })
    }

    this.print(formatRun(run))
    return {run}
  }
}
