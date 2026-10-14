import {mkdirSync, mkdtempSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {afterEach, beforeEach, describe, expect, it} from 'vitest'

import {findProjectConfig, projectConfigPath} from '../src/lib/project-config.js'

/** N3: the nearest `.norbix/project.json`, never the home folder's own. */

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'norbix-project-config-'))
  delete process.env.NORBIX_PROJECT_CONFIG
})
afterEach(() => {
  process.env.NORBIX_PROJECT_CONFIG = '0'
})

const write = (dir: string, body: string) => {
  mkdirSync(join(dir, '.norbix'), {recursive: true})
  writeFileSync(projectConfigPath(dir), body)
}

describe('findProjectConfig', () => {
  it('finds the file in a parent folder and normalises env to upper case', () => {
    const repo = join(root, 'repo')
    write(repo, '{"host":"cloud.example.com","projectId":"pr_1","env":"test"}')
    const deep = join(repo, 'a', 'b')
    mkdirSync(deep, {recursive: true})
    expect(findProjectConfig(deep, join(root, 'home'))).toEqual({
      path: projectConfigPath(repo),
      config: {host: 'cloud.example.com', projectId: 'pr_1', env: 'TEST'},
    })
  })

  it('the nearest one wins', () => {
    write(root, '{"projectId":"pr_outer"}')
    const inner = join(root, 'inner')
    write(inner, '{"projectId":"pr_inner"}')
    expect(findProjectConfig(inner, '/nowhere')?.config.projectId).toBe('pr_inner')
  })

  it('stops at the home folder: ~/.norbix belongs to the CLI, not to a repo', () => {
    const home = join(root, 'home')
    write(home, '{"projectId":"pr_home"}')
    const below = join(home, 'code', 'repo')
    mkdirSync(below, {recursive: true})
    expect(findProjectConfig(below, home)).toBeUndefined()
  })

  it('NORBIX_PROJECT_CONFIG=0 turns the lookup off', () => {
    write(root, '{"projectId":"pr_1"}')
    process.env.NORBIX_PROJECT_CONFIG = '0'
    expect(findProjectConfig(root, '/nowhere')).toBeUndefined()
  })

  it('broken JSON is a usage error that names the file', () => {
    write(root, '{nope')
    expect(() => findProjectConfig(root, '/nowhere')).toThrow(/project\.json is not valid JSON/)
  })
})
