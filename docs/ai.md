# `norbix ai`

Manage the AI integrations of a project (LLM providers, MCP servers), the
account's AI service users, and list or call the AI tools. The project's AI
chat settings and assistants (the end-user chat) are under `norbix project ai`
([docs/project.md](project.md)).

There is no developer chat in Cloud and no `ai chat` command: developers
connect their own AI tool (Claude Code, Cursor, …) to Norbix over MCP (the
Hub's developer MCP endpoint), or let it run this CLI — `norbix ai init` sets
that up ([docs/AGENTS.md](AGENTS.md)).

Every command is covered by `tests/project-routes.test.ts`, which runs it
through the real SDK with `fetch` replaced and checks the verb and path it
sends, and the save / create bodies. The LLM, MCP and tool commands are
also in `tests/ai-cluster-routes.test.ts`, which checks the host, verb, exact
path, query and body of every request. No test contacts an LLM provider or an
MCP server.

## LLM integrations

All paths are under `/{version}/ai/integrations/llms`.

| command | what it does | endpoint |
|---|---|---|
| `norbix ai llms [--page-size <n>] [--after <cursor>]` | list the integrations | `GET /integrations` |
| `norbix ai llm <id>` | show one | `GET /{id}` |
| `norbix ai llm save --provider <p> --name <n> [--id <id>] [--endpoint <url>] [--model <m>] [--default] [--disabled] [--config <json>]` | create or update one | `POST /` |
| `norbix ai llm test <id>` | live call to the provider | `POST /test` |
| `norbix ai llm enable <id>` | turn it on | `PUT /{Id}/enable` |
| `norbix ai llm disable <id>` | turn it off | `PUT /{Id}/disable` |
| `norbix ai llm default <id>` | make it the project default | `PUT /{Id}/default` |
| `norbix ai llm delete <id> [--yes]` | delete it | `DELETE /{Id}` |

`--provider` is one of `OpenAI`, `Anthropic`, `Ollama`, `Groq`, `Google`,
`Mistral`, `OpenRouter`, `Grok`, `NorbixHosted`. Put the provider-specific
fields (`apiKey`, `models`, …) in `--config` as a JSON object (inline,
`@file.json`, or `-` for stdin); the flags win over the same keys in it.

```bash
norbix ai llm save --provider OpenAI --name OpenAI --model gpt-4o-mini --config @openai.json
norbix ai llm test llm_123
norbix ai llm default llm_123
```

## MCP server integrations

All paths are under `/{version}/ai/integrations/mcp`.

| command | what it does | endpoint |
|---|---|---|
| `norbix ai mcps [--page-size <n>] [--after <cursor>]` | list the integrations | `GET /integrations` |
| `norbix ai mcp <id>` | show one | `GET /{id}` |
| `norbix ai mcp save --provider <p> --name <n> --server-name <s> --category <c> --description <d> --icon <i> [--id <id>] [--disabled] [--config <json>]` | create or update one | `POST /` |
| `norbix ai mcp test <id>` | connect to the server | `POST /test` |
| `norbix ai mcp enable <id>` | turn it on | `PUT /{Id}/enable` |
| `norbix ai mcp disable <id>` | turn it off | `PUT /{Id}/disable` |
| `norbix ai mcp delete <id> [--yes]` | delete it | `DELETE /{Id}` |

**Deprecated on the gateway.** Project MCP integrations moved to the Code
Marketplace (the "MCP server" listing, `norbix code marketplace`). The gateway
still serves these routes, but `ai mcp save` is always refused
(`CM-ERRORS-MARKETPLACE-030`) and stores nothing; list, show, test, enable,
disable and delete still work on the integrations that exist.

`--provider` is one of `GitHub`, `Stripe`, `MongoDb`, `Playwright`,
`BraveSearch`, `Obsidian` — the provider also fixes how the gateway talks to
the server (HTTP or a local command). The server needs the tool card
(`--server-name`, `--category`, `--description`, `--icon`). Provider fields
(`serverUrl`, a token, `command`, …) go in `--config`.

## AI service users

An AI service user is the identity an AI client (an MCP client with an API
key) acts under. They belong to the account, so these commands do not need a
project. All paths are under `/{version}/account/ai/service-users`.

| command | what it does | endpoint |
|---|---|---|
| `norbix ai service-users` | list them (keys as id + hint, never the key) | `GET /` |
| `norbix ai service-user create --name <n> [--account-role <roleId>]... [--project-role <roleId>]...` | create one with its roles and print its first key (shown once) | `POST /` |
| `norbix ai service-user delete <id> [--yes]` | delete it; its keys stop working | `DELETE /{Id}` |
| `norbix ai service-user rotate-key <id> [--revoke <keyId>]` | issue a new key (shown once), optionally revoke an old one | `POST /{Id}/keys` |
| `norbix ai service-user revoke-key <id> <keyId> [--yes]` | revoke one key | `DELETE /{Id}/keys/{KeyId}` |

What the user may do comes from roles: `--account-role` gives it an account
team role, `--project-role` a role of the configured project (or `--project`).
Repeat either flag for several roles; at least one is needed. (Until
`@norbix.ai/ts` 4.17 the command took `--reach` / `--rights` / `--env`; the
gateway replaced that scope with roles.)

```bash
norbix ai service-user create --name "Claude Code on my laptop" --project-role rl_reader
norbix ai service-user rotate-key su_123 --revoke key_old
```

## Templates to read before you design

What Norbix already has as a worked example: the app templates (a whole
backend: blog, CRM, HR …) and the schema registry (reviewed collection shapes:
employees, blog_posts, orders …). Read them before you design a new app or a
new collection, then decide what to reuse. Reading creates nothing.

| Command | What it does | AI tool it calls |
|---|---|---|
| `norbix ai templates [words]` | the app template cards: id, version, tags, collections, summary; templates whose tags match the words come first | `get_app_templates` |
| `norbix ai template <id> [--specs]` | one template's guide (Markdown): modules, collections, roles, automations, build order; `--specs` adds the collection specs | `get_app_template` |
| `norbix ai schema-templates [words] [--take <n>]` | search the registry by keyword; each hit says where it matched, what it uses and what is related | `search_schema_templates` |
| `norbix ai schema-template <ids> [--depth <0-3>]` | the full shape of the named entities and their related ones (10 at most) | `get_entity_graph` |

- Each command sends one request, `POST /{version}/account/ai/tools/{ToolName}`,
  on the account-level client. The four tools only read, so nothing asks first.
- `--json` prints one document; a collection spec and an entity's
  intermediate-format document come as JSON objects.
- The answers are files that ship with the gateway, the same for every account.
- An installation whose gateway is older than these tools answers "unknown
  tool"; the command says so and exits non-zero. Check with `norbix ai tools`.

```bash
norbix ai templates "hr portal"
norbix ai template hr
norbix ai schema-templates employee
norbix ai schema-template employees,departments --depth 0 --json
```

## AI tools

The AI tool inventory on the Hub: the tools an external agent can call. The
list needs no project; a tool call sends the project that is set and its
environment — the env rule applies to it as to any project command.
`--account-level` sends no project.

| command | what it does | endpoint |
|---|---|---|
| `norbix ai tools [--toolset <t>]` | the tool inventory (shaped like MCP `tools/list`) | `GET /{version}/account/ai/tools` |
| `norbix ai tool call <name> [--args <json>] [--yes] [--account-level]` | call one tool by name | `POST /{version}/account/ai/tools/{ToolName}` |

- `ai tool call` runs the tool under your identity and can change data: it
  asks first (`--yes` in scripts, `--dry-run` to see the request). `--args` is
  a JSON object; the tool gets it as `argumentsJson`. The env comes from an
  `env` argument, then the `--env` header; a PROD write needs `"env":"PROD"` in
  `--args`.

```bash
norbix ai tools --toolset ai:database-read --json
norbix ai tool call get_schemas --args '{"take":5}' --yes
```

## Not offered

- **Embedding integrations** — not asked for yet; reachable with
  `norbix hub ai …`.
- **The end-user AI chat** (`/{version}/ai/chat/*` and `/{version}/ai/tools`
  on the API host) — it runs as a signed-in project user, and the CLI never
  signs in as a project's end user. Developers use the SDKs
  (`norbix.api.ai…`, the `aiChat` stream).
