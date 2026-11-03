# Workflow invoke on api — clients move (2026-11-03)

## Goal

`POST /{version}/code/workflows/{Id}/invoke` answers on api as well as the Hub (gateway 7fcaa7756, task file
`gateway/docs/tasks/code-workflows-namespace-hosts.md`, plan D-1: customer data goes through api). Move the
portal, the TS and .NET api clients and the CLI to api; check the MCP tool.

Not in scope: the other SDKs (Python, Go, Dart, Kotlin, Swift, React-Redux) — the coverage matrix shows `no` for
the api route there; an api-side `workflows.waitForRun` helper; moving the MCP workflow tools.

## Plan

1. [done] cloud: invoke in `RUNTIME_ROUTES`, the comment about the workflows worker removed, route test moved
   from Hub to api, e2e test 5 checks the panel's request goes to api. cloud refactoring1 77b06fe3.
   mocha 2859 passing, build passes; on a private stack (gateway refactoringV2 67d75f71e, this cloud worktree
   mounted) `code-workflows.spec.ts` 12 passed: the Run button's POST went to `${apiUrl}/code/workflows/{id}/invoke`.
2. [done] sdk-ts: `norbix.api.code.invokeCodeWorkflow` from `generate-endpoints` (the api types already had the route).
   https://github.com/norbix-code/sdk-ts/pull/128, v4.51.0 on npm. typecheck, lint, Prettier clean; vitest 1281 passed.
3. [dropped] sdk-net: nothing to do. The source generator already makes `InvokeCodeWorkflowAsync` on the api client
   (since cac8e65, in tag v3.46.0); the coverage matrix shows `yes` for it.
4. [done] CLI: `code workflows invoke` calls `client.api.code.invokeCodeWorkflow`; the test checks the host.
   `@norbix.ai/ts` ^4.51.0, request fields regenerated (sdk 4.51.0, 833 methods); tsc clean, `npm test` 1312 passed.
   Not run against the stack: the route test proves the host, and the other run commands already use api the same way.
5. [done] MCP: checked, no change (see Rejected).
6. [todo] typegen coverage rebuilt after the merges.

## Changes

| file | what changed | plan step # |
|---|---|---|
| cloud `src/services/hub/runtimeRoutes.ts` | `(invoke\|runs\|resume)`; comment line dropped | 1 |
| cloud `tests/services/runtimeRoutes.test.ts` | `/code/workflows/x1/invoke` moved from `HUB_ONLY` to `ON_API` | 1 |
| cloud `tests/e2e/code-workflows.spec.ts` | test 5 waits for the panel's invoke request and expects `${apiUrl}/code/workflows/{id}/invoke` | 1 |
| sdk-ts `src/api/code.ts`, `tests/api/code.test.ts`, `docs/api/code.md`, `docs/api/_index.md`, `docs/README.md` | the generated method, test and doc rows | 2 |
| cli `src/commands/code/workflows/invoke.ts` | `client.hub.code.invokeCodeWorkflow` → `client.api.code.invokeCodeWorkflow` | 4 |
| cli `tests/code-workflows-routes.test.ts` | invoke asserts the api host | 4 |
| cli `package.json`, `package-lock.json`, `src/generated/request-fields.json` | `@norbix.ai/ts` bumped, fields regenerated | 4 |

## Rejected / moved out

- `generate-endpoints` in sdk-ts also re-adds `clearContactBounce` and reorders and reformats unrelated files.
  Left out, as in the earlier rounds. Someone should decide whether `clearContactBounce` belongs on the api client.
- `invoke --follow` still polls with `client.hub.code.workflows.waitForRun` (the Hub). The Hub still serves
  `GET /code/workflows/runs/{RunId}`, so it works. An api-side helper is a hand-written addition to a generated
  file, typed to the Hub DTOs: its own change.
- MCP: every workflow tool (`norbix_invoke_code_workflow`, runs, resume, cancel, retry) is `surface: 'hub'` in
  `src/server.ts`. Moving invoke alone would split it from its siblings; the Hub still answers. No change.
- Other SDKs: the api route is `no` in Python, Go, Dart, Kotlin, Swift and React-Redux (`coverage/modules/code.md`).

## Needs you

- .NET 3.42–3.46 are tagged but not on NuGet (expired key, known); invoke on the api client ships with the next republish.

## Open questions

None.
