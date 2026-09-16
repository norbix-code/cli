# Norbix CLI — research and decisions

Date: 2026-07-21. This document explains why the CLI is built the way it is,
and what the next steps could be.

## 1. Goal

A custom `norbix` command-line tool on top of the existing TypeScript SDK
(`@norbix.ai/ts`). Must install on macOS and Ubuntu; Windows is a bonus.

## 2. Framework choice

Options compared:

| Framework | Pros | Cons |
| --- | --- | --- |
| **oclif** (chosen) | Used by Heroku, Salesforce, Shopify CLIs. Command topics map 1:1 to SDK namespaces (`db`, `env`, `logs`, ...). Auto help, `--json` support, shell autocomplete plugin, packaging tools (tarballs, macOS/Windows installers) for later. | Bigger install (~8 MB), more conventions to learn. |
| Commander | Most popular, tiny (<1 MB), simple. Good for 3–15 commands. | No plugin system, no packaging story, structure is on you. |
| Stricli (Bloomberg) | Very strict typing, no file-system "magic". | Young, small community, no plugins. |
| Clipanion (Yarn) | Type-safe, powers Yarn. | All commands load at startup; plugin story tied to package manager. |

Decision: **oclif**, because the Norbix CLI will grow (the hub SDK already has
~20 modules), and oclif gives structure, help, autocomplete and future
installers for free. Rule of thumb from the comparison articles: let expected
command count drive the choice — we expect many.

## 3. Install / distribution

Phase 1 (now): **npm**. `npm i -g @norbix.ai/cli` works on macOS, Ubuntu and
Windows with Node 18+. Also `npx @norbix.ai/cli` with zero install. This is
how firebase-tools and vercel ship by default.

Phase 2 (later, when users without Node appear): **standalone binaries**.
Findings from current benchmarks (Evan You's bun-vs-node-sea repo, 2026):

| Method | Binary size | Cold start | Notes |
| --- | --- | --- | --- |
| `bun build --compile --bytecode` | ~83 MB | fastest (~111 ms) | Cross-compiles for mac x64/arm64, linux x64/arm64, windows x64 from one machine |
| `bun build --compile` | ~60 MB | ~190 ms | Smallest |
| Node SEA + code cache | ~117 MB | ~140 ms | Official Node way, more build steps |
| pkg (Vercel) | — | — | Deprecated, avoid |

Recommended phase-2 path: Bun compile in CI → GitHub Releases → `curl`
install script + Homebrew tap (mac/linux) + Scoop bucket or winget (Windows).
Alternative: `oclif pack` produces tarballs and real macOS/Windows installers
with auto-update support — worth testing since we already use oclif.

## 4. Design decisions in v1

- **Auth**: two modes, same as the SDK — user login (bearer token) or API key.
  Precedence everywhere: flag > env var > config file. CI uses env vars only.
- **Secrets** stored in `config.json` with 0600 permissions. OS keychain
  (macOS Keychain / libsecret / Windows Credential Manager) is a later
  improvement; the old `keytar` package is unmaintained, today people use
  small wrappers or accept 0600 files (same as `aws` and `gh` do by default... 
  `gh` actually offers both).
- **JSON in, JSON out**: all Norbix DTOs take filters/documents as JSON
  strings, so flags accept inline JSON or `-` (stdin). Output is JSON,
  `--json` gives clean machine output for `jq`.
- **Destructive commands** (`db delete --many`, `env delete`,
  `scheduler delete`) ask for confirmation unless `--yes`.
- `env create` is not in v1 — it needs a full database-integration object;
  the portal is a better place for that today.

## 5. Ideas / next steps

1. ~~`norbix files upload/download`~~ — done (signed-URL upload flow: request URL → PUT bytes → commit).
2. **Device-code or browser login** — `norbix login` opens hub.norbix.ai,
   user confirms, CLI receives token. No password in the terminal.
3. **`norbix api <method> <path> --body '{...}'`** — raw escape hatch for any
   endpoint the CLI doesn't wrap yet (like `gh api`).
4. **`norbix logs list --follow`** — poll or use the SDK's SSE client for a
   live tail.
5. **Table output** (`--output table`) for humans; JSON stays the default for
   scripts.
6. **Homebrew tap + install script** once binaries exist (phase 2 above).
7. **Shared brain with norbix-mcp** — the MCP server and the CLI wrap the same
   SDK; command implementations could share one internal package.
8. **CI for the CLI** — build + typecheck on PR, semantic-release to npm, same
   setup as `norbix-js`.

## 6. Sources

- oclif vs commander vs custom (2026): https://dev.to/thegdsks/building-a-production-typescript-cli-in-2026-oclif-vs-commander-vs-custom-9ah
- Stricli's comparison of alternatives: https://bloomberg.github.io/stricli/docs/getting-started/alternatives
- Bun compile vs Node SEA startup benchmark: https://github.com/yyx990803/bun-vs-node-sea-startup
- oclif docs: https://oclif.io/
