import {execFile} from 'node:child_process'
import {mkdirSync, mkdtempSync, writeFileSync} from 'node:fs'
import http from 'node:http'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'

import {seedDefaultHost} from '../test/seed.js'

/**
 * Test seam for the agent contract: the BUILT CLI is run as a child process
 * (stdin, stdout and stderr are pipes — exactly what a coding agent or a
 * script sees) against a fake gateway on a free local port. Nothing else is
 * contacted. Exit codes, stdout/stderr separation and the JSON envelope are
 * observed from the outside, as an agent would observe them.
 */

export const CLI = fileURLToPath(new URL('../bin/run.js', import.meta.url))

export interface Hit {
  method: string
  url: string
  body: string
}

export interface FakeGateway {
  port: number
  hits: Hit[]
  close: () => Promise<void>
}

/**
 * A gateway that answers by path: `answers[path]` when given, else
 * missing→404, bad→400, unauth→401, boom→500, else 200 {ok:true}.
 */
export async function startFakeGateway(answers: Record<string, unknown> = {}): Promise<FakeGateway> {
  const hits: Hit[] = []
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      res.setHeader('content-type', 'application/json')
      const url = req.url ?? ''
      // Discovery (`--host 127.0.0.1:<port>`): no well-known file, so the
      // host is the Hub; /echo names this server as Hub and Api. Not a hit.
      if (url === '/.well-known/norbix.json') {
        res.statusCode = 404
        return res.end('{}')
      }

      if (url === '/v3/echo') {
        const self = `http://127.0.0.1:${port}/v3`
        return res.end(JSON.stringify({hubUrl: self, apiUrl: self, hubVersion: 'v3', apiVersion: 'v3', regions: []}))
      }

      hits.push({method: req.method ?? '', url, body})
      const answer = answers[url.split('?')[0]]
      if (answer !== undefined) return res.end(JSON.stringify(answer))
      if (url.includes('missing')) {
        res.statusCode = 404
        return res.end('{"message":"User not found","code":"USER_NOT_FOUND","traceId":"t-1"}')
      }

      if (url.includes('bad')) {
        res.statusCode = 400
        return res.end('{"message":"Validation failed","errors":{"email":["is required"]}}')
      }

      if (url.includes('unauth')) {
        res.statusCode = 401
        return res.end('{"message":"bad key"}')
      }

      if (url.includes('boom')) {
        res.statusCode = 500
        return res.end('{"responseStatus":{"errorCode":"CM-ERRORS-INTERNAL","message":"boom","meta":{"correlationId":"c-9"}}}')
      }

      res.end('{"ok":true}')
    })
  })
  let port = 0
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  port = typeof address === 'object' && address ? address.port : 0
  return {
    port,
    hits,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  }
}

/**
 * A HOME with four profiles:
 *   x       → the fake gateway
 *   y       → a closed port (network error)
 *   noauth  → the fake gateway, no api key
 *   z       → default norbix.ai endpoints, no region (context error)
 */
export function makeHome(port: number): string {
  const home = mkdtempSync(join(tmpdir(), 'norbix-agent-'))
  mkdirSync(join(home, '.norbix'), {recursive: true})
  writeFileSync(
    join(home, '.norbix', 'config'),
    [
      '[x]',
      `host=127.0.0.1:${port}`,
      'api_key=k',
      'project_id=p',
      '[y]',
      'host=127.0.0.1:1',
      'api_key=k',
      'project_id=p',
      '[noauth]',
      `host=127.0.0.1:${port}`,
      'project_id=p',
      '[z]',
      'api_key=k',
      'project_id=p',
      '',
    ].join('\n'),
  )
  seedDefaultHost(home)
  return home
}

export interface CliResult {
  code: number
  stdout: string
  stderr: string
}

/** Run the built CLI with pipes for every stream (non-interactive). */
export function cli(home: string, args: string[], env: Record<string, string | undefined> = {}): Promise<CliResult> {
  return new Promise((resolve) => {
    const child = execFile(
      process.execPath,
      [CLI, ...args],
      {
        env: {...process.env, HOME: home, USERPROFILE: home, CI: undefined, NO_COLOR: undefined, FORCE_COLOR: undefined, ...env},
        cwd: home,
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        const code = error && typeof (error as {code?: unknown}).code === 'number' ? ((error as {code: number}).code) : 0
        resolve({code, stdout: String(stdout), stderr: String(stderr)})
      },
    )
    child.stdin?.end()
  })
}

/** Run jobs with a small concurrency so a loaded machine still finishes. */
export async function pool<T, R>(items: T[], limit: number, job: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = Array.from({length: items.length})
  let next = 0
  const workers = Array.from({length: Math.min(limit, items.length)}, async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await job(items[i])
    }
  })
  await Promise.all(workers)
  return results
}

/** stdout must be exactly one JSON document. */
export function parseSingleJson(stdout: string): unknown {
  const parsed = JSON.parse(stdout) as unknown
  // JSON.parse would already throw on two documents; also refuse leading text.
  if (!/^\s*[{[]/.test(stdout)) throw new Error(`stdout is not a JSON document: ${stdout.slice(0, 80)}`)
  return parsed
}
