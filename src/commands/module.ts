import {confirm} from '@inquirer/prompts'
import {Norbix} from '@norbix.ai/ts'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../base.js'

const MODULES: Record<string, {enable: (c: Norbix) => Promise<unknown>; disable: (c: Norbix) => Promise<unknown>}> = {
  code: {enable: (c) => c.hub.code.enableCode({}), disable: (c) => c.hub.code.disableCode({})},
  database: {enable: (c) => c.hub.database.enableDatabase({}), disable: (c) => c.hub.database.disableDatabase({})},
  email: {enable: (c) => c.hub.notifications.enableEmail({}), disable: (c) => c.hub.notifications.disableEmail({})},
  files: {enable: (c) => c.hub.files.enableFiles({}), disable: (c) => c.hub.files.disableFiles({})},
  logs: {enable: (c) => c.hub.logs.enableLogging({}), disable: (c) => c.hub.logs.disableLogging({})},
  membership: {enable: (c) => c.hub.membership.enableMembership({}), disable: (c) => c.hub.membership.disableMembership({})},
  payments: {enable: (c) => c.hub.payments.enablePayments({}), disable: (c) => c.hub.payments.disablePayments({})},
  push: {enable: (c) => c.hub.notifications.enablePush({}), disable: (c) => c.hub.notifications.disablePush({})},
  scheduler: {enable: (c) => c.hub.scheduler.enableScheduler({}), disable: (c) => c.hub.scheduler.disableScheduler({})},
  sms: {enable: (c) => c.hub.notifications.enableSms({}), disable: (c) => c.hub.notifications.disableSms({})},
}

export default class Module extends BaseCommand {
  static description = 'Enable or disable a whole project module'

  static examples = [
    '<%= config.bin %> module enable database',
    '<%= config.bin %> module disable sms --yes',
  ]

  static args = {
    action: Args.string({required: true, description: 'enable or disable', options: ['enable', 'disable']}),
    name: Args.string({
      required: true,
      description: `One of: ${Object.keys(MODULES).sort().join(', ')}`,
      options: Object.keys(MODULES).sort(),
    }),
  }

  static flags = {
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt (disable only)', default: false}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(Module)
    const client = this.client(flags)

    if (args.action === 'disable' && !flags.yes && process.stdout.isTTY) {
      const ok = await confirm({
        message: `Disable the "${args.name}" module for this project?`,
        default: false,
      })
      if (!ok) return this.print('Cancelled.')
    }

    const res = await MODULES[args.name][args.action as 'enable' | 'disable'](client)
    this.print(`Module ${args.name} ${args.action}d.`)
    return res
  }
}
