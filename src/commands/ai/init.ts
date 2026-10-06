import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {dirname, join, resolve} from 'node:path'

import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {hasBlock, planTarget, type PlannedFile, type Target} from '../../lib/agent-files.js'
import {usageError} from '../../lib/cli-error.js'

const TARGETS: Target[] = ['claude', 'agents', 'cursor']

export default class AiInit extends BaseCommand {
  static description = `Set up this project so a coding agent uses the norbix CLI correctly.

Writes, into the current folder:
  claude   .claude/skills/norbix/SKILL.md (a Claude Code skill) and a short
           block in CLAUDE.md
  agents   the same block in AGENTS.md (Codex, OpenCode, Cursor and others
           read it)
  cursor   .cursor/rules/norbix.mdc
  all      all of the above

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
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(AiInit)
    const root = resolve(flags.dir ?? process.cwd())
    const targets: Target[] = flags.target === 'all' ? TARGETS : [flags.target as Target]

    const exists = (p: string) => existsSync(join(root, p))
    const read = (p: string) => readFileSync(join(root, p), 'utf8')
    const planned = targets.flatMap((t) => planTarget(t, exists, read, flags.force))

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

    const files = planned.map((f) => ({path: f.path, action: f.action, bytes: Buffer.byteLength(f.content)}))
    if (flags['dry-run']) {
      return this.dryRun({method: 'ai.init', request: {dir: root, targets, files}})
    }

    for (const f of planned) this.write(root, f)

    this.print(
      [
        ...files.map((f) => `${f.action === 'append' ? 'updated' : f.action === 'replace' ? 'replaced' : 'wrote'}  ${f.path}`),
        '',
        'Done. The agent now knows to use `norbix` with --json, --dry-run first, and --yes only for destructive changes.',
        'Sign in once with `norbix login` (browser: you pick the roles the agent gets in the dashboard).',
        'CI and scripts: `norbix login --api-key ... --profile <name>` or NORBIX_* variables.',
      ].join('\n'),
    )
    return {dir: root, targets, files}
  }

  private write(root: string, f: PlannedFile): void {
    const full = join(root, f.path)
    mkdirSync(dirname(full), {recursive: true})
    writeFileSync(full, f.content)
  }
}
