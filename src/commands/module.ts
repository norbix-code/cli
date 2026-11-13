import {Norbix} from '@norbix.ai/ts'
import {Args} from '@oclif/core'

import {BaseCommand} from '../base.js'
import {usageError} from '../lib/cli-error.js'

/** Membership and Database are always on: the gateway has no disable route for them. */
export const ALWAYS_ON_MESSAGE = 'Membership and Database are always on; they cannot be disabled.'

const MODULES: Record<string, {enable: (c: Norbix) => Promise<unknown>; disable?: (c: Norbix) => Promise<unknown>}> = {
  code: {enable: (c) => c.hub.code.enableCode({}), disable: (c) => c.hub.code.disableCode({})},
  database: {enable: (c) => c.hub.database.enableDatabase({})},
  email: {enable: (c) => c.hub.notifications.enableEmail({}), disable: (c) => c.hub.notifications.disableEmail({})},
  files: {enable: (c) => c.hub.files.enableFiles({}), disable: (c) => c.hub.files.disableFiles({})},
  logs: {enable: (c) => c.hub.logs.enableLogging({}), disable: (c) => c.hub.logs.disableLogging({})},
  membership: {enable: (c) => c.hub.membership.enableMembership({})},
  payments: {enable: (c) => c.hub.payments.enablePayments({}), disable: (c) => c.hub.payments.disablePayments({})},
  push: {enable: (c) => c.hub.notifications.enablePush({}), disable: (c) => c.hub.notifications.disablePush({})},
  scheduler: {enable: (c) => c.hub.scheduler.enableScheduler({}), disable: (c) => c.hub.scheduler.disableScheduler({})},
  sms: {enable: (c) => c.hub.notifications.enableSms({}), disable: (c) => c.hub.notifications.disableSms({})},
}

export default class Module extends BaseCommand {
  static description = 'Enable or disable a whole project module (Membership and Database are always on: enable only)'

  static examples = [
    '<%= config.bin %> module enable database',
    '<%= config.bin %> module disable sms --yes',
    '<%= config.bin %> module enable database --dry-run',
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
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(Module)
    const module = MODULES[args.name]

    // Refused here, before any request: there is no route to call.
    if (args.action === 'disable' && !module.disable) {
      throw usageError(ALWAYS_ON_MESSAGE, `Only these modules can be disabled: ${disableable().join(', ')}.`)
    }

    const client = this.client(flags)

    if (args.action === 'disable') {
      await this.confirmOrFail(`Disable the "${args.name}" module for this project?`, flags)
    }

    const send = args.action === 'disable' ? module.disable! : module.enable
    const res = await send(client)
    this.print(`Module ${args.name} ${args.action}d.`)
    return res
  }
}

function disableable(): string[] {
  return Object.keys(MODULES)
    .filter((name) => MODULES[name].disable)
    .sort()
}
