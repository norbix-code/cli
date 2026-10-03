# Project audit, item G — CLI commands for the Project module

Branch `audit/project` from `origin/main` (da8d89d). Campaign: Norbix "Project"
coverage (gateway `audit/project`, item G = the Norbix CLI).

## Goal

A command, a route test and a doc line for every Project-settings, CORS, admin
portal, legal, public-config, project-AI, LLM / MCP integration and AI
service-user endpoint the CLI user calls from a terminal — built like the
`email` / `sms` command families.

**Not in scope:** AI plans, knowledge, credits (decided internal); expose brand
/ expose auth to the admin portal (wave 2); project create and environment
commands (own campaign); embedding integrations; AI chat / tools endpoints.

## Plan

1. docs(project): this task file — done, `docs/tasks/project-audit-cli.md`
2. feat(project): `project` topic — show, set-*, enable / disable / delete,
   tokens, cors, admin-portal, legal, public-config, project AI settings /
   assistants / usage — done, `src/commands/project/**`, `src/lib/project.ts`
3. feat(ai): `ai` topic — `ai llms` / `ai llm …`, `ai mcps` / `ai mcp …`,
   `ai service-users` / `ai service-user …` — done, `src/commands/ai/**`
4. test(project): real-transport route test for every new command plus the
   request bodies and the read-then-write commands — done,
   `tests/project-routes.test.ts`
5. docs(project): `docs/project.md`, `docs/ai.md`, README rows, COVERAGE rows
   — todo
6. chore: build, typecheck, test green; `norbix --help` shows the topics; push;
   pull request — todo

### Final command list (names aligned with the repo's convention)

The repo's convention (email / sms / push): a plural noun lists
(`sms integrations`), the singular noun with an id shows one
(`sms integration <id>`), verbs hang under the singular noun
(`sms integration enable <id>`), "set as default" is `default`, a delete asks
for confirmation unless `--yes`. Flat `set-*` verbs instead of the proposed
`languages set` / `regions set` / `default-language set`, so every project
setting reads the same way.

| command | SDK method | route |
|---|---|---|
| `project [id]` | `hub.account.getProject` | `GET /account/projects/{projectId}` |
| `project set-name <name>` | `updateProjectName` | `PATCH …/settings/name` |
| `project set-description [text] [--clear]` | `updateProjectDescription` | `PATCH …/settings/description` |
| `project set-url [url] [--clear]` | `updateProjectUrl` | `PATCH …/settings/url` |
| `project set-logo (--file-resource <json> \| --clear)` | `updateProjectLogo` | `PATCH …/settings/logo` |
| `project set-icon (--file-resource <json> \| --clear)` | `updateProjectIcon` | `PATCH …/settings/icon` |
| `project set-colors [--main] [--accent]` | `updateProjectMainColor`, `updateProjectAccentColor` | `PATCH …/settings/main-color`, `…/accent-color` |
| `project set-languages <lang>...` | `updateProjectLanguages` | `PATCH …/settings/languages` |
| `project set-default-language <lang>` | `updateProjectDefaultLanguage` | `PATCH …/settings/default-language` |
| `project set-regions --primary <r> [--additional <r>]...` | `updateProjectRegions` | `PATCH …/settings/regions` |
| `project enable` | `enableProject` | `PATCH …/enable` |
| `project disable [--yes]` | `disableProject` | `PATCH …/disable` |
| `project delete [--yes]` | `deleteProject` | `DELETE /account/projects/{projectId}` |
| `project tokens` | `getProjectTokens` | `GET …/tokens` |
| `project cors` | `getProject` (prints `allowedOrigins`) | `GET /account/projects/{projectId}` |
| `project cors set <origin>...` | `updateProjectAllowedOrigins` | `PATCH …/settings/origins` |
| `project cors add <origin>...` | `getProject` + `updateProjectAllowedOrigins` | `GET` then `PATCH …/settings/origins` |
| `project cors remove <origin>...` | `getProject` + `updateProjectAllowedOrigins` | `GET` then `PATCH …/settings/origins` |
| `project admin-portal enable` / `disable [--yes]` | `setAdminPortalEnabled` | `PUT …/admin-portal/enabled` |
| `project admin-portal structure` | `getAdminPortalStructure` | `GET …/admin-portal/structure` |
| `project admin-portal set-service-user <id>` | `assignAdminPortalServiceUser` | `PUT …/settings/admin-portal/service-user` |
| `project admin-portal set-url [url] [--clear]` | `updateProjectAdminUrl` | `PATCH …/settings/admin-url` |
| `project legal set [--terms-file] [--privacy-file] [--clear-terms] [--clear-privacy]` | (`getProject` +) `updateProjectLegalDocuments` | `PATCH …/settings/legal` |
| `project legal expose` / `hide` | `updateProjectExposeLegal` | `PATCH …/settings/legal/expose` |
| `project legal show <terms\|privacy>` | `api.public.getPublicProjectLegal` | api `GET /public/projects/{ProjectId}/legal/{Kind}` |
| `project public-config [id]` | `api.public.getPublicProjectConfig` | api `GET /public/projects/{ProjectId}/config` |
| `project ai settings` | `getProjectAiSettings` | `GET …/ai/settings` |
| `project ai settings set [--enable\|--disable] [--llm] [--model]` | `getProjectAiSettings` + `updateProjectAiSettings` | `GET` then `PUT …/ai/settings` |
| `project ai assistant create --name …` | `createProjectAiAssistant` | `POST …/ai/assistants` |
| `project ai assistant update <id> …` | `getProjectAiSettings` + `updateProjectAiAssistant` | `GET` then `PUT …/ai/assistants/{assistantId}` |
| `project ai assistant delete <id> [--yes]` | `deleteProjectAiAssistant` | `DELETE …/ai/assistants/{assistantId}` |
| `project ai usage [--top]` | `getProjectAiUsage` | `GET …/ai/usage` |
| `ai llms` | `hub.ai.getLlmIntegrations` | `GET /ai/integrations/llms/integrations` |
| `ai llm <id>` | `getLlmIntegration` | `GET /ai/integrations/llms/{id}` |
| `ai llm save --provider …` | `saveLlmIntegration` | `POST /ai/integrations/llms/` |
| `ai llm test <id>` | `testLlmIntegration` | `POST /ai/integrations/llms/test` |
| `ai llm enable` / `disable` / `default` / `delete <id>` | `enable…` / `disable…` / `setLlmIntegrationAsDefault` / `delete…` | `PUT …/{Id}/enable` · `PUT …/{Id}/disable` · `PUT …/{Id}/default` · `DELETE …/{Id}` |
| `ai mcps` | `getMcpIntegrations` | `GET /ai/integrations/mcp/integrations` |
| `ai mcp <id>` | `getMcpIntegration` | `GET /ai/integrations/mcp/{id}` |
| `ai mcp save --provider …` | `saveMcpIntegration` | `POST /ai/integrations/mcp/` |
| `ai mcp test <id>` | `testMcpIntegration` | `POST /ai/integrations/mcp/test` |
| `ai mcp enable` / `disable` / `delete <id>` | `enable…` / `disable…` / `delete…` | `PUT …/{Id}/enable` · `PUT …/{Id}/disable` · `DELETE …/{Id}` |
| `ai service-users` | `hub.account.listAiServiceUsers` | `GET /account/ai/service-users` |
| `ai service-user create --name … --reach … --rights …` | `createAiServiceUser` | `POST /account/ai/service-users` |
| `ai service-user delete <id> [--yes]` | `deleteAiServiceUser` | `DELETE /account/ai/service-users/{Id}` |
| `ai service-user rotate-key <id> [--revoke <keyId>]` | `rotateAiServiceUserKey` | `POST /account/ai/service-users/{Id}/keys` |
| `ai service-user revoke-key <id> <keyId> [--yes]` | `revokeAiServiceUserKey` | `DELETE /account/ai/service-users/{Id}/keys/{KeyId}` |

The project list stays `account projects` (`getProjects`) — no second
`project list` command (an oclif alias would repeat the `account projects`
help examples under another name, and `tests/examples.test.ts` rejects that).

## Changes

| file | what changed | plan step # |
|---|---|---|
| `docs/tasks/project-audit-cli.md` | this file | 1 |
| `src/lib/project.ts` | `ProjectCommand` base (project id from the context), confirm helper, text/file helper | 2 |
| `src/commands/project.ts`, `src/commands/project/**` | the `project` commands | 2 |
| `src/commands/ai/**` | the `ai` commands | 3 |
| `package.json` | `project` and `ai` help topics with subtopics | 2, 3 |
| `tests/project-routes.test.ts` | route + body test for every new command | 4 |
| `docs/project.md`, `docs/ai.md`, `README.md`, `COVERAGE.md` | one line per command, coverage rows | 5 |

## Findings

- fix(cli): `sms integration delete` and the other `--yes` deletes run without
  asking when stdout is not a TTY — a script that forgets `--yes` deletes.
  `project delete` here refuses without `--yes` in a non-TTY instead. Left open
  for the older commands — `src/commands/sms/integration/delete.ts:27`.
- docs(sdk): every project-scoped hub method needs `projectId` passed in the
  request (the transport does not fill `{projectId}` from the client config),
  so each command passes it explicitly — `@norbix.ai/ts` `buildUrlAndBody`. Not
  a bug, but a trap for SDK users; left open.
- fix(gateway): `UpdateProjectLegalDocuments` clears a document when its field
  is null, so a "set only terms" call wipes privacy. The CLI reads the current
  text and sends it back; the endpoint itself is left as is —
  `gateway Hub.Account/Project/Settings/Legal/UpdateLegal.cs:46`.
- fix(gateway): `UpdateProjectAiSettings` and `UpdateProjectAiAssistant` are full
  replacements (`enabled`, `memoryEnabled`, `isDefault` are plain booleans) —
  the CLI merges on top of what it reads. Left open.
- docs(cli): COVERAGE.md counts are against the old CodeMash doc tree
  (452 endpoints, 2026-07-21); the project / ai rows are counted against the
  `@norbix.ai/ts` 4.4.0 routes instead. Left open.

## Rejected / moved out

- `project list` as a second name for `account projects` — reason above.
- Expose brand / expose auth to the admin portal — wave 2. TODO: add
  `project admin-portal expose-brand|hide-brand|expose-auth|hide-auth` when the
  wave starts (endpoints not in `@norbix.ai/ts` 4.4.0 named methods yet — check
  then).
- AI plans / knowledge / credits — decided internal.

## Needs you

- [ ] Review and merge the pull request (squash).
- [ ] Optional: run one `project` and one `ai llm` command against a TEST
      project to see the real answers (the tests replace `fetch`).

## Open questions

None.
