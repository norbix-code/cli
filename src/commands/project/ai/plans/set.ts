import {Flags} from '@oclif/core'

import {ProjectCommand} from '../../../../lib/project.js'
import {usageError} from '../../../../lib/cli-error.js'
import {readJsonInput} from '../../../../lib/json.js'
import {READ_FIRST_DRY_RUN, nothingRead} from '../../../../lib/membership.js'

type Plan = Record<string, unknown> & {id?: string}

export default class ProjectAiPlansSet extends ProjectCommand {
  static description = `Add, change or remove end-user AI plans

The Hub replaces the whole plan list in one call (a plan left out is
removed), so --plan and --remove read the stored plans first and change only
those:
  --plan <json>   with the id of a stored plan: the fields you pass replace
                  those fields, the rest of the plan is kept; an id that is
                  not stored is refused. Without an id: a new plan (the Hub
                  gives it one). Repeatable.
  --remove <id>   removes a plan (asks first: --yes). Repeatable.
  --file <json>   the complete list instead (a JSON array, or {"plans": […]}):
                  every stored plan not in it is removed, so it asks first.
A plan: {"name", "quotaUnit": None|Credits|Tokens, "monthlyQuota",
"allowedAssistantIds", "allowedModels": [{"llmIntegrationId","model"}],
"features": {"attachments","rag","memory"}, "quotaReachedMessage"}.
JSON values: inline, @file or -.

${READ_FIRST_DRY_RUN}`

  static examples = [
    `<%= config.bin %> project ai plans set --plan '{"name":"Free","quotaUnit":"Credits","monthlyQuota":100}'`,
    `<%= config.bin %> project ai plans set --plan '{"id":"aip_7Tq2","name":"Pro","quotaUnit":"Credits","monthlyQuota":5000}'`,
    '<%= config.bin %> project ai plans set --remove aip_7Tq2 --yes',
    '<%= config.bin %> project ai plans set --file @plans.json --yes',
    `<%= config.bin %> project ai plans set --plan '{"name":"Team","quotaUnit":"None"}' --dry-run`,
  ]

  static flags = {
    ...ProjectCommand.mutatingFlags,
    plan: Flags.string({description: 'A plan to add or change (JSON, @file or -; repeatable)', multiple: true, exclusive: ['file']}),
    remove: Flags.string({description: 'Id of a plan to remove (repeatable)', multiple: true, exclusive: ['file']}),
    file: Flags.string({description: 'The complete plan list (JSON array or {"plans": […]}, @file or -)'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ProjectAiPlansSet)
    if (!flags.plan && !flags.remove && !flags.file) throw usageError('Pass --plan, --remove or --file.')
    const {client, projectId} = this.projectClient(flags)

    let plans: Plan[]
    if (flags.file) {
      plans = await planList(flags.file)
      await this.confirmOrFail('Replace every AI plan of the project? Plans not in the file are removed.', flags)
    } else {
      const changes = await Promise.all((flags.plan ?? []).map((p) => planObject(p)))
      const removed = new Set(flags.remove ?? [])
      let stored: Plan[] = []
      if (!flags['dry-run']) {
        const read = (await client.hub.account.getProjectAiPlans({projectId})) as {result?: {plans?: Plan[]}}
        if (!read?.result) throw nothingRead('AI plans', 'Check the project and --env.')
        stored = read.result.plans ?? []
        const unknown = [...removed, ...changes.flatMap((c) => (c.id ? [c.id] : []))].filter((id) => !stored.some((p) => p.id === id))
        if (unknown.length > 0) throw usageError(`No AI plan ${unknown.join(', ')} in the project; nothing was saved.`)
      }

      if (removed.size > 0) await this.confirmOrFail(`Remove AI plan ${[...removed].join(', ')}?`, flags)
      plans = stored.filter((p) => !removed.has(p.id ?? ''))
      for (const change of changes) {
        const at = change.id ? plans.findIndex((p) => p.id === change.id) : -1
        // A stored plan keeps every field the change does not name.
        if (at >= 0) plans[at] = {...plans[at], ...change}
        else plans.push(change)
      }
    }

    const res = await client.hub.account.updateProjectAiPlans({projectId, plans} as never)
    this.print(`AI plans saved (${plans.length}).`)
    return res
  }
}

async function planObject(value: string): Promise<Plan> {
  const parsed = JSON.parse(await readJsonInput(value, 'plan')) as unknown
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw usageError('--plan must be a JSON object.')
  return parsed as Plan
}

async function planList(value: string): Promise<Plan[]> {
  const parsed = JSON.parse(await readJsonInput(value, 'file')) as unknown
  const list = Array.isArray(parsed) ? parsed : (parsed as {plans?: unknown} | null)?.plans
  if (!Array.isArray(list)) throw usageError('--file must be a JSON array of plans, or {"plans": […]}.')
  return list as Plan[]
}
