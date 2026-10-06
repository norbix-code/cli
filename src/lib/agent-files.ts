/**
 * What `norbix ai init` writes into a project so a coding agent uses the
 * CLI correctly. Kept short on purpose: the CLI's own `--help` and
 * `norbix schema --json` are the source of truth, not these files.
 *
 * No oclif import.
 */

export const MARKER_START = '<!-- norbix-cli:start -->'
export const MARKER_END = '<!-- norbix-cli:end -->'

export type Target = 'claude' | 'agents' | 'cursor'

export interface PlannedFile {
  path: string
  /** create a new file, append a block to an existing one, or replace the block / file (--force). */
  action: 'create' | 'append' | 'replace'
  content: string
}

/** The recipe every target shares (Markdown, ~10 lines). */
export function recipeBlock(): string {
  return [
    MARKER_START,
    '## Norbix backend — use the `norbix` CLI',
    '',
    'This project uses Norbix (database, users, files, templates, campaigns, scheduler, logs). Talk to it with the `norbix` CLI from the shell; never edit the backend by hand.',
    '',
    '- Start with `norbix whoami --json`. Exit 4 means not signed in: ask the user to run `norbix login` in their own terminal. It opens the Norbix dashboard, where they pick the roles you get (an AI service user, removable under Account → AI service users). Do not run it yourself.',
    '- Pass `--json` to every command whose output you read: stdout is then exactly one JSON document (a result, or `{"error": {code, message, exit, fieldErrors, hint, docs}}`).',
    '- Discover, do not guess: `norbix schema --json` (every command, `destructive`, `supportsDryRun`), then `norbix <command> --help`. No named command? `norbix hub <module> --json` lists the SDK methods and their fields.',
    '- Before any change, run it with `--dry-run --json` (sends nothing) and show the user the request. Then re-run without `--dry-run`, adding `--yes` only for a destructive command (without it the command exits 3 and sends nothing).',
    '- Never print, paste or ask for API keys, passwords or tokens, and never read `~/.norbix`. Credentials come from `norbix login`, a `--profile`, or `NORBIX_*` variables the user set.',
    '- Branch on the exit code: 0 ok · 2 usage (fix the call) · 3 needs `--yes` · 4 auth · 5 not found · 6 validation (`fieldErrors`) · 7 network · 8 server (retry with backoff) · 9 cancelled.',
    '- Full contract: `docs/agent-contract.md` in the norbix-code/cli repo; `error.hint` and `error.docs` name the next step.',
    MARKER_END,
    '',
  ].join('\n')
}

/** Claude Code skill: frontmatter + the same rules as steps. */
export function claudeSkill(): string {
  return [
    '---',
    'name: norbix',
    'description: Use when the task touches the Norbix backend — database records, users, files, email/SMS/push templates and campaigns, scheduler tasks, logs, environments, API keys, webhooks — or when the user mentions norbix. Runs the `norbix` CLI from the shell with --json and --dry-run.',
    '---',
    '',
    '# Norbix via the CLI',
    '',
    'Use the `norbix` command for everything on the Norbix backend. It is built for agents: one JSON document per call with `--json`, documented exit codes, `--dry-run` on every change, nothing destructive without `--yes`.',
    '',
    '## Steps',
    '',
    '1. `norbix whoami --json` — who you are (with a browser sign-in: an AI service user and its expiry), the project, environment and region. Exit 4: ask the user to run `norbix login` in their own terminal; it opens the Norbix dashboard, where they pick the roles you get. Do not run `norbix login` yourself.',
    '2. Find the command: `norbix schema --json` lists every command with `destructive` and `supportsDryRun`; `norbix <command> --help` has a realistic example. No named command? `norbix hub <module> --json` (or `norbix api <module> --json`) lists the SDK methods with their fields; call one with plain words and `--body \'<json>\'`.',
    '3. Read with `--json` and parse the one document on stdout. Never parse the text output.',
    '4. Change in two steps: `norbix <command> ... --dry-run --json` prints the exact request and sends nothing — show it to the user. Then re-run without `--dry-run`, adding `--yes` only if the command is destructive. Never add `--yes` to a first attempt.',
    '5. Branch on the exit code and read `error.hint` / `error.docs`: 0 ok · 2 usage · 3 add `--yes` after a dry run · 4 auth (ask the user to `norbix login`) · 5 not found (check id / `--env` / `--project`) · 6 validation (`error.fieldErrors`) · 7 network · 8 server (retry with backoff, keep `traceId`) · 9 cancelled.',
    '',
    '## Secrets',
    '',
    'Never print, echo, paste or ask for API keys, passwords or tokens, and never read `~/.norbix`. Do not type a key into a command. Credentials come from `norbix login`, a `--profile <name>`, or `NORBIX_*` variables the user set.',
    '',
    '## Examples',
    '',
    '```sh',
    'norbix db find orders --filter \'{"status":"paid"}\' --page-size 20 --json',
    'norbix db update orders --id 66b2f0a1c3d4e5f6a7b8c9d0 --update \'{"status":"shipped"}\' --dry-run --json',
    'norbix users delete 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run --json   # then: --yes --json',
    'norbix hub scheduler --json                                      # methods + fields',
    '```',
    '',
    'Context flags on every command: `--profile`, `--project`, `--env`, `--region` (or `NORBIX_*` variables). Full contract: docs/agent-contract.md in norbix-code/cli.',
    '',
  ].join('\n')
}

/** Cursor rule file (.mdc): frontmatter + the recipe. */
export function cursorRule(): string {
  return ['---', 'description: Use the norbix CLI for anything on the Norbix backend', 'alwaysApply: false', 'globs:', '---', '', recipeBlock()].join('\n')
}

/** Files one target needs, given what is already on disk. */
export function planTarget(target: Target, exists: (path: string) => boolean, read: (path: string) => string, force: boolean): PlannedFile[] {
  switch (target) {
    case 'claude':
      return [
        fileOrReplace('.claude/skills/norbix/SKILL.md', claudeSkill(), exists, force),
        blockIn('CLAUDE.md', exists, read, force),
      ]
    case 'agents':
      return [blockIn('AGENTS.md', exists, read, force)]
    default:
      return [fileOrReplace('.cursor/rules/norbix.mdc', cursorRule(), exists, force)]
  }
}

function fileOrReplace(path: string, content: string, exists: (p: string) => boolean, force: boolean): PlannedFile {
  return {path, action: exists(path) ? (force ? 'replace' : 'create') : 'create', content}
}

/** Append the block to a Markdown file, or replace the block between the markers with --force. */
function blockIn(path: string, exists: (p: string) => boolean, read: (p: string) => string, force: boolean): PlannedFile {
  const block = recipeBlock()
  if (!exists(path)) return {path, action: 'create', content: block}
  const current = read(path)
  const start = current.indexOf(MARKER_START)
  const end = current.indexOf(MARKER_END)
  if (start !== -1 && end !== -1) {
    if (!force) return {path, action: 'append', content: block} // refused later: already present
    return {path, action: 'replace', content: current.slice(0, start) + block.trimEnd() + current.slice(end + MARKER_END.length)}
  }

  return {path, action: 'append', content: (current.endsWith('\n') ? current : current + '\n') + '\n' + block}
}

/** True when the file already carries the block (append would duplicate it). */
export function hasBlock(content: string): boolean {
  return content.includes(MARKER_START)
}
