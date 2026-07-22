# Norbix CLI — improvement plan

Updated: 2026-07-21. Three horizons: **Now** (before first npm publish),
**Next** (first weeks after publish), **Later** (when users ask for it).

## Now — before v0.1.0 on npm

Quality gates:

1. **Tests.** Add vitest (same as norbix-js). Start small: unit tests for
   `lib/store.ts` (read/write/redact), `lib/json.ts` (stdin, bad JSON), and
   `base.ts` resolution order (flag > env > file). Then one "command smoke"
   test that runs commands with a mocked fetch. Target: the logic files at
   ~100%, commands by smoke test.
2. **Lint + format.** Copy eslint.config.js and .prettierrc from norbix-js so
   both repos feel the same. Add `npm run lint` to CI.
3. **CI green on 3 OS × 3 Node versions** (workflow already added) — this is
   the real proof of "works on Mac, Ubuntu and Windows".
4. **README polish**: add an install GIF or asciinema recording, a badges row
   (CI, npm version), and a short "why CLI vs portal" paragraph.

Publish steps (first time, manual):

```sh
npm login                 # as the @norbix.ai org owner
npm pack --dry-run        # check exactly which files go into the package
npm publish --access public
npx @norbix.ai/cli --help # verify from a clean machine
```

After that, releases are just: `npm version patch && git push --follow-tags`
(the release workflow publishes with provenance).

## Next — v0.2.x

Documentation:

- **Docs site page.** Add a `cli/` section to the CodeMash/Norbix docs
  (the codemash-docs repo already has an empty `cli` folder). One page per
  topic, generated from `--help` output so it never drifts. oclif can emit a
  README command table with `oclif readme`.
- **CHANGELOG.md** — start it at v0.1.0; conventional commits make this easy.
- **2-minute quickstart** in the main product docs: install → login → first
  query.

Functionality:

- `logs list --follow` — live tail (poll every few seconds, or reuse the
  SDK's SSE client).
- `db export` / `db import` — dump a collection to a JSON/CSV file and load
  it back. Very useful for backups and TEST env seeding.
- `--output table` for list commands (compact human view; JSON stays default).
- `norbix fx` topic for code/marketplace functions (list catalog, invoke a
  binding) — 17 documented endpoints, good CLI fit.
- `env create` once a simple "clone PROD integration" shortcut exists
  server-side, plus `env promote` / `env rollback` (endpoints exist).
- Ship `email|push|sms stop` fully by publishing the newer SDK (the commands
  are ready and detect old SDKs).

## Later — v0.3+

- **Standalone binaries**: `bun build --compile` per platform in CI →
  GitHub Releases + curl install script + Homebrew tap + Scoop/winget.
  (Details and benchmarks in RESEARCH.md.)
- **Browser / device-code login** — `norbix login` opens the hub, no password
  typed in the terminal.
- **OS keychain** for tokens instead of the 0600 config file.
- **Profiles** — `norbix --profile staging ...` for people who juggle several
  projects/accounts.
- **Plugin support** — oclif plugins let other teams ship their own
  `norbix xyz` commands without touching this repo.
- **Auto-generated commands** — the SDK endpoints are generated from DTOs;
  the CLI could generate its thin list/get commands the same way
  (scripts/gen-commands.mjs is the seed of this).
- **Telemetry (opt-in)** — anonymous command usage counts to see what to
  invest in.

## Repo hygiene checklist (one-time)

- [ ] Push code to github.com/norbix-code/cli (see README "Development")
- [ ] Remove the stray `# cli` line if GitHub's starter README got merged
- [ ] `git update-index --chmod=+x bin/run.js` so the exec bit survives git
- [ ] Add NPM_TOKEN secret for the release workflow
- [ ] Branch protection on main (same ruleset as sdk-ts:
      MainBranchProtectionRuleSet.json in the sdks folder)
- [ ] Enable Dependabot / npm audit in CI
