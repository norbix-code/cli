import {Flags} from '@oclif/core'
import type {Norbix} from '@norbix.ai/ts'

import {ProjectCommand} from '../../lib/project.js'

type HealthRequest = NonNullable<Parameters<Norbix['hub']['account']['getProjectHealth']>[0]>
type ProjectHealthSeverity = NonNullable<HealthRequest['severity']>
type ApplicationModule = NonNullable<HealthRequest['module']>

/** ApplicationModule names; the Hub reads the name from the query string. */
const HEALTH_MODULES = ['Account', 'Membership', 'Database', 'Files', 'Code', 'Email', 'Push', 'Payment', 'Scheduler', 'Logging', 'ServerEvents', 'Ai', 'Sms', 'Project', 'Compliance', 'Contacts', 'Marketplace', 'Diagnostics']

export default class ProjectHealth extends ProjectCommand {
  static description = `Show what is wrong with the project and what to fix next

The project health of the request environment (--env): a list of problems
(templates missing a project language, a module that is off while something
still needs it, integrations never tested or failing, triggers whose target
is gone, failing scheduler tasks), each with the Cloud page that fixes it,
and the user / e-mail / API call numbers of the period.

Errors come first, then warnings. --severity and --module keep only those
problems; --page-size pages them (--page 0 is the first page) and
warningsTotal says how many match.

The Hub computes it every 6 hours and keeps the result; --refresh computes
it now (after you fixed something).`

  static examples = [
    '<%= config.bin %> project health',
    '<%= config.bin %> project health --refresh --period 7',
    '<%= config.bin %> project health --env TEST --json',
    '<%= config.bin %> project health --severity Error --module Email',
    '<%= config.bin %> project health --page-size 20 --page 1 --json',
  ]

  static flags = {
    refresh: Flags.boolean({description: 'Compute it now instead of reading the last result', default: false}),
    period: Flags.string({description: 'Days the numbers cover', options: ['7', '30', '90']}),
    severity: Flags.string({description: 'Only problems of this severity (both when left out)', options: ['Error', 'Warning']}),
    module: Flags.string({description: 'Only problems of this module (every module when left out)', options: HEALTH_MODULES}),
    page: Flags.integer({description: 'Page of problems, 0 = the first (with --page-size)', min: 0}),
    'page-size': Flags.integer({description: 'Problems per page, 1 to 100 (every problem when left out)', min: 1, max: 100}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(ProjectHealth)
    const {client, projectId} = this.projectClient(flags)

    const res = await client.hub.account.getProjectHealth({
      projectId,
      ...(flags.refresh ? {refresh: true} : {}),
      ...(flags.period ? {periodDays: Number(flags.period)} : {}),
      ...(flags.severity ? {severity: flags.severity as ProjectHealthSeverity} : {}),
      ...(flags.module ? {module: flags.module as unknown as ApplicationModule} : {}),
      ...(flags.page === undefined ? {} : {pageNumber: flags.page}),
      ...(flags['page-size'] === undefined ? {} : {pageSize: flags['page-size']}),
    })

    this.print(res)
    return res
  }
}
