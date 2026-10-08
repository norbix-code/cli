import {existsSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {beforeEach, describe, expect, it} from 'vitest'

import {claudeSkill, recipeBlock} from '../src/lib/agent-files.js'
import {cli, makeHome, parseSingleJson} from './_cli.js'

const home = makeHome(1)
let project: string

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'norbix-ai-init-'))
})

interface Report {
  dryRun?: boolean
  method?: string
  request?: {files: Array<{path: string; action: string}>}
  files?: Array<{path: string; action: string}>
}

describe('norbix ai init', () => {
  it('--dry-run lists the files and writes nothing', async () => {
    const r = await cli(home, ['ai', 'init', '--dry-run', '--dir', project, '--json'])
    expect(r.code).toBe(0)
    const doc = parseSingleJson(r.stdout) as Report
    expect(doc.dryRun).toBe(true)
    expect(doc.request?.files.map((f) => `${f.action} ${f.path}`)).toEqual(['create .claude/skills/norbix/SKILL.md', 'create CLAUDE.md'])
    expect(existsSync(join(project, '.claude'))).toBe(false)
    expect(existsSync(join(project, 'CLAUDE.md'))).toBe(false)
  })

  it('writes the skill and the CLAUDE.md block, then refuses a second run without --force', async () => {
    const first = await cli(home, ['ai', 'init', '--dir', project, '--json'])
    expect(first.code).toBe(0)
    expect((parseSingleJson(first.stdout) as Report).files?.map((f) => f.path)).toEqual(['.claude/skills/norbix/SKILL.md', 'CLAUDE.md'])

    const skill = readFileSync(join(project, '.claude/skills/norbix/SKILL.md'), 'utf8')
    expect(skill).toMatch(/^---\nname: norbix\ndescription: Use when the task touches the Norbix backend/)
    expect(skill).toContain('norbix schema --json')
    expect(skill).toContain('--dry-run')
    const claude = readFileSync(join(project, 'CLAUDE.md'), 'utf8')
    expect(claude).toContain('<!-- norbix-cli:start -->')
    expect(claude.split('\n').filter((l) => l.trim()).length).toBeLessThanOrEqual(12)

    const second = await cli(home, ['ai', 'init', '--dir', project, '--json'])
    expect(second.code).toBe(2)
    const err = (parseSingleJson(second.stdout) as {error: {message: string; hint: string}}).error
    expect(err.message).toMatch(/Already set up/)
    expect(err.hint).toMatch(/--force/)
  })

  it('appends the block to an existing CLAUDE.md without touching the rest', async () => {
    writeFileSync(join(project, 'CLAUDE.md'), '# My project\n\nKeep this.\n')
    const r = await cli(home, ['ai', 'init', '--dir', project, '--json'])
    expect(r.code).toBe(0)
    expect((parseSingleJson(r.stdout) as Report).files?.find((f) => f.path === 'CLAUDE.md')?.action).toBe('append')
    const claude = readFileSync(join(project, 'CLAUDE.md'), 'utf8')
    expect(claude.startsWith('# My project\n\nKeep this.\n')).toBe(true)
    expect(claude).toContain('<!-- norbix-cli:end -->')
  })

  it('--force rewrites the skill and replaces the block in place', async () => {
    await cli(home, ['ai', 'init', '--dir', project])
    writeFileSync(join(project, '.claude/skills/norbix/SKILL.md'), 'stale')
    const claude = readFileSync(join(project, 'CLAUDE.md'), 'utf8')
    writeFileSync(join(project, 'CLAUDE.md'), `# Top\n\n${claude}\n# Bottom\n`)

    const r = await cli(home, ['ai', 'init', '--dir', project, '--force', '--json'])
    expect(r.code).toBe(0)
    expect(readFileSync(join(project, '.claude/skills/norbix/SKILL.md'), 'utf8')).not.toBe('stale')
    const after = readFileSync(join(project, 'CLAUDE.md'), 'utf8')
    expect(after.startsWith('# Top\n')).toBe(true)
    expect(after.endsWith('# Bottom\n')).toBe(true)
    expect(after.split('<!-- norbix-cli:start -->').length).toBe(2)
  })

  it('--target all writes AGENTS.md and the Cursor rule too', async () => {
    const r = await cli(home, ['ai', 'init', '--target', 'all', '--dir', project, '--json'])
    expect(r.code).toBe(0)
    expect((parseSingleJson(r.stdout) as Report).files?.map((f) => f.path)).toEqual([
      '.claude/skills/norbix/SKILL.md',
      'CLAUDE.md',
      'AGENTS.md',
      '.cursor/rules/norbix.mdc',
    ])
    expect(readFileSync(join(project, '.cursor/rules/norbix.mdc'), 'utf8')).toMatch(/^---\ndescription: /)
  })

  it('the block and the skill carry the rules: two-step browser sign-in approved by the user, --json, --dry-run first, no secrets', async () => {
    const r = await cli(home, ['ai', 'init', '--target', 'all', '--dir', project])
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('Signing in: the agent runs `norbix login --no-browser --json` itself and shows you a link')

    const block = readFileSync(join(project, 'AGENTS.md'), 'utf8')
    const bullets = block.split('\n').filter((l) => l.startsWith('- '))
    expect(bullets.map((l) => l.slice(0, 40))).toEqual([
      '- Start with `norbix whoami --json`. Exi',
      '- Pass `--json` to every command whose o',
      '- Discover, do not guess: `norbix schema',
      '- Before any change, run it with `--dry-',
      '- Never print, paste or ask for API keys',
      '- Branch on the exit code: 0 ok · 2 usag',
      '- Full contract: `docs/agent-contract.md',
    ])
    expect(bullets[0]).toContain('run `norbix login --no-browser --json`, show the user the `verificationUriComplete` link and the `userCode`')
    expect(bullets[0]).toContain('pick the roles you get')
    expect(bullets[0]).toContain('Account → AI service users')
    expect(bullets[3]).toContain('show the user the request')
    expect(block).not.toMatch(/norbix login --api-key|nbk_/)
    expect(block.split('\n').filter((l) => l.trim()).length).toBeLessThanOrEqual(12)

    const skill = readFileSync(join(project, '.claude/skills/norbix/SKILL.md'), 'utf8')
    expect(skill).toContain('## Secrets\n\nNever print, echo, paste or ask for API keys, passwords or tokens')
    expect(skill).toContain('Exit 4: sign in in two steps (your shell commands time out; the code lives 10 minutes):')
    expect(skill).toContain('Show the user the link and the code: they open it, check the code, pick the roles you get, and press Allow. Never open the link yourself.')
    expect(skill).toContain('`norbix <command> ... --dry-run --json` prints the exact request and sends nothing — show it to the user.')
    expect(skill).not.toMatch(/--api-key|nbk_/)
    expect(skill.split('\n').length).toBeLessThanOrEqual(40)

    expect(readFileSync(join(project, '.cursor/rules/norbix.mdc'), 'utf8')).toContain(bullets[4])
  })

  it('rejects an unknown target with exit 2', async () => {
    const r = await cli(home, ['ai', 'init', '--target', 'emacs', '--dir', project, '--json'])
    expect(r.code).toBe(2)
  })
})

describe('the agent rules: sign in in two steps, CI with a key', () => {
  it('the block tells the agent to start the sign-in, show the link, and wait — never to hand login to the user only', () => {
    const block = recipeBlock()
    expect(block).toContain('`norbix login --no-browser --json`')
    expect(block).toContain('`norbix login --wait --json`')
    expect(block).toContain('`AUTHORIZATION_PENDING`')
    expect(block).toContain('`--host <their dashboard address>`')
    expect(block).toContain('`NORBIX_HOST` + `NORBIX_API_KEY` + `NORBIX_PROJECT_ID`')
    expect(block).not.toContain('Do not run it yourself')
  })

  it('the Claude skill has the same two steps and the exit codes that drive them', () => {
    const skill = claudeSkill()
    expect(skill).toContain('`norbix login --no-browser --json` → `{userCode, verificationUriComplete, expiresIn}`')
    expect(skill).toContain('Exit 4 `AUTHORIZATION_PENDING`: not approved yet, run it again.')
    expect(skill).toContain('`ACCESS_DENIED` or `EXPIRED_TOKEN`: start over with step one.')
    expect(skill).toContain('Context flags on every command: `--host`, `--profile`')
  })
})

describe('norbix --version', () => {
  it('prints the oclif-style user agent', async () => {
    const r = await cli(home, ['--version'])
    expect(r.code).toBe(0)
    expect(r.stdout).toMatch(/^@norbix\.ai\/cli\/\d+\.\d+\.\d+ \w+-\w+ node-v\d+/)
  })
})
