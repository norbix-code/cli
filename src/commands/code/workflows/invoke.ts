import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {CliError, usageError} from '../../../lib/cli-error.js'
import {EXIT} from '../../../lib/exit-codes.js'
import {formatRun, readObjectFlag} from '../../../lib/workflows.js'

/** Run states the invoke answer may already be in for good: nothing to follow. */
const SETTLED = new Set(['succeeded', 'failed', 'cancelled', 'waiting'])

export default class CodeWorkflowsInvoke extends BaseCommand {
  static description = `Beta: start a workflow run by hand

Sends the payload (checked against the definition's inputs when it has one) and waits up to --wait seconds (0-30, default 10 on the server) for the run. Finished: the runId, status succeeded or failed, the output, the duration and the error. Not finished: the runId and status running or waiting — read it later with \`code workflows run <runId>\`, or pass --follow to poll the run until it finishes or parks on a wait and print it as a step table. --version draft runs the draft (test before publishing); --version N a published version; default the latest published.`

  static examples = [
    `<%= config.bin %> code workflows invoke wf_3kQ9mZ2vXc8LpR4wT7yH1n --payload '{"orderId":"6ac54a59212c29912eaddd81"}'`,
    '<%= config.bin %> code workflows invoke wf_3kQ9mZ2vXc8LpR4wT7yH1n --payload-file payload.json --version draft --wait 0 --follow',
    '<%= config.bin %> code workflows invoke wf_3kQ9mZ2vXc8LpR4wT7yH1n --version 3 --wait 30 --json',
    `<%= config.bin %> code workflows invoke wf_3kQ9mZ2vXc8LpR4wT7yH1n --payload '{"orderId":"6ac54a59212c29912eaddd81"}' --dry-run`,
  ]

  static args = {
    id: Args.string({required: true, description: 'Workflow ID (wf_…)'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    payload: Flags.string({description: 'JSON object the run receives (inline, @file or - for stdin)'}),
    'payload-file': Flags.string({description: 'Read the payload from this JSON file'}),
    wait: Flags.integer({description: 'Seconds to wait for the run: 0-30 (server default 10; 0 answers at once)', min: 0, max: 30}),
    version: Flags.string({description: 'What to run: draft, or a published version number; default the latest published'}),
    follow: Flags.boolean({description: 'When the run is still running, poll it until it finishes or waits, then print it', default: false}),
    timeout: Flags.integer({description: 'With --follow: give up after this many seconds (default 60)', min: 1, dependsOn: ['follow']}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeWorkflowsInvoke)
    if (flags.version !== undefined && !/^(draft|[1-9]\d*)$/.test(flags.version)) {
      throw usageError(`--version "${flags.version}" is neither draft nor a version number.`, '--version draft runs the draft; --version 3 runs published version 3.')
    }

    const payload = await readObjectFlag(flags.payload, flags['payload-file'])
    const client = this.client(flags)

    const res = await client.hub.code.invokeCodeWorkflow({
      id: args.id,
      ...(payload ? {payload} : {}),
      ...(flags.wait === undefined ? {} : {waitSeconds: flags.wait}),
      ...(flags.version === undefined ? {} : {runVersion: flags.version}),
    } as Parameters<typeof client.hub.code.invokeCodeWorkflow>[0])

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
        docs: 'norbix code workflows invoke --help',
      })
    }

    this.print(formatRun(run))
    return {run}
  }
}
