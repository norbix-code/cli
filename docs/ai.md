# `norbix ai`

Manage the AI integrations of a project (LLM providers, MCP servers), the
account's AI service users, and talk to the developer AI chat from the
terminal. The project's AI chat settings and assistants (the end-user chat)
are under `norbix project ai` ([docs/project.md](project.md)).

Every command is covered by `tests/project-routes.test.ts`, which runs it
through the real SDK with `fetch` replaced and checks the verb and path it
sends, and the save / create bodies. The LLM, MCP, chat and tool commands are
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

## Developer AI chat

The AI chat of the Cloud dashboard, on the Hub. A chat belongs to you (the
signed-in user or the API key's service user), so the session commands need no
project. `ai chat`, `ai chat availability`, `ai chat attach` (new chat) and
`ai chat memory` send the project that is set, and the turn and the attach send
its environment too — the env rule applies to them as to any project command.
`--account-level` sends no project: the chat then works at account level. Paths are
under `/{version}/account/chat` unless shown in full.

| command | what it does | endpoint |
|---|---|---|
| `norbix ai chat "<message>" [--session <id>] [--surface <s>] [--topic <t>] [--llm <integrationId>] [--model <m>] [--account-level]` | send one message; prints the reply, the tools called and the chat id | `POST /turn` |
| `norbix ai chat availability [--account-level]` | can the chat run here, its profiles and models | `GET /availability` |
| `norbix ai chat sessions [--take <n>] [--archived]` | your chats, newest first | `GET /sessions` |
| `norbix ai chat entries <session> [--since <seq>]` | the transcript: messages, plans, questions, steps | `GET /sessions/{SessionId}/entries` |
| `norbix ai chat plan <session> <entry> approve\|reject [--comment <c>]` | approve a proposed plan, or reject it (with what to do instead) | `POST /sessions/{SessionId}/plans/{EntryId}/decision` |
| `norbix ai chat answer <session> <entry> --answer <key>=<value>...` | answer a question the assistant asked | `POST /sessions/{SessionId}/questions/{EntryId}/answer` |
| `norbix ai chat stop <session> <entry> [--yes]` | stop a running plan step | `POST /sessions/{SessionId}/steps/{EntryId}/stop` |
| `norbix ai chat feedback <session> <entry> up\|down\|clear` | like / dislike an entry | `POST /sessions/{SessionId}/entries/{EntryId}/feedback` |
| `norbix ai chat attach <file> [--session <id>] [--content-type <t>]` | put a file into a chat (a new one without `--session`) | `POST /attachments` |
| `norbix ai chat archive <session> [--undo]` | archive / unarchive | `PATCH /sessions/{SessionId}/archive` |
| `norbix ai chat pin <session> [--undo]` | pin / unpin | `PATCH /sessions/{SessionId}/pin` |
| `norbix ai chat sharing <session> private\|shared` | keep the chat out of the shared improvement data, or not | `PATCH /sessions/{SessionId}/sharing` |
| `norbix ai chat delete <session> [--yes]` | delete a chat | `DELETE /sessions/{SessionId}` |
| `norbix ai chat memory [--account-level]` | what the assistant remembers | `GET /memory` |
| `norbix ai chat forget <note> [--yes]` | delete one memory note | `DELETE /memory/{NoteId}` |
| `norbix ai tools [--toolset <t>]` | the chat-tool inventory (shaped like MCP `tools/list`) | `GET /{version}/account/ai/tools` |
| `norbix ai tool call <name> [--args <json>] [--yes]` | call one tool by name, as the chat would | `POST /{version}/account/ai/tools/{ToolName}` |

- A turn runs the model and the tools it calls before the reply comes back, so
  the command waits up to 5 minutes. It is never retried (a retry would run the
  turn twice). Every message is one quoted argument; a single-word message
  that is also a subcommand name (`sessions`, `memory`, …) runs that command.
- What the assistant proposes is not done until you approve the plan
  (`ai chat entries` shows the plan entry id). The live progress the dashboard
  shows comes over server-sent events; the CLI prints the final reply only.
- `ai tool call` can change data: it asks first (`--yes` in scripts,
  `--dry-run` to see the request). `--args` is a JSON object; the tool gets it
  as `argumentsJson`.
- `ai chat delete`, `stop` and `forget` ask first too.

```bash
norbix ai chat "Add a phone field to customers" --prod
norbix ai chat entries aics_123
norbix ai chat plan aics_123 ent_456 approve
norbix ai tools --toolset ai:database-read --json
```

## Not offered

- **Embedding integrations** — not asked for yet; reachable with
  `norbix hub ai …`.
- **The end-user AI chat** (`/{version}/ai/chat/*` and `/{version}/ai/tools`
  on the API host) — it runs as a signed-in project user, and the CLI never
  signs in as a project's end user. Developers use the SDKs
  (`norbix.api.ai…`, the `aiChat` stream).
