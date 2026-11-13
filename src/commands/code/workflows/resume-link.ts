import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {usageError} from '../../../lib/cli-error.js'
import {formatRun} from '../../../lib/workflows.js'

/** The token of a signed resume link: the whole link (…/code/workflows/resume/<token>) or the token alone. */
export function resumeLinkToken(link: string): string {
  const at = link.indexOf('/code/workflows/resume/')
  const raw = at < 0 ? link.trim() : link.slice(at + '/code/workflows/resume/'.length).split(/[?#]/)[0]!
  const token = decodeURIComponent(raw).replace(/\/+$/, '')
  if (!token || token.includes('/')) {
    throw usageError(`"${link}" is not a resume link or token.`, 'Pass the link from the notification (…/code/workflows/resume/<token>) or the token alone.')
  }

  return token
}

interface ResumeLinkAnswer {
  runId?: string
  workflowId?: string
  workflowName?: string
  stepId?: string
  stepName?: string
  mode?: string
  decision?: string
  key?: string
  assigneeUserId?: string
  expiresAt?: string
}

/** What a link will do, one fact per line. */
export function formatResumeLink(res: ResumeLinkAnswer): string {
  const rows: Array<[string, string | undefined]> = [
    ['Workflow', res.workflowName ? `${res.workflowName} (${res.workflowId ?? ''})` : res.workflowId],
    ['Run', res.runId],
    ['Step', res.stepName ? `${res.stepName} (${res.stepId ?? ''})` : res.stepId],
    ['Does', res.decision ? `${res.mode ?? 'resume'}: ${res.decision}` : res.mode],
    ['Key', res.key],
    ['For', res.assigneeUserId],
    ['Expires', res.expiresAt],
  ]
  return rows
    .filter(([, v]) => v)
    .map(([k, v]) => `${`${k}:`.padEnd(10)}${v}`)
    .join('\n')
}

export default class CodeWorkflowsResumeLink extends BaseCommand {
  static description = `Beta: check or use a signed resume link

A wait step's notification carries signed links (@Model.Wait.ApproveUrl, RejectUrl, ResumeUrl). Without --use this shows what the link will do — the workflow, the run, the step, the decision and when it expires — and changes nothing (GET). With --use it answers the wait as the link's assignee and prints the run (POST); a group approval counts the answer and the run may still wait. The link is the key: no sign-in is needed. Pass the whole link or only the token. Calls the Api host.`

  static examples = [
    '<%= config.bin %> code workflows resume-link "https://api.norbix.ai/v2/code/workflows/resume/eyJydW4iOi…"',
    '<%= config.bin %> code workflows resume-link eyJydW4iOi… --use --yes',
    '<%= config.bin %> code workflows resume-link eyJydW4iOi… --use --dry-run',
  ]

  static args = {
    link: Args.string({required: true, description: 'The resume link, or its token'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
    use: Flags.boolean({description: 'Answer the wait with the link (changes the run); default: only show what it would do', default: false}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(CodeWorkflowsResumeLink)
    const token = resumeLinkToken(args.link)
    const client = this.client(flags)

    if (!flags.use) {
      const res = await client.api.code.openCodeWorkflowResumeLink({token})
      this.print(formatResumeLink(res as ResumeLinkAnswer))
      return res
    }

    await this.confirmOrFail('Answer the waiting step with this link?', flags)
    const res = await client.api.code.useCodeWorkflowResumeLink({token})
    this.print(formatRun(res.run))
    return res
  }
}
