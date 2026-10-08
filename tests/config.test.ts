import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'

import {fileURLToPath} from 'node:url'

import {Config} from '@oclif/core'
import {runCommand} from '@oclif/test'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {PROFILES_PATH, profileKey} from '../src/lib/profiles.js'

/**
 * One config file: `norbix config` and `env use` write profiles in
 * ~/.norbix/config (HOME is the test sandbox, see test/setup.ts) and never
 * the old ~/.config/norbix/config.json.
 */

beforeEach(() => {
  rmSync(PROFILES_PATH, {force: true})
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const ini = () => readFileSync(PROFILES_PATH, 'utf8')

describe('profileKey — one spelling in the file, both accepted', () => {
  it('maps camelCase to the file key and keeps snake_case', () => {
    expect(profileKey('projectId')).toBe('project_id')
    expect(profileKey('hubUrl')).toBe('hub_url')
    expect(profileKey('filesIntegrationId')).toBe('files_integration_id')
    expect(profileKey('hub_url')).toBe('hub_url')
    expect(profileKey('region')).toBe('region')
    expect(profileKey('bearerToken')).toBeUndefined()
  })
})

describe('norbix config set / get / unset', () => {
  it('without --profile writes the [default] profile in ~/.norbix/config, in snake_case', async () => {
    const {error} = await runCommand(['config', 'set', 'projectId', 'p1'])
    expect(error).toBeUndefined()
    expect(ini()).toBe('[default]\nproject_id = p1\n')
  })

  it('--profile writes that profile and leaves the others alone', async () => {
    await runCommand(['config', 'set', 'project_id', 'p1'])
    await runCommand(['config', 'set', 'hub_url', 'http://localhost:5001', '--profile', 'local'])
    expect(ini()).toBe('[default]\nproject_id = p1\n\n[local]\nhub_url = http://localhost:5001\n')

    const {result} = await runCommand<{value?: string}>(['config', 'get', 'hubUrl', '--profile', 'local'])
    expect(result?.value).toBe('http://localhost:5001')
    const other = await runCommand<{value?: string}>(['config', 'get', 'hub_url'])
    expect(other.result?.value).toBeUndefined()
  })

  it('unset removes the key from that profile only', async () => {
    await runCommand(['config', 'set', 'region', 'nb-eu-germany', '--profile', 'ci'])
    await runCommand(['config', 'set', 'env', 'TEST', '--profile', 'ci'])
    await runCommand(['config', 'unset', 'region', '--profile', 'ci'])
    expect(ini()).toBe('[ci]\nenv = TEST\n')
  })

  it('get redacts the API key; an unknown key is refused', async () => {
    await runCommand(['config', 'set', 'api_key', 'nbsu_abcdefghijkl'])
    const {result} = await runCommand<{value?: string}>(['config', 'get', 'apiKey'])
    expect(result?.value).toBe('nbs…jkl')
    const {error} = await runCommand(['config', 'set', 'bearerToken', 'x'])
    expect(error?.message).toMatch(/Unknown key "bearerToken"/)
  })

  it('a profile written by config set is the one commands read', async () => {
    await runCommand(['config', 'set', 'project_id', 'p-ci', '--profile', 'ci'])
    await runCommand(['config', 'set', 'api_key', 'nbsu_k', '--profile', 'ci'])
    await runCommand(['config', 'set', 'region', 'nb-eu-germany', '--profile', 'ci'])
    const sent: Headers[] = []
    vi.stubGlobal('fetch', async (_input: unknown, init?: RequestInit) => {
      sent.push(new Headers(init?.headers))
      return new Response('{"count":0}', {status: 200, headers: {'content-type': 'application/json'}})
    })
    const {error} = await runCommand(['db', 'count', 'orders', '--profile', 'ci'])
    expect(error).toBeUndefined()
    expect(sent[0]?.get('norbix-project-id')).toBe('p-ci')
    expect(sent[0]?.get('Authorization')).toBe('Bearer nbsu_k')
  })
})

describe('norbix env use without a session or profile', () => {
  it('creates the [default] profile instead of writing the old config.json', async () => {
    const {error} = await runCommand(['env', 'use', 'TEST'])
    expect(error).toBeUndefined()
    expect(ini()).toBe('[default]\nenv = TEST\n')
  })
})

describe('config list shows the old file when it still exists', () => {
  it('lists [default] and the leftovers of ~/.config/norbix/config.json', async () => {
    const config = await Config.load(fileURLToPath(new URL('..', import.meta.url)))
    const legacyDir = config.configDir
    mkdirSync(legacyDir, {recursive: true})
    writeFileSync(join(legacyDir, 'config.json'), '{"projectId":"old-p"}')
    try {
      await runCommand(['config', 'set', 'project_id', 'p1'])
      const {result} = await runCommand<{profile: string; values: Record<string, string>; legacy: Record<string, string>}>(['config', 'list'])
      const doc = result!
      expect(doc.profile).toBe('default')
      expect(doc.values.project_id).toBe('p1')
      expect(doc.legacy.projectId).toBe('old-p')
      expect(existsSync(join(legacyDir, 'config.json'))).toBe(true)
      expect(readFileSync(join(legacyDir, 'config.json'), 'utf8')).toBe('{"projectId":"old-p"}') // never written
    } finally {
      rmSync(join(legacyDir, 'config.json'), {force: true})
    }
  })
})

describe('host in a profile', () => {
  it('config set host normalizes the value and replaces the deprecated api_url / hub_url', async () => {
    writeFileSync(PROFILES_PATH, '[local]\napi_url = http://localhost:5002\nhub_url = http://localhost:5001\nproject_id = p1\n')
    const {error} = await runCommand(['config', 'set', 'host', 'localhost:5001', '--profile', 'local'])
    expect(error).toBeUndefined()
    expect(ini()).toBe('[local]\nproject_id = p1\nhost = http://localhost:5001\n')

    await runCommand(['config', 'set', 'host', 'https://cloud.example.com/', '--profile', 'example'])
    const {result} = await runCommand<{value?: string}>(['config', 'get', 'host', '--profile', 'example'])
    expect(result?.value).toBe('cloud.example.com')
  })

  it('config set host refuses plain http for a server and writes nothing', async () => {
    const {error} = await runCommand(['config', 'set', 'host', 'http://hub.example.com'])
    expect(error?.message).toBe('Plain http is only allowed for localhost, not for hub.example.com.')
    expect(existsSync(PROFILES_PATH)).toBe(false)
  })

  it('whoami names the host, the Hub and the Api the Hub reported', async () => {
    writeFileSync(PROFILES_PATH, '[default]\nhost = hub.example.com\nproject_id = p1\n')
    vi.stubGlobal('fetch', async (input: string | URL | Request) => {
      const url = String(input)
      if (url === 'https://hub.example.com/v3/echo') {
        return new Response(JSON.stringify({hubUrl: 'https://hub.example.com/v3', apiUrl: 'https://api.example.com/v3', hubVersion: 'v3', apiVersion: 'v3'}))
      }

      return new Response('{}', {status: 404})
    })
    const {result} = await runCommand<Record<string, unknown>>(['whoami', '--json'])
    expect(result).toMatchObject({
      host: 'hub.example.com',
      hostSource: 'profile [default]',
      discovery: 'discovered',
      hub: 'https://hub.example.com/v3',
      api: 'https://api.example.com/v3',
      profile: 'default',
      auth: 'none',
      projectId: 'p1',
    })
  })
})
