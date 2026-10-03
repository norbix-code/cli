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
    '- Check who you are first: `norbix whoami --json`. If it fails with exit 4, stop and ask for credentials (`--profile <name>` or `NORBIX_API_KEY` + `NORBIX_PROJECT_ID` + `NORBIX_REGION`). Never run `norbix login` or `norbix configure` — they need a terminal.',
    '- Always pass `--json`: stdout is then exactly one JSON document (a result, or `{"error": {code, message, status, exit, fieldErrors, url, traceId, hint, docs}}`).',
    '- Discover before guessing: `norbix schema --json` (every command, `destructive`, `supportsDryRun`), then `norbix <command> --help`. Any SDK endpoint without a named command: `norbix hub <module> --json` lists methods and request fields; call with `norbix hub <module> <words...> [id] --body \'<json>\'`.',
    '- Change something only in two steps: `--dry-run` (prints the exact request, sends nothing), inspect, then re-run with `--yes` when it is destructive. Without `--yes` a destructive command exits 3 and sends nothing.',
    '- Branch on the exit code: 0 ok · 2 usage (fix the call) · 3 needs `--yes` · 4 auth · 5 not found · 6 validation (`fieldErrors`) · 7 network · 8 server (retry with backoff) · 9 cancelled.',
    '- Full contract: `docs/agent-contract.md` in the norbix-code/cli repo; the hint and docs fields of every error tell you the next step.',
    MARKER_END,
    '',
  ].join('\n')
}

/** Claude Code skill: frontmatter + the same recipe. */
export function claudeSkill(): string {
  return [
    '---',
    'name: norbix',
    'description: Use when the task touches the Norbix backend — database records, users, files, email/SMS/push templates and campaigns, scheduler tasks, logs, environments, API keys, webhooks — or when the user mentions norbix. Runs the `norbix` CLI from the shell (never the browser login).',
    '---',
    '',
    '# Norbix via the CLI',
    '',
    'Use the `norbix` command for everything on the Norbix backend. It is built for agents: one JSON document per call, documented exit codes, nothing destructive without `--yes`, and `--dry-run` on every change.',
    '',
    '## Steps',
    '',
    '1. `norbix whoami --json` — confirms the profile, project, environment and region. Exit 4 means no credentials: ask the user for `--profile <name>` or the `NORBIX_API_KEY`, `NORBIX_PROJECT_ID` and `NORBIX_REGION` variables. Do not run `norbix login` / `norbix configure`; they need a terminal.',
    '2. Find the command: `norbix schema --json` lists every command with `destructive` and `supportsDryRun`; `norbix <command> --help` has an example with real-looking values. No named command? `norbix hub <module> --json` (or `norbix api <module> --json`) lists every SDK method with its request fields; call one with plain words and `--body \'<json>\'`.',
    '3. Read with `--json` and pipe or parse the one document on stdout.',
    '4. Change in two steps: `norbix <command> ... --dry-run --json` prints the exact HTTP request and sends nothing. When it is right, re-run without `--dry-run`, adding `--yes` if the command is destructive. Never add `--yes` to the first attempt.',
    '5. Branch on the exit code, and read `error.hint` / `error.docs` on failure: 0 ok · 2 usage · 3 add `--yes` after a dry run · 4 auth · 5 not found (check id / `--env` / `--project`) · 6 validation (`error.fieldErrors`) · 7 network (check `--region`, endpoints) · 8 server (retry with backoff, keep `traceId`) · 9 cancelled.',
    '',
    '## Examples',
    '',
    '```sh',
    'norbix db find orders --filter \'{"status":"paid"}\' --page-size 20 --json',
    'norbix db update orders --id 66b2f0a1c3d4e5f6a7b8c9d0 --update \'{"$set":{"status":"shipped"}}\' --dry-run --json',
    'norbix users delete 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run --json   # then: --yes --json',
    'norbix hub scheduler --json                                      # methods + fields',
    'norbix hub scheduler task delete 66b2f0a1c3d4e5f6a7b8c9d0 --yes --json',
    '```',
    '',
    'Context flags on every command: `--profile`, `--project`, `--env`, `--region`, `--api-key` (or `NORBIX_*` env vars). Full contract: docs/agent-contract.md in norbix-code/cli.',
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
