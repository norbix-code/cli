import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../base.js'
import {readJsonInput} from '../lib/json.js'

/**
 * Raw escape hatch (like `gh api`): call ANY Norbix endpoint, including the
 * ones this CLI has no dedicated command for yet. Sends the same auth and
 * scope headers the SDK transport sends.
 */
export default class Api extends BaseCommand {
  static description = `Call any Norbix endpoint directly (escape hatch, like \`gh api\`).

Sends your auth token plus project/account/env/region headers automatically.
Use {version} in the path and it becomes v2.`

  static examples = [
    '<%= config.bin %> api /v2/logs/settings --hub',
    `<%= config.bin %> api '/{version}/database/collections/orders/count' --query filter='{"status":"paid"}'`,
    `<%= config.bin %> api /v2/scheduler/tasks --hub --method POST --body '{"name":"nightly",...}'`,
  ]

  static args = {
    path: Args.string({required: true, description: 'Endpoint path, e.g. /v2/logs or /{version}/logs'}),
  }

  static flags = {
    hub: Flags.boolean({description: 'Call the Hub service instead of the API service', default: false}),
    method: Flags.string({char: 'X', description: 'HTTP method', default: 'GET', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']}),
    body: Flags.string({char: 'b', description: 'JSON request body (or `-` for stdin)'}),
    query: Flags.string({char: 'q', description: 'Query parameter key=value (repeatable)', multiple: true}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(Api)
    const ctx = this.resolveContext(flags)
    this.assertEndpoints(ctx)

    if (!ctx.projectId) this.error('No project ID configured. Run `norbix login` or pass --project.')
    const token = ctx.bearerToken ?? ctx.apiKey
    if (!token) this.error('Not authenticated. Run `norbix login` or pass --api-key.')

    // resolveContext already applied profile overrides, defaults (.ai) and
    // the region subdomain.
    const base = flags.hub ? ctx.hubUrl : ctx.apiUrl

    const path = args.path.replace('{version}', 'v2')
    const url = new URL(base.replace(/\/$/, '') + (path.startsWith('/') ? path : `/${path}`))
    for (const pair of flags.query ?? []) {
      const eq = pair.indexOf('=')
      if (eq < 1) this.error(`--query must be key=value, got "${pair}"`)
      url.searchParams.append(pair.slice(0, eq), pair.slice(eq + 1))
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'norbix-project-id': ctx.projectId,
      'X-CM-ProjectId': ctx.projectId,
    }
    if (ctx.accountId) {
      headers['norbix-account-id'] = ctx.accountId
      headers['X-CM-AccountId'] = ctx.accountId
    }
    if (ctx.env && ctx.env !== 'PROD') headers['norbix-env'] = ctx.env
    if (ctx.region) headers['nb-region'] = ctx.region

    let body: string | undefined
    if (flags.body) {
      body = await readJsonInput(flags.body, 'body')
      headers['Content-Type'] = 'application/json'
    }

    const res = await fetch(url, {method: flags.method, headers, body})
    const text = await res.text()
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }

    if (!res.ok) {
      this.warn(`HTTP ${res.status} ${res.statusText}`)
      this.print(data)
      this.exit(1)
    }

    this.print(data)
    return data
  }
}
