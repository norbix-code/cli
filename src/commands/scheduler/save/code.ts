import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {parseTokens, readJsonObject} from '../../../lib/email.js'
import {CRON_FIELDS, parseCron, taskFlags, taskRequest} from '../../../lib/scheduler.js'
import {EXECUTION_IDENTITY_HELP} from '../../../lib/triggers.js'

export default class SchedulerSaveCode extends BaseCommand {
  static description = `Create or update a "Code call" task: call a cloud function on a cron

Each time --cron fires (5 fields: ${CRON_FIELDS}, UTC) the task sends the function one event envelope (event "scheduler.task.fired", the task under data.task) through the Code integration. --integration and --function name it (\`norbix code functions --integration <id>\` lists what an integration may call); --qualifier picks an alias or version. --async fires and forgets; without it the call waits for the result (Sync).

--config is optional JSON handed to the function; it may hold @Model.X bindings — map each one with --token key=value. Without --id a new task is created; with --id that task is replaced (send every field again).

--execution-identity says who the task runs as: ${EXECUTION_IDENTITY_HELP}. --initiator is the user the task is attributed to (usr_…; default: you); it needs code:execute on the integration, or the save is refused (CM-ERRORS-SCHEDULER-012). Prints the task ID.`

  static examples = [
    '<%= config.bin %> scheduler save code --name "Nightly report" --cron "0 2 * * *" --integration int_6rBACnEaxQ0x1jTiHtAuWV --function nightly-report --qualifier live --async --yes',
    '<%= config.bin %> scheduler save code --name "Nightly report" --cron "0 2 * * *" --integration int_6rBACnEaxQ0x1jTiHtAuWV --function nightly-report --config \'{"source":"scheduler"}\' --dry-run',
    '<%= config.bin %> scheduler save code --id tsk_66b2f0a1 --name "Nightly report" --cron "30 2 * * *" --integration int_6rBACnEaxQ0x1jTiHtAuWV --function nightly-report --no-enabled --yes',
  ]

  static flags = {
    ...BaseCommand.mutatingFlags,
    ...taskFlags,
    integration: Flags.string({required: true, description: 'Code integration ID (int_…) the function is called through'}),
    function: Flags.string({required: true, description: 'Function ID (its name in the cloud, e.g. nightly-report)'}),
    qualifier: Flags.string({description: 'Alias or version of the function (e.g. live, 3)'}),
    async: Flags.boolean({description: 'Fire and forget (Async); default: wait for the result (Sync)', default: false}),
    config: Flags.string({description: 'JSON object handed to the function, @file or - (may hold @Model.X bindings)'}),
    token: Flags.string({description: 'Map a binding of --config, key=value (repeat for several)', multiple: true}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(SchedulerSaveCode)
    const cron = parseCron(flags.cron, (message) => this.error(message))
    const config = flags.config ? JSON.stringify(await readJsonObject(flags.config, 'config')) : undefined
    const mappedTokens = parseTokens(flags.token)

    const task: Record<string, unknown> = {
      type: 'CodeFunctionalCall',
      functionRef: {integrationId: flags.integration, functionId: flags.function, ...(flags.qualifier ? {qualifier: flags.qualifier} : {})},
      invocationType: flags.async ? 'Async' : 'Sync',
      ...(config ? {config} : {}),
      ...(mappedTokens ? {mappedTokens} : {}),
    }

    const client = this.client(flags)
    const what = flags.id ? `Update scheduler task ${flags.id}` : `Create scheduler task "${flags.name}"`
    await this.confirmOrFail(`${what}: call ${flags.function} (cron "${cron}" UTC)?`, flags)

    // `task` is typed as the base SchedulerTaskRequest ({type}); the Code body is
    // the generated CodeFunctionSchedulerTaskRequest, sent as a plain object.
    const res = await client.hub.scheduler.saveSchedulerTask(
      taskRequest(flags, cron, task) as unknown as Parameters<typeof client.hub.scheduler.saveSchedulerTask>[0],
    )

    const id = (res as {id?: string} | undefined)?.id ?? flags.id
    this.print(id ? `Task ${id} saved.` : 'Task saved.')
    return res
  }
}
