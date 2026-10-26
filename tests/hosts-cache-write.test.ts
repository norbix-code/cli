import {existsSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {afterEach, describe, expect, it} from 'vitest'

import {writeJson} from '../src/lib/hosts.js'

/**
 * The host / env caches are written by every command. On Windows, renaming
 * onto a file another norbix process has open fails with EPERM; agents run
 * several commands at once, so a busy cache must never fail the command.
 */
describe('host cache writes', () => {
  let dir: string
  afterEach(() => rmSync(dir, {recursive: true, force: true}))

  const locked = (code: string): NodeJS.ErrnoException => Object.assign(new Error(`${code}: operation not permitted, rename`), {code})

  it('retries a rename the OS refuses while the file is busy', () => {
    dir = mkdtempSync(join(tmpdir(), 'norbix-cache-'))
    const path = join(dir, 'hosts', 'hub.json')
    let calls = 0
    writeJson(path, {a: 1}, (from, to) => {
      calls++
      if (calls < 3) throw locked('EPERM')
      renameSync(from, to)
    })
    expect(calls).toBe(3)
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({a: 1})
  })

  it('drops the write, without throwing or leaving a temp file, when the file stays busy', () => {
    dir = mkdtempSync(join(tmpdir(), 'norbix-cache-'))
    const path = join(dir, 'hosts', 'hub.json')
    expect(() =>
      writeJson(path, {a: 1}, () => {
        throw locked('EBUSY')
      }),
    ).not.toThrow()
    expect(existsSync(path)).toBe(false)
    expect(readdirSync(join(dir, 'hosts'))).toEqual([])
  })
})
