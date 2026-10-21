import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

const BOOL = ['true', 'false'] as const

export default class LogsSettingsSet extends BaseCommand {
  static description = `Change the project's log settings

Only the settings you pass are sent; the server keeps the others as they are.`

  static examples = [
    '<%= config.bin %> logs settings set --skip-body true',
    '<%= config.bin %> logs settings set --skip-cloud false --ai-chat true',
    '<%= config.bin %> logs settings set --ai-chat true --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    'skip-cloud': Flags.string({
      description: 'Drop log entries from requests made by the Norbix dashboard',
      options: [...BOOL],
    }),
    'skip-body': Flags.string({
      description: 'Strip request/response bodies off http:request / http:response entries',
      options: [...BOOL],
    }),
    'ai-chat': Flags.string({description: 'Write log entries for AI chat turns', options: [...BOOL]}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(LogsSettingsSet)
    const request: {skipCloudDashboardLogs?: boolean; skipHttpBodyMeta?: boolean; aiChatLoggingEnabled?: boolean} = {}
    if (flags['skip-cloud'] !== undefined) request.skipCloudDashboardLogs = flags['skip-cloud'] === 'true'
    if (flags['skip-body'] !== undefined) request.skipHttpBodyMeta = flags['skip-body'] === 'true'
    if (flags['ai-chat'] !== undefined) request.aiChatLoggingEnabled = flags['ai-chat'] === 'true'
    if (Object.keys(request).length === 0) {
      this.error('Pass --skip-cloud, --skip-body or --ai-chat (true or false).', {exit: 2})
    }

    const client = this.client(flags)
    const res = await client.hub.logs.saveLogSettings(request)

    this.print('Log settings saved.')
    return res
  }
}
