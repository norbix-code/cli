import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {
  EMAIL_AUDIENCE_HELP,
  emailAudienceFields,
  emailAudienceFlags,
  parseTokens,
  readJsonObject,
} from '../../lib/email.js'

/** Field names of a 5-field cron, for the error message. */
const CRON_FIELDS = 'minute hour day-of-month month day-of-week'

export default class SchedulerSave extends BaseCommand {
  static description = `Create or update a scheduler task

Without --id a new task is created; with --id that task is replaced by what the flags say (send every field again — the server does not merge).

The only task type today is an email campaign: each time --cron fires, the task sends the --template to the --audience. --cron has 5 fields (${CRON_FIELDS}) and runs in UTC, e.g. "0 9 * * 1" is every Monday at 09:00 UTC.

--initiator is the user the task runs as (usr_…): yourself, or a service user of this project. It must belong to this project.

--integration is required: name the email provider every run sends through (list them with \`norbix email integrations\`). The server never falls back to the project default; a task without one would fail each time it fires. --language forces one language; it must be one of the project's languages (Project settings), and the template must have a translation for every project language. --on-behalf-of sends each run on behalf of another project user (their details fill the Initiator.User.* tokens; default: the --initiator).

${EMAIL_AUDIENCE_HELP}

Anything the flags do not cover goes in --config as a JSON object and is merged into the campaign. Prints the task ID.`

  static examples = [
    '<%= config.bin %> scheduler save --name "Weekly digest" --cron "0 9 * * 1" --initiator usr_66b2f0a1 --template 66b2f0a1c3d4e5f6a7b8c9d0 --integration 66c1a2b3c4d5e6f7a8b9c0d1 --audience all-users --yes',
    '<%= config.bin %> scheduler save --name "Beta news" --cron "30 7 1 * *" --initiator usr_66b2f0a1 --template 66b2f0a1c3d4e5f6a7b8c9d0 --integration 66c1a2b3c4d5e6f7a8b9c0d1 --audience all-users --tag beta --no-enabled --yes',
    '<%= config.bin %> scheduler save --id 66b2f0a1c3d4e5f6a7b8c9d0 --name "Weekly digest" --cron "0 10 * * 1" --initiator usr_66b2f0a1 --template 66b2f0a1c3d4e5f6a7b8c9d0 --integration 66c1a2b3c4d5e6f7a8b9c0d1 --audience emails --email ada@example.com --yes',
    '<%= config.bin %> scheduler save --name "Weekly digest" --cron "0 9 * * 1" --initiator usr_66b2f0a1 --template 66b2f0a1c3d4e5f6a7b8c9d0 --integration 66c1a2b3c4d5e6f7a8b9c0d1 --audience all-users --dry-run',
  ]

  static flags = {
    ...BaseCommand.mutatingFlags,
    id: Flags.string({description: 'Task ID — set it to update that task instead of creating one'}),
    name: Flags.string({required: true, description: 'Task name'}),
    description: Flags.string({description: 'What the task is for'}),
    cron: Flags.string({required: true, description: `When it runs: a 5-field cron (${CRON_FIELDS}) in UTC`}),
    initiator: Flags.string({
      required: true,
      description: 'User ID (usr_…) the task runs as — yourself or a service user of this project',
    }),
    enabled: Flags.boolean({
      description: 'Start firing on the cron right away (--no-enabled saves it switched off)',
      allowNo: true,
      default: true,
    }),
    'stop-on-error': Flags.boolean({description: 'Switch the task off after a run fails', default: false}),
    template: Flags.string({required: true, description: 'Email template ID'}),
    ...emailAudienceFlags,
    integration: Flags.string({
      required: true,
      description: 'Email integration ID every run sends through; list them with `norbix email integrations`',
    }),
    'validation-integration': Flags.string({description: 'Email-validation integration ID — check every address first'}),
    language: Flags.string({
      description: "Send every message in this language. Must be one of the project's languages (Project settings); default: each recipient's own language, else the project default",
    }),
    'on-behalf-of': Flags.string({
      description: 'Send on behalf of this project user ID — their details fill the Initiator.User.* tokens (default: the --initiator)',
    }),
    notes: Flags.string({description: 'Internal notes'}),
    token: Flags.string({description: 'Token value as key=value (repeat for several)', multiple: true}),
    'database-integration': Flags.string({description: 'Database integration ID (defaults to the project default)'}),
    config: Flags.string({description: 'Extra campaign fields as a JSON object, @file or -'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(SchedulerSave)

    const cron = flags.cron.trim().split(/\s+/)
    if (cron.length !== 5) {
      this.error(
        `--cron needs 5 fields (${CRON_FIELDS}), got ${cron.length}: "${flags.cron}". Example: --cron "0 9 * * 1" (Mondays 09:00 UTC).`,
      )
    }

    const extra = flags.config ? await readJsonObject(flags.config, 'config') : {}
    // A flag that is left out must not wipe the same key in --config.
    const fromFlags: Record<string, unknown> = {
      templateId: flags.template,
      integrationId: flags.integration,
      validationIntegrationId: flags['validation-integration'],
      language: flags.language,
      initiatorId: flags['on-behalf-of'],
      notes: flags.notes,
      mappedTokens: parseTokens(flags.token),
      ...emailAudienceFields(flags, (message) => this.error(message)),
    }
    const campaign = {...extra, ...Object.fromEntries(Object.entries(fromFlags).filter(([, v]) => v !== undefined))}

    const client = this.client(flags)
    const what = flags.id ? `Update scheduler task ${flags.id}` : `Create scheduler task "${flags.name}"`
    await this.confirmOrFail(`${what} (cron "${cron.join(' ')}" UTC)?`, flags)

    // The generated `task` type is the base `SchedulerTaskRequest` ({type}
    // only) until @norbix.ai/ts 4.6.0 exports the email subtype, so the body
    // is cast — the same as `email campaign create`.
    const res = await client.hub.scheduler.saveSchedulerTask({
      taskId: flags.id,
      name: flags.name,
      description: flags.description,
      cron: cron.join(' '),
      initiatorUserId: flags.initiator,
      isEnabled: flags.enabled,
      stopOnError: flags['stop-on-error'],
      task: {
        type: 'EmailCampaign',
        campaign,
        databaseIntegrationId: flags['database-integration'],
      },
    } as unknown as Parameters<typeof client.hub.scheduler.saveSchedulerTask>[0])

    const id = (res as {id?: string} | undefined)?.id ?? flags.id
    this.print(id ? `Task ${id} saved.` : 'Task saved.')
    return res
  }
}
