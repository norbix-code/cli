import {mkdirSync, rmSync, writeFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'

import {Config} from '@oclif/core'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'

import {BaseCommand, type GlobalFlags, type ResolvedContext} from '../src/base.js'
import {NORBIX_DIR, PROFILES_PATH, SESSION_PATH} from '../src/lib/profiles.js'

/**
 * Which Hub and API a command talks to. NORBIX_HUB_URL / NORBIX_API_URL point
 * the CLI at a self-hosted or enterprise install without editing
 * ~/.norbix/config; an explicit --profile with its own URL still wins. A URL
 * may carry its version (`…/v3`) or not.
 */

class Probe extends BaseCommand {
  async run(): Promise<unknown> {
    return undefined
  }

  context(flags: GlobalFlags = {}): ResolvedContext {
    return this.resolveContext(flags)
  }
}

let probe: Probe

function profiles(text: string): void {
  writeFileSync(PROFILES_PATH, text)
}

function endpoints(flags: GlobalFlags = {}) {
  const ctx = probe.context(flags)
  return {apiUrl: ctx.apiUrl, hubUrl: ctx.hubUrl, apiVersion: ctx.apiVersion, hubVersion: ctx.hubVersion}
}

beforeEach(async () => {
  mkdirSync(NORBIX_DIR, {recursive: true})
  rmSync(SESSION_PATH, {force: true})
  profiles('[default]\nproject_id = p1\napi_url = http://default-api.test\nhub_url = http://default-hub.test\n\n[ci]\nproject_id = p2\nhub_url = http://ci-hub.test\n')
  const config = await Config.load(fileURLToPath(new URL('..', import.meta.url)))
  probe = new Probe([], config)
})

afterEach(() => {
  for (const name of ['NORBIX_HUB_URL', 'NORBIX_API_URL', 'NORBIX_HUB_VERSION']) delete process.env[name]
})

describe('NORBIX_HUB_URL / NORBIX_API_URL', () => {
  it('win over the [default] profile, and a /vN at the end becomes the version', () => {
    process.env.NORBIX_HUB_URL = 'https://hub.finlo.space/v3/'
    process.env.NORBIX_API_URL = 'https://api.finlo.space/v3'
    expect(endpoints()).toEqual({
      apiUrl: 'https://api.finlo.space',
      hubUrl: 'https://hub.finlo.space',
      apiVersion: 'v3',
      hubVersion: 'v3',
    })
  })

  it('a URL without a version is used as it is; the version is then discovered', () => {
    process.env.NORBIX_HUB_URL = 'https://hub.finlo.space'
    expect(endpoints()).toEqual({
      apiUrl: 'http://default-api.test',
      hubUrl: 'https://hub.finlo.space',
      apiVersion: undefined,
      hubVersion: undefined,
    })
  })

  it('an explicit --profile with its own URL wins; a URL it does not set comes from the environment', () => {
    process.env.NORBIX_HUB_URL = 'https://hub.finlo.space/v3'
    process.env.NORBIX_API_URL = 'https://api.finlo.space/v3'
    expect(endpoints({profile: 'ci'})).toEqual({
      apiUrl: 'https://api.finlo.space',
      hubUrl: 'http://ci-hub.test',
      apiVersion: 'v3',
      hubVersion: undefined,
    })
  })

  it('NORBIX_HUB_VERSION wins over the version in the URL', () => {
    process.env.NORBIX_HUB_URL = 'https://hub.finlo.space/v3'
    process.env.NORBIX_HUB_VERSION = 'v4'
    expect(endpoints().hubVersion).toBe('v4')
  })

  it('without the variables nothing changes: the [default] profile, then norbix.ai', () => {
    expect(endpoints()).toMatchObject({apiUrl: 'http://default-api.test', hubUrl: 'http://default-hub.test'})
    profiles('[default]\nproject_id = p1\n')
    expect(endpoints({region: 'nb-eu-germany'})).toMatchObject({
      apiUrl: 'https://nb-eu-germany.api.norbix.ai',
      hubUrl: 'https://nb-eu-germany.hub.norbix.ai',
    })
  })

  it('a hub_url stored with its version in a profile works too', () => {
    profiles('[default]\nproject_id = p1\nhub_url = https://hub.finlo.space/v3\n')
    expect(endpoints()).toMatchObject({hubUrl: 'https://hub.finlo.space', hubVersion: 'v3'})
  })
})

describe('the Hub of a browser sign-in', () => {
  function signIn(hubUrl?: string): void {
    writeFileSync(
      SESSION_PATH,
      JSON.stringify({bearerToken: 'a', refreshToken: 'r', clientId: 'norbix-cli', method: 'browser', hubVersion: 'v3', hubUrl}),
    )
  }

  it('later commands reach the Hub the sign-in was made against, over the [default] profile', () => {
    signIn('https://hub.finlo.space')
    expect(endpoints().hubUrl).toBe('https://hub.finlo.space')
  })

  it('NORBIX_HUB_URL still wins over the session', () => {
    signIn('https://hub.finlo.space')
    process.env.NORBIX_HUB_URL = 'https://hub.other.test'
    expect(endpoints().hubUrl).toBe('https://hub.other.test')
  })

  it('a sign-in on norbix.ai stores no URL and follows the profile as before', () => {
    signIn(undefined)
    expect(endpoints().hubUrl).toBe('http://default-hub.test')
  })
})
