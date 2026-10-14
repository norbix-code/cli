import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {dirname, join, resolve} from 'node:path'

import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {hasBlock, planTarget, type PlannedFile, type RepoTarget, type Target} from '../../lib/agent-files.js'
import {usageError} from '../../lib/cli-error.js'
import {storedHost} from '../../lib/hosts.js'
import {PROJECT_DIR, PROJECT_FILE, readProjectConfig} from '../../lib/project-config.js'

const TARGETS: Target[] = ['claude', 'agents', 'cursor']

export default class AiInit extends BaseCommand {
  static discoversHost = false

  static description = `Set up this project so a coding agent uses the norbix CLI correctly.

Writes, into the current folder:
  claude   .claude/skills/norbix/SKILL.md (a Claude Code skill) and a short
           block in CLAUDE.md
  agents   the same block in AGENTS.md (Codex, OpenCode, Cursor and others
           read it)
  cursor   .cursor/rules/norbix.mdc
  all      all of the above

and .norbix/project.json — the Norbix this repo belongs to: the host, the
project and (when set) the environment the CLI resolves now (--host,
--project, --env, or the profile / sign-in). No secrets; commit it. Every
\`norbix\` command run anywhere in this repo then uses that host and project
before the computer's [default] profile, so an agent can never reach another
installation by accident. The agent files name the host and project too.
--no-project-file skips it; an existing one is kept unless --force.

The files are short on purpose: \`norbix schema --json\` and \`--help\` are the
source of truth. An existing file is never overwritten without --force; a
block that is already present is left alone. --dry-run lists what would be
written.`

  static examples = [
    '<%= config.bin %> ai init',
    '<%= config.bin %> ai init --dry-run',
    '<%= config.bin %> ai init --target all',
    '<%= config.bin %> ai init --target agents --force',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    target: Flags.string({
      char: 't',
      description: 'Which agent files to write',
      options: [...TARGETS, 'all'],
      default: 'claude',
    }),
    force: Flags.boolean({description: 'Overwrite an existing skill / rule file and rewrite an existing block', default: false}),
    dir: Flags.string({description: 'Project folder (default: current folder)'}),
    'project-file': Flags.boolean({
      description: 'Write .norbix/project.json with the host, project and environment (--no-project-file to skip)',
      default: true,
      allowNo: true,
    }),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(AiInit)
    const root = resolve(flags.dir ?? process.cwd())
    const targets: Target[] = flags.target === 'all' ? TARGETS : [flags.target as Target]

    const exists = (p: string) => existsSync(join(root, p))
    const read = (p: string) => readFileSync(join(root, p), 'utf8')
    // What the CLI resolves right now (cache only, no network): the repo's target.
    const ctx = this.resolveContext(flags)
    const filePath = join(PROJECT_DIR, PROJECT_FILE)
    const kept = exists(filePath) && !flags.force ? readProjectConfig(join(root, filePath)) : undefined
    const repo: RepoTarget = kept ?? {host: storedHost(ctx.host), projectId: ctx.projectId, env: ctx.env?.toUpperCase()}
    const planned = targets.flatMap((t) => planTarget(t, exists, read, flags.force, flags['project-file'] ? repo : undefined))

    const refused = planned.filter((f) => {
      if (f.action === 'create' && exists(f.path) && !flags.force) return true
      if (f.action === 'append' && hasBlock(read(f.path))) return true
      return false
    })
    if (refused.length > 0) {
      throw usageError(
        `Already set up: ${refused.map((f) => f.path).join(', ')}.`,
        'Pass --force to rewrite the skill / rule file and the block, or --dry-run to see what would change.',
        'norbix ai init --help',
      )
    }

    if (flags['project-file'] && !kept) {
      const content = JSON.stringify(Object.fromEntries(Object.entries(repo).filter(([, v]) => v)), null, 2) + '\n'
      planned.push({path: filePath, action: exists(filePath) ? 'replace' : 'create', content})
    }

    const files = planned.map((f) => ({path: f.path, action: f.action, bytes: Buffer.byteLength(f.content)}))
    if (flags['dry-run']) {
      return this.dryRun({method: 'ai.init', request: {dir: root, targets, files, ...(flags['project-file'] ? {repo} : {})}})
    }

    for (const f of planned) this.write(root, f)

    this.print(
      [
        ...files.map((f) => `${f.action === 'append' ? 'updated' : f.action === 'replace' ? 'replaced' : 'wrote'}  ${f.path}`),
        ...(flags['project-file']
          ? [
              kept
                ? `kept   ${filePath} (pass --force to write it again)`
                : '',
              `This repo now targets ${repo.host}${repo.projectId ? `, project ${repo.projectId}` : ''}${repo.env ? `, environment ${repo.env}` : ''}.` +
                (repo.projectId ? '' : ' No project is known yet: run `norbix ai init --force --project <id>` (ids: `norbix account projects`).'),
            ].filter(Boolean)
          : []),
        '',
        'Done. The agent now knows to use `norbix` with --json, --dry-run first, and --yes only for destructive changes.',
        'Signing in: the agent runs `norbix login --no-browser --json` itself and shows you a link — open it, check the code, pick the roles it gets, press Allow; it finishes with `norbix login --wait`. Or sign in yourself with `norbix login`.',
        'CI and scripts: NORBIX_HOST + NORBIX_API_KEY + NORBIX_PROJECT_ID, or `norbix login --api-key ... [--host <host>] --profile <name>`.',
      ].join('\n'),
    )
    return {dir: root, targets, files, ...(flags['project-file'] ? {repo} : {})}
  }

  private write(root: string, f: PlannedFile): void {
    const full = join(root, f.path)
    mkdirSync(dirname(full), {recursive: true})
    writeFileSync(full, f.content)
  }
}
