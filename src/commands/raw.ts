import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../base.js'
import {readJsonInput} from '../lib/json.js'

/**
 * Raw escape hatch (like `gh api`): call ANY Norbix endpoint, including the
 * ones this CLI has no dedicated command for yet. Sends the same auth and
 * scope headers the SDK transport sends.
 */
export default class Raw extends BaseCommand {
  static description = `Low-level escape hatch: call a raw HTTP path on the hub (default) or API.

Prefer \`norbix hub ...\` / \`norbix api ...\` — they take plain words.
Use this only for endpoints the SDK does not know yet. Sends your auth token
plus project/account/env/region headers automatically. Use {version} in the
path and it becomes v3.`

  static examples = [
    '<%= config.bin %> raw /v3/logs/settings',
    `<%= config.bin %> raw '/{version}/database/collections/orders/count' --api --query filter='{"status":"paid"}'`,
    `<%= config.bin %> raw /v3/scheduler/tasks --method POST --body '{"name":"nightly","cronExpression":"0 2 * * *"}' --dry-run`,
  ]

  static args = {
    path: Args.string({required: true, description: 'Endpoint path, e.g. /v3/logs or /{version}/logs'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    api: Flags.boolean({description: 'Call the data-plane API service instead of the hub (hub is the default)', default: false}),
    method: Flags.string({char: 'X', description: 'HTTP method', default: 'GET', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']}),
    body: Flags.string({char: 'b', description: 'JSON request body (inline, @file or `-` for stdin)'}),
    query: Flags.string({char: 'q', description: 'Query parameter key=value (repeatable)', multiple: true}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(Raw)
    const ctx = await this.freshContext(flags)
    this.assertEndpoints(ctx)

    if (!ctx.projectId) this.error('No project ID configured. Run `norbix login` or pass --project.')
    const token = ctx.bearerToken ?? ctx.apiKey
    if (!token) this.error('Not authenticated. Run `norbix login` or pass --api-key.')

    // resolveContext already applied profile overrides, defaults (.ai) and
    // the region subdomain.
    const base = flags.api ? ctx.apiUrl : ctx.hubUrl

    const path = args.path.replace('{version}', 'v3')
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
    }
    if (ctx.accountId) headers['norbix-account-id'] = ctx.accountId
    if (ctx.env && ctx.env !== 'PROD') headers['norbix-env'] = ctx.env
    if (ctx.region) headers['nb-region'] = ctx.region

    let body: string | undefined
    if (flags.body) {
      body = await readJsonInput(flags.body, 'body')
      headers['Content-Type'] = 'application/json'
    }

    if (flags['dry-run']) {
      return this.dryRun({
        method: `raw ${flags.method} ${path}`,
        request: body === undefined ? {} : (JSON.parse(body) as unknown),
        http: {method: flags.method, url: url.toString(), headers: {...headers, Authorization: 'Bearer ***'}, body: body === undefined ? undefined : (JSON.parse(body) as unknown)},
      })
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
