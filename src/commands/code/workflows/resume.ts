import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {usageError} from '../../../lib/cli-error.js'
import {DECISIONS, formatRun, readObjectFlag} from '../../../lib/workflows.js'

export default class CodeWorkflowsResume extends BaseCommand {
  static description = `Beta: resume a waiting run — answer an approval, deliver an event

Address the run by its id, or — when you only know the wait's key (an outside system) — by --workflow and --key: exactly one of the two. --step names the waiting step when several wait (parallel branches). An approval needs --decision approved or rejected; when it names assignees you must be one of them. --payload is checked against the wait's inputs. --app-user calls the Api host's twin of the run-id route, for an app user's login (not with --key: that route is Hub-only). Prints the run.`

  static examples = [
    '<%= config.bin %> code workflows resume wfr_5nB2xQ7wLk9RmT3vYc1HdP --decision approved --yes',
    `<%= config.bin %> code workflows resume wfr_5nB2xQ7wLk9RmT3vYc1HdP --step wait-for-payment --payload '{"paid":true}' --yes`,
    '<%= config.bin %> code workflows resume --workflow wf_3kQ9mZ2vXc8LpR4wT7yH1n --key order-6ac54a59 --decision rejected --yes',
    '<%= config.bin %> code workflows resume wfr_5nB2xQ7wLk9RmT3vYc1HdP --decision approved --dry-run',
  ]

  static args = {
    runId: Args.string({required: false, description: 'Run ID (wfr_…); omit it and pass --workflow and --key to find the run by its wait key'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
    workflow: Flags.string({description: 'Workflow ID (wf_…) — with --key, instead of a run id', dependsOn: ['key']}),
    key: Flags.string({description: "The wait's key — with --workflow, instead of a run id", dependsOn: ['workflow']}),
    step: Flags.string({description: 'The waiting step (its stepId); required when several steps wait'}),
    decision: Flags.string({description: 'The answer to an approval', options: DECISIONS}),
    payload: Flags.string({description: 'JSON object handed to the step (inline, @file or - for stdin)'}),
    'payload-file': Flags.string({description: 'Read the payload from this JSON file'}),
    'app-user': Flags.boolean({description: "Use the Api host's route (an app user's login) instead of the Hub's", default: false, exclusive: ['key']}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeWorkflowsResume)
    if (Boolean(args.runId) === Boolean(flags.key)) {
      throw usageError(
        args.runId ? 'Pass a run id or --workflow with --key, not both.' : 'Name the run: a run id, or --workflow <wf_…> with --key <key>.',
        'norbix code workflows resume wfr_… --decision approved, or norbix code workflows resume --workflow wf_… --key <key> --decision approved.',
        'norbix code workflows resume --help',
      )
    }

    const payload = await readObjectFlag(flags.payload, flags['payload-file'])
    const client = this.client(flags)
    const answer = {
      ...(flags.step ? {stepId: flags.step} : {}),
      ...(flags.decision ? {decision: flags.decision} : {}),
      ...(payload ? {payload} : {}),
    }

    await this.confirmOrFail(
      `Resume ${args.runId ? `run ${args.runId}` : `the run of ${flags.workflow} waiting on key ${flags.key}`}${flags.decision ? ` (${flags.decision})` : ''}?`,
      flags,
    )

    let res
    if (args.runId) {
      const request = {runId: args.runId, ...answer}
      res = flags['app-user']
        ? await client.api.code.resumeCodeWorkflowRun(request as Parameters<typeof client.api.code.resumeCodeWorkflowRun>[0])
        : await client.hub.code.resumeCodeWorkflowRun(request as Parameters<typeof client.hub.code.resumeCodeWorkflowRun>[0])
    } else {
      res = await client.hub.code.resumeCodeWorkflowRunByKey({id: flags.workflow!, key: flags.key!, ...answer} as Parameters<
        typeof client.hub.code.resumeCodeWorkflowRunByKey
      >[0])
    }

    this.print(formatRun(res.run))
    return res
  }
}
