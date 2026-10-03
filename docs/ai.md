# `norbix ai`

Manage the AI integrations of a project (LLM providers, MCP servers) and the
account's AI service users from the terminal. The project's AI chat settings
and assistants are under `norbix project ai` ([docs/project.md](project.md)).

Every command is covered by `tests/project-routes.test.ts`, which runs it
through the real SDK with `fetch` replaced and checks the verb and path it
sends, and the save / create bodies. No test contacts an LLM provider or an MCP
server.

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
| `norbix ai service-user create --name <n> [--reach account\|project] [--rights read\|admin] [--env <e>]...` | create one and print its first key (shown once) | `POST /` |
| `norbix ai service-user delete <id> [--yes]` | delete it; its keys stop working | `DELETE /{Id}` |
| `norbix ai service-user rotate-key <id> [--revoke <keyId>]` | issue a new key (shown once), optionally revoke an old one | `POST /{Id}/keys` |
| `norbix ai service-user revoke-key <id> <keyId> [--yes]` | revoke one key | `DELETE /{Id}/keys/{KeyId}` |

`--reach project` (the default) limits the user to the configured project (or
`--project`); `--rights` defaults to `read`; `--env` defaults to `TEST`.

```bash
norbix ai service-user create --name "Claude Code on my laptop" --reach project --rights read --env TEST
norbix ai service-user rotate-key su_123 --revoke key_old
```

## Not offered

- **Embedding integrations** — not asked for yet; reachable with
  `norbix hub ai …`.
- **AI tools, chat sessions** — called by AI clients, not by a person at a
  terminal.
