import {Flags} from '@oclif/core'

import {ProjectCommand} from '../../../../lib/project.js'
import {usageError} from '../../../../lib/cli-error.js'
import {READ_FIRST_DRY_RUN, nothingRead} from '../../../../lib/membership.js'

interface RoleRow {
  roleId: string
  planId: string
}

export default class ProjectAiPlansAssign extends ProjectCommand {
  static description = `Choose which AI plan users get: per role, and the default

--role <roleId>=<planId> (repeatable, in order) replaces the role rows: a
user with several mapped roles gets the plan of the first row. --default is
the plan of users with no mapped role. The Hub replaces the
rows and the default together, so when you pass only one of them the
command reads the other first and keeps it.

${READ_FIRST_DRY_RUN}`

  static examples = [
    '<%= config.bin %> project ai plans assign --role pr_x_nr_pro=aip_pro --role pr_x_nr_staff=aip_free',
    '<%= config.bin %> project ai plans assign --default aip_free',
    '<%= config.bin %> project ai plans assign --clear-roles --clear-default --dry-run',
  ]

  static flags = {
    ...ProjectCommand.dryRunFlags,
    role: Flags.string({description: 'roleId=planId (repeatable, in order)', multiple: true, exclusive: ['clear-roles']}),
    'clear-roles': Flags.boolean({description: 'Remove every role row', default: false}),
    default: Flags.string({description: 'Plan id of users with no mapped role', exclusive: ['clear-default']}),
    'clear-default': Flags.boolean({description: 'No default plan', default: false}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ProjectAiPlansAssign)
    const rolesGiven = flags.role !== undefined || flags['clear-roles']
    const defaultGiven = flags.default !== undefined || flags['clear-default']
    if (!rolesGiven && !defaultGiven) throw usageError('Pass --role, --clear-roles, --default or --clear-default.')
    const roles: RoleRow[] | undefined = flags['clear-roles'] ? [] : flags.role?.map((r) => roleRow(r))

    const {client, projectId} = this.projectClient(flags)
    let current: {roles?: RoleRow[]; defaultPlanId?: string} = {}
    if (!(rolesGiven && defaultGiven) && !flags['dry-run']) {
      const read = (await client.hub.account.getProjectAiPlans({projectId})) as {result?: {roles?: RoleRow[]; defaultPlanId?: string}}
      if (!read?.result) throw nothingRead('AI plans', 'Check the project and --env.')
      current = read.result
    }

    const body = {
      projectId,
      roles: roles ?? current.roles ?? [],
      defaultPlanId: flags['clear-default'] ? '' : (flags.default ?? current.defaultPlanId ?? ''),
    }
    const res = await client.hub.account.updateProjectAiPlanAssignments(body)
    this.print('AI plan assignments saved.')
    return res
  }
}

function roleRow(value: string): RoleRow {
  const at = value.indexOf('=')
  if (at < 1 || at === value.length - 1) throw usageError(`--role "${value}" must be roleId=planId, e.g. pr_x_nr_pro=aip_pro.`)
  return {roleId: value.slice(0, at).trim(), planId: value.slice(at + 1).trim()}
}
