import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {dirname, join, resolve} from 'node:path'

import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {AGENT_FILES_VERSION, hasBlock, planTarget, targetFile, versionOf, type PlannedFile, type Target} from '../../lib/agent-files.js'
import {usageError} from '../../lib/cli-error.js'

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

The files are short on purpose: \`norbix schema --json\` and \`--help\` are the
source of truth. An existing file is never overwritten without --force; a
block that is already present is left alone. --update brings the files already
here to this CLI's version and keeps the rest of the file. --dry-run lists what
would be written.`

  static examples = [
    '<%= config.bin %> ai init',
    '<%= config.bin %> ai init --dry-run',
    '<%= config.bin %> ai init --target all',
    '<%= config.bin %> ai init --target agents --force',
    '<%= config.bin %> ai init --update',
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
    update: Flags.boolean({description: 'Rewrite only the Norbix files and blocks already here, when they are older than this CLI', default: false, exclusive: ['force', 'target']}),
    dir: Flags.string({description: 'Project folder (default: current folder)'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(AiInit)
    const root = resolve(flags.dir ?? process.cwd())
    const exists = (p: string) => existsSync(join(root, p))
    const read = (p: string) => readFileSync(join(root, p), 'utf8')
    const stale = (t: Target) => exists(targetFile(t)) && hasBlock(read(targetFile(t))) && versionOf(read(targetFile(t))) < AGENT_FILES_VERSION
    const targets: Target[] = flags.update ? TARGETS.filter((t) => stale(t)) : flags.target === 'all' ? TARGETS : [flags.target as Target]
    const planned = targets.flatMap((t) => planTarget(t, exists, read, flags.force || flags.update))

    if (flags.update && planned.length === 0) {
      this.print(`Already on version ${AGENT_FILES_VERSION}, or not set up here (run \`norbix ai init\`).`)
      return {dir: root, targets, files: []}
    }

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
        'Done. The agent now knows to build on Norbix, and to use `norbix` with --json, --dry-run first, and --yes only for destructive changes.',
        'Signing in: the agent runs `norbix login --no-browser --json` itself and shows you a link — open it, check the code, pick the roles it gets, press Allow; it finishes with `norbix login --wait`. Or sign in yourself with `norbix login`.',
        'CI and scripts: NORBIX_HOST + NORBIX_API_KEY + NORBIX_PROJECT_ID, or `norbix login --api-key ... [--host <host>] --profile <name>`.',
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
