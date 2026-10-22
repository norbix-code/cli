import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'

export default class PushDeviceDelete extends BaseCommand {
  static description = `Delete a registered push device, whichever user it belongs to (admin)

Removes the device from its user, so it gets no more push notifications. Needs
the right to delete push devices (push:delete on push:device:all). Works in the
--env environment, on that environment's users. Find the id with
\`norbix push devices\`. A user removes their own device from the app instead.`

  static examples = [
    '<%= config.bin %> push device delete pnd_123 --env TEST --yes',
    '<%= config.bin %> push device delete pnd_123 --dry-run',
  ]

  static args = {
    id: Args.string({required: true, description: 'Device ID (pnd_…)'}),
  }

  static flags = {
    ...BaseCommand.mutatingFlags,
    'database-integration': Flags.string({description: "Database integration ID; default: the project's default for the environment"}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(PushDeviceDelete)
    const ctx = await this.freshContext(flags)
    this.assertEndpoints(ctx)

    if (!ctx.projectId) this.error('No project ID configured. Run `norbix login` or pass --project.')
    const token = ctx.bearerToken ?? ctx.apiKey
    if (!token) this.error('Not authenticated. Run `norbix login` or pass --api-key.')

    // Hub route added by gateway N48; the SDK does not know it yet, so it is
    // called directly (same headers the SDK transport sends).
    const url = new URL(`${ctx.hubUrl.replace(/\/$/, '')}/v3/notifications/push/devices/${encodeURIComponent(args.id)}`)
    if (flags['database-integration']) url.searchParams.set('databaseIntegrationId', flags['database-integration'])
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'norbix-project-id': ctx.projectId,
    }
    if (ctx.accountId) headers['norbix-account-id'] = ctx.accountId
    if (ctx.env && ctx.env !== 'PROD') headers['norbix-env'] = ctx.env
    if (ctx.region) headers['nb-region'] = ctx.region

    if (flags['dry-run']) {
      return this.dryRun({
        method: 'push device delete',
        request: {id: args.id},
        http: {method: 'DELETE', url: url.href, headers: {...headers, Authorization: 'Bearer ***'}},
      })
    }

    await this.confirmOrFail(`Delete push device ${args.id}${ctx.env ? ` in ${ctx.env}` : ''}?`, flags)

    const res = await fetch(url, {method: 'DELETE', headers})
    const text = await res.text()
    let answer: {responseStatus?: {isSuccess?: boolean; errors?: Array<{message?: string; errorCode?: string}>}} = {}
    try {
      answer = text ? JSON.parse(text) : {}
    } catch {
      this.error(`HTTP ${res.status}: ${text.slice(0, 300)}`)
    }

    if (!res.ok || answer.responseStatus?.isSuccess === false) {
      const why = answer.responseStatus?.errors?.map((e) => [e.errorCode, e.message].filter(Boolean).join(' ')).join('; ')
      const hint = res.status === 405 ? ' (this hub is older than the admin device delete — upgrade it)' : ''
      this.error(`HTTP ${res.status}${why ? `: ${why}` : ''}${hint}`)
    }

    this.print(`Push device ${args.id} deleted.`)
    return {id: args.id, deleted: true}
  }
}
