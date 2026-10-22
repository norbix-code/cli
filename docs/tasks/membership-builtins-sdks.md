# membership-builtins — the SDK round (10-payments B12, 2026-10-22)

Gateway `refactoringV2` d2785de9f shipped the **Norbix Membership** built-in listing (*Change roles* /
*Change tags* of the user an event is about) with the new form kind `MarketplaceFormKind.MembershipUser`.
No endpoint was added or changed — the SDK round carries one enum member. Report: gateway
`docs/tasks/membership-builtins.md`.

## Goal
Every typed SDK and the MCP manifest know `MembershipUser`; the CLI runs on the released SDK.
Not in scope: Python, Dart, Kotlin, Swift, React-Redux (untyped or no generated types — nothing to regenerate);
the coverage matrix (manifests identical, 0 new cells).

## Plan
| # | Repo | Step | Status |
|---|---|---|---|
| 1 | typegen | contract fetched from the stack's Hub / Api (705 operations, 768 types); manifests re-emitted — identical, matrix not rebuilt | done |
| 2 | sdk-ts | `sync-types:remote` → `generate-endpoints` (no-op) → `format`; vitest 1089, eslint, Prettier, tsc clean | done — #105 → **v4.34.0** |
| 3 | sdk-net | typegen csharp generator; 109 + 261 + 2 tests | done — #109 → **v3.31.0** |
| 4 | sdk-go | typegen go generator; `go test`, `go vet`, `gofmt` clean | done — #53 → **v2.35.0** |
| 5 | mcp | manifest from sdk-ts 4.34.0 (`dtos.hub.json` + `MembershipUser`), dependency ^4.34.0; 81 tests | done — pull request opened by this round |
| 6 | cli | `@norbix.ai/ts` ^4.34.0, `gen:fields` (717 methods, sdk 4.34.0); tsc clean, 1103 tests | done — this pull request |

## Changes
| repo / file | what changed |
|---|---|
| sdk-ts `src/types/{api2,hub2}.dtos.ts` | regenerated (date header, `MembershipUser`) |
| sdk-net `src/Norbix.Sdk.Types/Generated/{Api,Hub}.dtos.cs` | `MembershipUser`; the gateway-internal `/internal/_typegen` request lost its `NorbixRoute` (gateway tooling, as sdk-ts / mcp decided before) |
| sdk-go `norbix/hub/dtos/dtos.go` | `MarketplaceFormKindMembershipUser` |
| mcp `src/manifest/dtos.hub.json`, `package.json` | `MembershipUser`; `@norbix.ai/ts` ^4.34.0 |
| cli `package.json`, `src/generated/request-fields.json` | `@norbix.ai/ts` ^4.34.0; fields stamped sdk 4.34.0 |

## Findings
- gen(sdk-ts): `scripts/sync-types.mjs` and `scripts/generate-endpoints.mjs` are gitignored private tooling — a fresh worktree has none; copy them from the main checkout first. Run them in this order: sync → generate-endpoints → format; formatting before generate-endpoints leaves an 81-file diff that format then undoes.
- gen(sdk-ts): a `BaseUrl` of `localhost:5001` in the generated header is the human lane; an agent edits the header to the stack's peek port for the run and restores it.
- gen(sdk-net): `csharp/generate.py` reads the gateway, not only `contract.json` — pass `--hub-url` / `--api-url`.
- gen(cloud): the portal's `hub2.dtos.ts` (1649 types) is generated from **Community.Hub** (the stack hub), not from the Hub host (1417 types) — generating from the Hub host loses 232 types.

## Rejected / moved out
- Rebuilding the coverage matrix: the manifests are byte-identical, and the matrix measures the `sdks/` main checkouts which sit on feature branches today (`cli`, `typegen`) — the rebuild was noise and was reverted.

## Needs you
- Nothing.

## Open questions
- None.
