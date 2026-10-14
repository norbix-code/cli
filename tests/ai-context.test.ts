import {existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs'
import http from 'node:http'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest'

import {MARKER_START, recipeBlock} from '../src/lib/agent-files.js'
import {cli, parseSingleJson} from './_cli.js'

/**
 * `norbix ai context` and the agent-context copy (.norbix-ai/context.md),
 * seen from outside: the BUILT CLI against a fake Hub that answers
 * `GET /v3/account/ai/context` like the gateway (json / markdown,
 * knownVersion → unchanged). Covers the command, --write, --project, the
 * refresh after `norbix login` and after a token renewal, and that nothing is
 * written in a folder `norbix ai init` did not set up.
 */

interface Hit {
  method: string
  url: string
  auth?: string
}

let port = 0
let server: http.Server
const hits: Hit[] = []
let version = 'v1'
let contextStatus = 200

const summary = () => ({
  version,
  caller: {kind: 'ai-service-user', name: 'Norbix CLI (test)', accountId: 'acc_1'},
  projects: [
    {
      id: 'pr_alpha',
      name: 'Happy Tummy',
      access: 'full',
      defaultLanguage: 'lt',
      languages: ['lt', 'en'],
      environments: ['PROD', 'TEST'],
      corsOrigins: ['https://app.happytummy.lt'],
      modules: [{name: 'Email', integrationsReadable: true, integrations: [{id: 'int_1', name: 'SendGrid main', kind: 'SendGrid', enabled: true, defaultIn: ['PROD']}]}],
    },
  ],
  hints: ['Re-read it after your context was compressed.'],
})

const markdown = () => `# Norbix project context (version ${version})\n\n## Happy Tummy (pr_alpha)\n\n- access: full\n`

beforeAll(async () => {
  server = http.createServer((req, res) => {
    req.resume()
    req.on('end', () => {
      const url = new URL(req.url ?? '/', 'http://x')
      res.setHeader('content-type', 'application/json')
      if (url.pathname === '/.well-known/norbix.json') {
        res.statusCode = 404
        return res.end('{}')
      }

      if (url.pathname === '/v3/echo') {
        const self = `http://127.0.0.1:${port}/v3`
        return res.end(JSON.stringify({hubUrl: self, apiUrl: self, hubVersion: 'v3', apiVersion: 'v3'}))
      }

      hits.push({method: req.method ?? '', url: req.url ?? '', auth: req.headers.authorization})
      if (url.pathname === '/v3/oauth/token') {
        return res.end('{"access_token":"access-new","token_type":"Bearer","expires_in":3600,"refresh_token":"refresh-new","scope":""}')
      }

      if (url.pathname === '/v3/account/ai/context') {
        if (contextStatus !== 200) {
          res.statusCode = contextStatus
          return res.end('{"responseStatus":{"isSuccess":false,"message":"Not found"}}')
        }

        if (url.searchParams.get('knownVersion') === version) return res.end(JSON.stringify({version, unchanged: true}))
        return res.end(
          JSON.stringify(
            url.searchParams.get('format') === 'markdown' ? {version, markdown: markdown()} : {version, context: summary()},
          ),
        )
      }

      res.end('{"item":{"environments":["PROD"]}}')
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  port = typeof address === 'object' && address ? address.port : 0
})

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

beforeEach(() => {
  hits.length = 0
  version = 'v1'
  contextStatus = 200
})

/** A HOME with an api-key profile for the fake Hub; optionally a browser sign-in that expires in `secondsLeft`. */
function makeHome(opts: {session?: number} = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'norbix-ai-context-'))
  mkdirSync(join(dir, '.norbix', 'sessions'), {recursive: true})
  const profile = opts.session === undefined ? ['api_key=k'] : []
  writeFileSync(join(dir, '.norbix', 'config'), ['[default]', `host=127.0.0.1:${port}`, ...profile, 'project_id=p1', ''].join('\n'))
  if (opts.session !== undefined) {
    writeFileSync(
      join(dir, '.norbix', 'sessions', `127.0.0.1_${port}.json`),
      JSON.stringify({
        hubUrl: `http://127.0.0.1:${port}`,
        host: `127.0.0.1:${port}`,
        bearerToken: 'access-old',
        refreshToken: 'refresh-old',
        clientId: 'norbix-cli',
        method: 'browser',
        hubVersion: 'v3',
        userId: 'u1',
        userName: 'norbix-cli-test',
        displayName: 'Norbix CLI (test)',
        expiresAt: new Date(Date.now() + opts.session * 1000).toISOString(),
      }),
    )
  }

  return dir
}

/** Marks `dir` as set up by `norbix ai init` (the CLAUDE.md block). */
const markAgentFolder = (dir: string) => writeFileSync(join(dir, 'CLAUDE.md'), `# App\n\n${recipeBlock()}`)

const contextCalls = () => hits.filter((h) => h.url.startsWith('/v3/account/ai/context')).map((h) => h.url)

describe('norbix ai context', () => {
  it('--json prints the summary as one JSON document; one json call, Bearer the key', async () => {
    const home = makeHome()
    const r = await cli(home, ['ai', 'context', '--json'])
    expect(r.code).toBe(0)
    const doc = parseSingleJson(r.stdout) as {version: string; projects: Array<{name: string; access: string}>}
    expect({version: doc.version, projects: doc.projects.map((p) => `${p.name}: ${p.access}`)}).toEqual({
      version: 'v1',
      projects: ['Happy Tummy: full'],
    })
    expect(contextCalls()).toEqual(['/v3/account/ai/context?format=json'])
    expect(hits[0].auth).toBe('Bearer k')
    // The saved project is a default, not a filter: no projectId without --project.
    expect(existsSync(join(home, '.norbix-ai'))).toBe(false)
  })

  it('prints Markdown by default', async () => {
    const r = await cli(makeHome(), ['ai', 'context'])
    expect(r.code).toBe(0)
    expect(r.stdout).toBe(markdown().trimEnd() + '\n')
    expect(contextCalls()).toEqual(['/v3/account/ai/context?format=json', '/v3/account/ai/context?format=markdown'])
  })

  it('--project narrows the summary to one project', async () => {
    const r = await cli(makeHome(), ['ai', 'context', '--project', 'pr_alpha', '--json'])
    expect(r.code).toBe(0)
    expect(contextCalls()).toEqual(['/v3/account/ai/context?format=json&projectId=pr_alpha'])
  })

  it('--write saves context.md, context.json and a .gitignore that keeps them out of git', async () => {
    const home = makeHome()
    const dir = mkdtempSync(join(tmpdir(), 'norbix-ai-context-dir-'))
    const r = await cli(home, ['ai', 'context', '--write', '--dir', dir, '--json'])
    expect(r.code).toBe(0)
    expect((parseSingleJson(r.stdout) as {written: string[]}).written).toEqual(['.norbix-ai/context.md', '.norbix-ai/context.json'])
    expect(readFileSync(join(dir, '.norbix-ai/context.md'), 'utf8')).toBe(markdown())
    expect(JSON.parse(readFileSync(join(dir, '.norbix-ai/context.json'), 'utf8'))).toEqual(summary())
    expect(readFileSync(join(dir, '.norbix-ai/.gitignore'), 'utf8')).toMatch(/^\*$/m)
  })

  it('an older Hub (404) exits 5 and says the gateway is older', async () => {
    contextStatus = 404
    const r = await cli(makeHome(), ['ai', 'context', '--json'])
    expect(r.code).toBe(5)
    const err = (parseSingleJson(r.stdout) as {error: {code: string; hint: string}}).error
    expect(err.code).toBe('NOT_FOUND')
    expect(err.hint).toMatch(/older than the project-context summary/)
  })
})

describe('the agent-context copy refreshes by itself', () => {
  it('norbix login --api-key in a folder set up by ai init writes it', async () => {
    const home = mkdtempSync(join(tmpdir(), 'norbix-ai-context-login-'))
    markAgentFolder(home)
    const r = await cli(home, ['login', '--api-key', 'k', '--project', 'p1', '--host', `127.0.0.1:${port}`, '--profile', 't', '--json'])
    expect(r.code).toBe(0)
    parseSingleJson(r.stdout)
    expect(contextCalls()).toEqual(['/v3/account/ai/context?format=json', '/v3/account/ai/context?format=markdown'])
    expect(readFileSync(join(home, '.norbix-ai/context.md'), 'utf8')).toBe(markdown())
  })

  it('norbix login in a folder ai init did not set up writes nothing and calls nothing', async () => {
    const home = mkdtempSync(join(tmpdir(), 'norbix-ai-context-plain-'))
    const r = await cli(home, ['login', '--api-key', 'k', '--project', 'p1', '--host', `127.0.0.1:${port}`, '--profile', 't', '--json'])
    expect(r.code).toBe(0)
    expect(contextCalls()).toEqual([])
    expect(existsSync(join(home, '.norbix-ai'))).toBe(false)
  })

  it('a token renewal refreshes an existing copy whose version changed; stdout stays one JSON document', async () => {
    const home = makeHome({session: 30})
    markAgentFolder(home)
    mkdirSync(join(home, '.norbix-ai'))
    writeFileSync(join(home, '.norbix-ai/context.md'), 'old')
    writeFileSync(join(home, '.norbix-ai/context.json'), JSON.stringify({version: 'v0', projects: []}))

    const r = await cli(home, ['env', 'list', '--json'])
    expect(r.code).toBe(0)
    parseSingleJson(r.stdout)
    expect(contextCalls()).toEqual([
      '/v3/account/ai/context?format=json&knownVersion=v0',
      '/v3/account/ai/context?format=markdown',
    ])
    expect(hits.find((h) => h.url.startsWith('/v3/account/ai/context'))?.auth).toBe('Bearer access-new')
    expect(readFileSync(join(home, '.norbix-ai/context.md'), 'utf8')).toBe(markdown())
  })

  it('a renewal with an unchanged version rewrites nothing', async () => {
    const home = makeHome({session: 30})
    markAgentFolder(home)
    mkdirSync(join(home, '.norbix-ai'))
    writeFileSync(join(home, '.norbix-ai/context.md'), 'kept')
    writeFileSync(join(home, '.norbix-ai/context.json'), JSON.stringify({version: 'v1', projects: []}))

    const r = await cli(home, ['env', 'list', '--json'])
    expect(r.code).toBe(0)
    expect(contextCalls()).toEqual(['/v3/account/ai/context?format=json&knownVersion=v1'])
    expect(readFileSync(join(home, '.norbix-ai/context.md'), 'utf8')).toBe('kept')
  })

  it('a renewal without a copy yet does not create one', async () => {
    const home = makeHome({session: 30})
    markAgentFolder(home)
    const r = await cli(home, ['env', 'list', '--json'])
    expect(r.code).toBe(0)
    expect(contextCalls()).toEqual([])
    expect(existsSync(join(home, '.norbix-ai'))).toBe(false)
  })

  it('ai init tells the agent where the context is and how to refresh it', () => {
    expect(recipeBlock()).toContain(MARKER_START)
    expect(recipeBlock()).toContain('.norbix-ai/context.md')
    expect(recipeBlock()).toContain('norbix ai context --write')
  })
})
