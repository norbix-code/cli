import {mkdtempSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'

/**
 * One row per Project / AI endpoint: run the command the way a user types it,
 * through oclif and the real `@norbix.ai/ts` transport, and check the verb,
 * host and path of every request it sends — and the body where the body is
 * the point.
 *
 * `fetch` is replaced, so nothing leaves the process and no LLM, MCP server or
 * project is touched. The fake answers the three reads the read-then-write
 * commands make (the project, its AI settings) with a canned body, so those
 * commands can be checked end to end: one GET, then one write.
 */

const PROJECT = 'test-project'
const ID = '66b2f0a1'
const KEY = 'key_7c2'

interface Call {
  method: string
  host: string
  path: string
  query: URLSearchParams
  body?: Record<string, unknown>
}

/** What the fake gateway holds for the project — the reads answer with this. */
const STORED_PROJECT = {
  item: {
    viewId: PROJECT,
    allowedOrigins: ['https://app.example.com', 'https://pr_test-project.admin.norbix.ai'],
    additionalRegions: [{id: 'nb-us-east'}],
    legalTermsMarkdown: '# Stored terms',
    legalPrivacyMarkdown: '# Stored privacy',
  },
}

const STORED_AI = {
  result: {
    enabled: true,
    defaultLlmIntegrationId: 'llm_1',
    defaultModel: 'gpt-4o-mini',
    assistants: [
      {
        id: ID,
        name: 'Support',
        welcomeMessage: 'Hi',
        systemPrompt: 'Be brief.',
        toolsets: ['ai:database-read'],
        llmIntegrationId: 'llm_1',
        model: 'gpt-4o-mini',
        memoryEnabled: true,
        ragSourceIds: [],
        planId: 'plan_1',
        isDefault: true,
      },
    ],
  },
}

let calls: Call[]
let realFetch: typeof globalThis.fetch

beforeEach(() => {
  calls = []
  realFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    const method = init?.method ?? 'GET'
    calls.push({
      method,
      host: url.host,
      path: url.pathname,
      query: url.searchParams,
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined,
    })
    let answer: unknown = {}
    if (method === 'GET' && url.pathname === `${P}`) answer = STORED_PROJECT
    if (method === 'GET' && url.pathname === `${P}/ai/settings`) answer = STORED_AI
    return new Response(JSON.stringify(answer), {status: 200, headers: {'Content-Type': 'application/json'}})
  }) as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
})

const globalArgs = ['--project', PROJECT, '--api-key', 'test-api-key', '--region', 'nb-eu-germany']

const HUB = 'nb-eu-germany.hub.norbix.ai'
const API = 'nb-eu-germany.api.norbix.ai'
const P = `/v2/account/projects/${PROJECT}`
const S = `${P}/settings`
const LLM = '/v2/ai/integrations/llms'
const MCP = '/v2/ai/integrations/mcp'
const SU = '/v2/account/ai/service-users'

type Route = [verb: string, path: string, host?: string]

/** [argv, requests in order] — a read-then-write command sends two. */
const routes: Array<[string[], Route[]]> = [
  // Project
  [['project'], [['GET', P]]],
  [['project', 'other-project'], [['GET', '/v2/account/projects/other-project']]],
  [['project', 'set-name', 'Shop'], [['PATCH', `${S}/name`]]],
  [['project', 'set-description', 'Orders'], [['PATCH', `${S}/description`]]],
  [['project', 'set-url', 'https://shop.example.com'], [['PATCH', `${S}/url`]]],
  [['project', 'set-logo', '--clear'], [['PATCH', `${S}/logo`]]],
  [['project', 'set-icon', '--clear'], [['PATCH', `${S}/icon`]]],
  [['project', 'set-colors', '--main', '#1F6FEB'], [['PATCH', `${S}/main-color`]]],
  [['project', 'set-colors', '--accent', '#F78166'], [['PATCH', `${S}/accent-color`]]],
  [['project', 'set-languages', 'en', 'lt'], [['PATCH', `${S}/languages`]]],
  [['project', 'set-default-language', 'lt'], [['PATCH', `${S}/default-language`]]],
  [['project', 'set-regions', '--additional', 'nb-ap-singapore'], [['PATCH', `${S}/regions`]]],
  [['project', 'enable'], [['PATCH', `${P}/enable`]]],
  [['project', 'disable', '--yes'], [['PATCH', `${P}/disable`]]],
  [['project', 'delete', '--yes'], [['DELETE', P]]],
  [['project', 'tokens'], [['GET', `${P}/tokens`]]],

  // CORS
  [['project', 'cors'], [['GET', P]]],
  [['project', 'cors', 'set', 'https://a.example.com'], [['PATCH', `${S}/origins`]]],
  [['project', 'cors', 'add', 'https://b.example.com'], [['GET', P], ['PATCH', `${S}/origins`]]],
  [['project', 'cors', 'remove', 'https://app.example.com', '--yes'], [['GET', P], ['PATCH', `${S}/origins`]]],

  // Admin portal
  [['project', 'admin-portal', 'enable'], [['PUT', `${P}/admin-portal/enabled`]]],
  [['project', 'admin-portal', 'disable', '--yes'], [['PUT', `${P}/admin-portal/enabled`]]],
  [['project', 'admin-portal', 'structure'], [['GET', `${P}/admin-portal/structure`]]],
  [['project', 'admin-portal', 'set-service-user', ID], [['PUT', `${S}/admin-portal/service-user`]]],
  [['project', 'admin-portal', 'set-url', 'https://admin.example.com'], [['PATCH', `${S}/admin-url`]]],

  // Legal + public config (the public reads go to the API host)
  [['project', 'legal', 'set', '--clear-terms', '--clear-privacy'], [['PATCH', `${S}/legal`]]],
  [['project', 'legal', 'expose'], [['PATCH', `${S}/legal/expose`]]],
  [['project', 'legal', 'hide'], [['PATCH', `${S}/legal/expose`]]],
  [['project', 'legal', 'show', 'terms'], [['GET', `/v2/public/projects/${PROJECT}/legal/terms`, API]]],
  [['project', 'public-config'], [['GET', `/v2/public/projects/${PROJECT}/config`, API]]],

  // Project AI
  [['project', 'ai', 'settings'], [['GET', `${P}/ai/settings`]]],
  [['project', 'ai', 'settings', 'set', '--disable'], [['GET', `${P}/ai/settings`], ['PUT', `${P}/ai/settings`]]],
  [['project', 'ai', 'assistant', 'create', '--name', 'Support'], [['POST', `${P}/ai/assistants`]]],
  [['project', 'ai', 'assistant', 'update', ID, '--model', 'gpt-4o'], [['GET', `${P}/ai/settings`], ['PUT', `${P}/ai/assistants/${ID}`]]],
  [['project', 'ai', 'assistant', 'delete', ID, '--yes'], [['DELETE', `${P}/ai/assistants/${ID}`]]],
  [['project', 'ai', 'usage'], [['GET', `${P}/ai/usage`]]],

  // LLM integrations
  [['ai', 'llms'], [['GET', `${LLM}/integrations`]]],
  [['ai', 'llm', ID], [['GET', `${LLM}/${ID}`]]],
  [['ai', 'llm', 'save', '--provider', 'OpenAI', '--name', 'OpenAI'], [['POST', `${LLM}/`]]],
  [['ai', 'llm', 'test', ID], [['POST', `${LLM}/test`]]],
  [['ai', 'llm', 'enable', ID], [['PUT', `${LLM}/${ID}/enable`]]],
  [['ai', 'llm', 'disable', ID, '--yes'], [['PUT', `${LLM}/${ID}/disable`]]],
  [['ai', 'llm', 'default', ID], [['PUT', `${LLM}/${ID}/default`]]],
  [['ai', 'llm', 'delete', ID, '--yes'], [['DELETE', `${LLM}/${ID}`]]],

  // MCP integrations
  [['ai', 'mcps'], [['GET', `${MCP}/integrations`]]],
  [['ai', 'mcp', ID], [['GET', `${MCP}/${ID}`]]],
  [['ai', 'mcp', 'save', '--provider', 'GitHub', '--name', 'GitHub'], [['POST', `${MCP}/`]]],
  [['ai', 'mcp', 'test', ID], [['POST', `${MCP}/test`]]],
  [['ai', 'mcp', 'enable', ID], [['PUT', `${MCP}/${ID}/enable`]]],
  [['ai', 'mcp', 'disable', ID, '--yes'], [['PUT', `${MCP}/${ID}/disable`]]],
  [['ai', 'mcp', 'delete', ID, '--yes'], [['DELETE', `${MCP}/${ID}`]]],

  // AI service users (account-level)
  [['ai', 'service-users'], [['GET', SU]]],
  [['ai', 'service-user', 'create', '--name', 'ci-bot'], [['POST', SU]]],
  [['ai', 'service-user', 'delete', ID, '--yes'], [['DELETE', `${SU}/${ID}`]]],
  [['ai', 'service-user', 'rotate-key', ID], [['POST', `${SU}/${ID}/keys`]]],
  [['ai', 'service-user', 'revoke-key', ID, KEY, '--yes'], [['DELETE', `${SU}/${ID}/keys/${KEY}`]]],

  // apikeys — the same service-user keys (the old /apikeys route answered 405)
  [['apikeys', 'list'], [['GET', SU]]],
  [['apikeys', 'create', ID], [['POST', `${SU}/${ID}/keys`]]],
  [['apikeys', 'regenerate', ID, KEY, '--yes'], [['POST', `${SU}/${ID}/keys`]]],
  [['apikeys', 'revoke', ID, KEY, '--yes'], [['DELETE', `${SU}/${ID}/keys/${KEY}`]]],
]

describe('every project and ai command reaches its route', () => {
  for (const [argv, expected] of routes) {
    it(`${argv.join(' ')} → ${expected.map(([verb, path]) => `${verb} ${path}`).join(', ')}`, async () => {
      const {error} = await runCommand([...argv, ...globalArgs])

      expect(error).toBeUndefined()
      expect(calls.map((c) => [c.method, c.path, c.host])).toEqual(
        expected.map(([verb, path, host]) => [verb, path, host ?? HUB]),
      )
    })
  }
})

it('covers all 50 project and ai routes', () => {
  // 30 project routes (28 hub under /account/projects/{projectId}, 2 public on
  // the API host) + 8 LLM + 7 MCP + 5 service-user routes, all named methods of
  // @norbix.ai/ts 4.4.0. Rows that read before they write share the GET with
  // `project` / `project ai settings`, so count distinct verb + path pairs.
  const distinct = new Set(routes.flatMap(([, reqs]) => reqs.map(([verb, path]) => `${verb} ${path}`)))
  distinct.delete('GET /v2/account/projects/other-project')
  expect(distinct.size).toBe(50)
})

/** Run a command and return the body of its LAST request (the write). */
// Note: @oclif/test's runCommand splits argv on spaces, so no test value here
// contains one.
async function bodyOf(argv: string[]): Promise<Record<string, unknown> | undefined> {
  const {error} = await runCommand([...argv, ...globalArgs])
  expect(error).toBeUndefined()
  return calls.at(-1)?.body
}

describe('project settings bodies', () => {
  it('set-name sends the name, the project id only in the path', async () => {
    expect(await bodyOf(['project', 'set-name', 'Shop'])).toEqual({name: 'Shop'})
  })

  it('set-languages sends every language as one list', async () => {
    expect(await bodyOf(['project', 'set-languages', 'en', 'lt', 'de'])).toEqual({languages: ['en', 'lt', 'de']})
  })

  it('set-colors with both flags makes two calls', async () => {
    await bodyOf(['project', 'set-colors', '--main', '#111111', '--accent', '#222222'])
    expect(calls.map((c) => [c.path, c.body])).toEqual([
      [`${S}/main-color`, {color: '#111111'}],
      [`${S}/accent-color`, {color: '#222222'}],
    ])
  })

  it('set-regions without --additional keeps the stored additional regions', async () => {
    const body = await bodyOf(['project', 'set-regions', '--primary', 'nb-eu-germany'])
    expect(calls.map((c) => c.method)).toEqual(['GET', 'PATCH'])
    expect(body).toEqual({primaryRegion: 'nb-eu-germany', additionalRegions: ['nb-us-east']})
  })

  it('set-regions --clear-additional sends an empty list without reading', async () => {
    expect(await bodyOf(['project', 'set-regions', '--clear-additional'])).toEqual({additionalRegions: []})
    expect(calls).toHaveLength(1)
  })

  it('set-logo sends the stored-file reference', async () => {
    const ref = {resource: {id: 'f1'}, integrationId: 'int_1', provider: 'Local', path: 'logo.png', isPublic: true}
    expect(await bodyOf(['project', 'set-logo', '--file-resource', JSON.stringify(ref)])).toEqual({fileResource: ref})
  })

  it('set-description refuses with nothing to set', async () => {
    const {error} = await runCommand(['project', 'set-description', ...globalArgs])
    expect(error?.message).toMatch(/--clear/)
    expect(calls).toHaveLength(0)
  })

  it('delete refuses without --yes when there is no terminal', async () => {
    const {error} = await runCommand(['project', 'delete', ...globalArgs])
    expect((error as {code?: string} | undefined)?.code).toBe('CONFIRMATION_REQUIRED')
    expect(calls).toHaveLength(0)
  })
})

describe('project cors bodies', () => {
  it('set replaces the list and asks to drop the admin portal origin only when told', async () => {
    expect(await bodyOf(['project', 'cors', 'set', 'https://a.example.com', 'b.example.com'])).toEqual({
      origins: ['https://a.example.com', 'b.example.com'],
    })
    calls = []
    expect(await bodyOf(['project', 'cors', 'set', 'https://a.example.com', '--remove-admin-portal-origin'])).toEqual({
      origins: ['https://a.example.com'],
      removeAdminPortalOrigin: true,
    })
  })

  it('add keeps the stored origins and appends the new one', async () => {
    expect(await bodyOf(['project', 'cors', 'add', 'https://b.example.com'])).toEqual({
      origins: ['https://app.example.com', 'https://pr_test-project.admin.norbix.ai', 'https://b.example.com'],
    })
  })

  it('add of an origin already allowed (no scheme, trailing slash) writes nothing', async () => {
    await bodyOf(['project', 'cors', 'add', 'app.example.com/'])
    expect(calls.map((c) => c.method)).toEqual(['GET'])
  })

  it('remove keeps the rest', async () => {
    expect(await bodyOf(['project', 'cors', 'remove', 'https://app.example.com', '--yes'])).toEqual({
      origins: ['https://pr_test-project.admin.norbix.ai'],
    })
  })
})

describe('project admin portal and legal bodies', () => {
  it('admin-portal enable / disable send enabled true / false', async () => {
    expect(await bodyOf(['project', 'admin-portal', 'enable'])).toEqual({enabled: true})
    calls = []
    expect(await bodyOf(['project', 'admin-portal', 'disable', '--yes'])).toEqual({enabled: false})
  })

  it('set-service-user sends the service user id', async () => {
    expect(await bodyOf(['project', 'admin-portal', 'set-service-user', ID])).toEqual({serviceUserId: ID})
  })

  it('legal expose / hide send exposed true / false', async () => {
    expect(await bodyOf(['project', 'legal', 'expose'])).toEqual({exposed: true})
    calls = []
    expect(await bodyOf(['project', 'legal', 'hide'])).toEqual({exposed: false})
  })

  it('legal set with one file keeps the other stored document', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'norbix-legal-'))
    const terms = join(dir, 'terms.md')
    writeFileSync(terms, '# New terms\n')
    const body = await bodyOf(['project', 'legal', 'set', '--terms-file', terms])
    expect(calls.map((c) => c.method)).toEqual(['GET', 'PATCH'])
    expect(body).toEqual({termsMarkdown: '# New terms\n', privacyMarkdown: '# Stored privacy'})
  })

  it('legal set with both files does not read first', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'norbix-legal-'))
    writeFileSync(join(dir, 't.md'), 'T')
    writeFileSync(join(dir, 'p.md'), 'P')
    const body = await bodyOf(['project', 'legal', 'set', '--terms-file', join(dir, 't.md'), '--privacy-file', join(dir, 'p.md')])
    expect(calls).toHaveLength(1)
    expect(body).toEqual({termsMarkdown: 'T', privacyMarkdown: 'P'})
  })
})

describe('project ai bodies', () => {
  it('settings set changes only what was passed', async () => {
    expect(await bodyOf(['project', 'ai', 'settings', 'set', '--model', 'gpt-4o'])).toEqual({
      enabled: true,
      defaultLlmIntegrationId: 'llm_1',
      defaultModel: 'gpt-4o',
    })
  })

  it('assistant create sends the flags with memory and default off', async () => {
    expect(await bodyOf(['project', 'ai', 'assistant', 'create', '--name', 'Support', '--toolset', 'ai:database-read', '--toolset', 'ai:files'])).toEqual({
      name: 'Support',
      toolsets: ['ai:database-read', 'ai:files'],
      memoryEnabled: false,
      isDefault: false,
    })
  })

  it('assistant update keeps every stored field it was not told to change', async () => {
    expect(await bodyOf(['project', 'ai', 'assistant', 'update', ID, '--model', 'gpt-4o', '--no-memory'])).toEqual({
      name: 'Support',
      welcomeMessage: 'Hi',
      systemPrompt: 'Be brief.',
      toolsets: ['ai:database-read'],
      llmIntegrationId: 'llm_1',
      model: 'gpt-4o',
      memoryEnabled: false,
      ragSourceIds: [],
      planId: 'plan_1',
      isDefault: true,
    })
  })

  it('assistant update of an unknown assistant writes nothing', async () => {
    const {error} = await runCommand(['project', 'ai', 'assistant', 'update', 'nope', '--model', 'x', ...globalArgs])
    expect(error?.message).toMatch(/No assistant nope/)
    expect(calls.map((c) => c.method)).toEqual(['GET'])
  })

  it('usage passes --top as a query value', async () => {
    await bodyOf(['project', 'ai', 'usage', '--top', '5'])
    expect(calls[0]?.query.get('top')).toBe('5')
  })
})

describe('ai integration bodies', () => {
  it('llm save merges --config and keeps the flags on top', async () => {
    expect(await bodyOf([
      'ai', 'llm', 'save', '--provider', 'OpenAI', '--name', 'OpenAI', '--model', 'gpt-4o-mini', '--id', ID, '--default',
      '--config', '{"apiKey":"sk-test","provider":"Ollama"}',
    ])).toEqual({
      integration: {
        apiKey: 'sk-test',
        provider: 'OpenAI',
        integrationId: ID,
        integrationName: 'OpenAI',
        defaultModel: 'gpt-4o-mini',
        isDefault: true,
        isEnabled: true,
      },
    })
  })

  it('llm test and mcp test send the integration id', async () => {
    expect(await bodyOf(['ai', 'llm', 'test', ID])).toEqual({integrationId: ID})
    calls = []
    expect(await bodyOf(['ai', 'mcp', 'test', ID])).toEqual({integrationId: ID})
  })

  it('mcp save sends the tool card and the provider fields', async () => {
    expect(await bodyOf([
      'ai', 'mcp', 'save', '--provider', 'GitHub', '--name', 'GitHub', '--server-name', 'GitHub', '--category', 'Code',
      '--description', 'Issues', '--icon', 'github', '--disabled', '--config', '{"serverUrl":"https://api.githubcopilot.com/mcp/"}',
    ])).toEqual({
      integration: {
        serverUrl: 'https://api.githubcopilot.com/mcp/',
        provider: 'GitHub',
        integrationName: 'GitHub',
        name: 'GitHub',
        category: 'Code',
        description: 'Issues',
        icon: 'github',
        isEnabled: false,
      },
    })
  })
})

describe('ai service-user bodies', () => {
  it('create with --reach project scopes it to the configured project, TEST by default', async () => {
    expect(await bodyOf(['ai', 'service-user', 'create', '--name', 'ci-bot'])).toEqual({
      name: 'ci-bot',
      scope: {reach: 'project', projectId: PROJECT, rights: 'read', envs: ['TEST']},
    })
  })

  it('create with --reach account has no project', async () => {
    expect(await bodyOf(['ai', 'service-user', 'create', '--name', 'ci-bot', '--reach', 'account', '--rights', 'admin', '--env', 'TEST', '--env', 'PROD'])).toEqual({
      name: 'ci-bot',
      scope: {reach: 'account', rights: 'admin', envs: ['TEST', 'PROD']},
    })
  })

  it('rotate-key --revoke sends the key to revoke', async () => {
    expect(await bodyOf(['ai', 'service-user', 'rotate-key', ID, '--revoke', KEY])).toEqual({revokeKeyId: KEY})
  })

  it('apikeys create issues a key and revokes nothing; regenerate revokes the replaced key in the same call', async () => {
    expect(await bodyOf(['apikeys', 'create', ID])).toBeUndefined() // no revokeKeyId: nothing is revoked
    calls.length = 0
    expect(await bodyOf(['apikeys', 'regenerate', ID, KEY, '--yes'])).toEqual({revokeKeyId: KEY})
  })

  it('apikeys list gives one row per key, with its service user', async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          items: [
            {id: 'aisu_1', name: 'ci-bot', keys: [{id: 'aisk_1', hint: 'nbsu_…a1', issuedAt: '2026-10-01T00:00:00Z'}, {id: 'aisk_2', hint: 'nbsu_…b2', issuedAt: '2026-10-02T00:00:00Z'}]},
            {id: 'aisu_2', name: 'no-keys', keys: []},
          ],
        }),
        {status: 200, headers: {'Content-Type': 'application/json'}},
      )) as typeof globalThis.fetch
    const {result, error} = await runCommand<{keys: unknown[]}>(['apikeys', 'list', ...globalArgs])
    expect(error).toBeUndefined()
    expect(result?.keys).toEqual([
      {serviceUserId: 'aisu_1', serviceUser: 'ci-bot', keyId: 'aisk_1', hint: 'nbsu_…a1', issuedAt: '2026-10-01T00:00:00Z'},
      {serviceUserId: 'aisu_1', serviceUser: 'ci-bot', keyId: 'aisk_2', hint: 'nbsu_…b2', issuedAt: '2026-10-02T00:00:00Z'},
    ])
  })
})
