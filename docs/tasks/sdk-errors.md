# SLICE ERRORS — the SDKs report the gateway's real error, and fail on a failed answer

Issues #66 and #67. Decision 2026-09-22 (Domantas): an SDK call **must** fail
when the gateway answers HTTP 200 with `responseStatus.isSuccess == false`, and
the error the caller sees **must** carry the gateway's own message and
`errorCode`.

Nine repositories, one branch each: `fix/sdk-errors`.

## Goal

Two things were wrong in every SDK at once.

**#66 — the wrong field.** The gateway puts its message and its error code
**inside `responseStatus.errors[]`**:

```json
{
  "responseStatus": {
    "isSuccess": false,
    "errors": [
      { "message": "File not found: \"routing/never-uploaded.txt\" does not exist in Local (int_1).",
        "errorCode": "CM-ERRORS-FILES-016",
        "context": { "Path": "routing/never-uploaded.txt", "Provider": "Local" } }
    ]
  }
}
```

Every SDK read `message` / `errorCode` from the **top** of the block, where the
gateway writes nothing. So users saw "Request failed with status 404" and a
made-up code such as `HTTP_404`, while the gateway had said exactly what was
wrong.

**#67 — the wrong answer counted as a success.** The gateway answers a business
refusal — an unknown id, a rule that says no — with **HTTP 200** and
`responseStatus.isSuccess = false`. No SDK treated that as a failure, so calling
code carried on as if the call had worked.

## Plan

1. One error type per SDK (the existing one, extended): `httpStatus`,
   `errorCode`, `message`, `errors[]` (each `errorCode`, `message`,
   `fieldName`), plus the raw body.
2. Failed answers: HTTP ≥ 400 as before but with the real fields; HTTP 2xx with
   `responseStatus.isSuccess == false` → the same error, `httpStatus` 200.
3. Four tests per SDK with the fake transport (a, b, c, d below). Update the
   tests slice API-TEST pinned as "today's behaviour" — they exist for this.
4. A breaking-change paragraph per repo and a `feat!:` / `BREAKING CHANGE:`
   commit, so semantic-release cuts a major where the repo releases itself.
5. TypeScript first; react-redux and the CLI build on the published package.

### The one rule, in every language

The reading order is the same everywhere:

1. `responseStatus.errors[]` — the first entry with something in it gives
   `message` and `errorCode`; **every** entry is kept in `errors`.
2. the top of `responseStatus` (`message` / `errorCode`) — older, ServiceStack-
   shaped answers.
3. the top of the body — **only** when there is no `responseStatus` at all.
4. `Request failed (HTTP <status>)` — the last fallback, never the first.

The key `responseStatus` is matched case-insensitively (`ResponseStatus` too),
and so is `isSuccess`.

Where an SDK's error code doubles as a value callers `switch` on (Go, Python,
Kotlin, Swift, Dart), the old `HTTP_<status>` / `NORBIX_HTTP_ERROR` stays as the
**last** fallback so nobody gets an empty code — the gateway's own code wins
whenever the gateway sent one. TypeScript and .NET leave it unset, as they did.

### Endpoints that answer with bytes

`download`, the public file link and the content links are not JSON. Every SDK
returns those bytes **before** the `isSuccess` check, so they are untouched:
TS `responseType: 'binary'`, .NET `TResponse == byte[]`, Go a `*[]byte` out,
Python `response_type == "binary"`, Dart / Kotlin `sendBytes`, Swift
`downloadData`. This is as the packet asked.

## Changes

### STATUS TABLE — repo × dimension

| Repo | Error type | Reads `errors[]` | Fails on a refused 200 | Tests a–d | Docs | Commit |
|---|---|---|---|---|---|---|
| norbix-js | ✅ `NorbixError` + `httpStatus`/`errorCode`/`errors`/`body` — `src/client/errors.ts` | ✅ `readErrorBody` | ✅ `src/client/transport.ts` | ✅ `tests/errors.test.ts` (8) | ✅ README "Error handling" | `1ca3dfa`, `526908a` |
| norbix-net | ✅ `NorbixException` + `HttpStatus`/`ErrorCode`/`Errors`/`Body` | ✅ `BuildExceptionAsync` | ✅ `SaysItFailed` in `HttpTransport` | ✅ `tests/Norbix.Sdk.Tests/GatewayErrorTests.cs` (7) | ✅ README "Error Handling" | `5c225f0` |
| norbix-go | ✅ `errors.Error` + `Errors []Item`, `Body`, `HTTPStatus()` | ✅ `errors.FromBody` | ✅ `errors.SaysItFailed` | ✅ `norbix/errors_test.go` (7) | ✅ README "Errors" | `fab7ca4` |
| norbix-python | ✅ `NorbixError` + `errors`/`body`/`http_status`/`error_code`, `ErrorItem` | ✅ `error_from_body` | ✅ sync **and** async transport | ✅ `tests/test_errors.py` (8) | ✅ README "Errors" | `3d40c2f` |
| norbix-dart | ✅ `NorbixError` + `errors`/`body`/`httpStatus`/`errorCode`, `NorbixErrorItem` | ✅ `NorbixError.fromBody` | ✅ `_parseResponse` | ✅ `test/core/errors_test.dart` (7) | ✅ README "Errors" | `9e30ab9` |
| norbix-kotlin | ✅ `NorbixError` + `errors`/`body`/`httpStatus`/`errorCode`, `NorbixErrorItem` | ✅ `NorbixError.fromBody` | ✅ `Transport.send` | ✅ `src/test/.../core/GatewayErrorTest.kt` (7) | ✅ README "Errors" | `1eff655` |
| norbix-swift | ✅ `NorbixError` + `errors`/`body`/`httpStatus`/`errorCode`, `NorbixErrorItem` | ✅ `fromHTTPResponse` | ✅ both `send` variants | ⚠️ `Tests/NorbixApiTests/GatewayErrorTests.swift` written, **not run here** (see Needs you) | ✅ README "Errors" | `56ff21d` |
| norbix-react-redux | ✅ `SerializedNorbixError` + `httpStatus`/`errorCode`/`errors` | ✅ (via the SDK) | ✅ (via the SDK) | ✅ `tests/gateway-errors.test.ts` (4) | ✅ README "Errors" | `03936dd` |
| cli | ✅ prints `<errorCode>: <message> (HTTP <status>)` | ✅ `src/lib/gatewayError.ts` | ✅ `publish` / `unpublish` | ✅ `test/files.test.ts` (+3) | ✅ README "Errors" | `35eb580` |

The four cases the packet asked for, per SDK:
**(a)** HTTP 400 with two errors in `responseStatus.errors` → the message and
code of the first, all errors listed; **(b)** 200 + `isSuccess:false` → fails
with the gateway's message, `httpStatus` 200; **(c)** 200 + `isSuccess:true` →
unchanged; **(d)** a non-JSON 500 body → the fallback text.
Three more per SDK cover an empty error body, a body with no `responseStatus`
(top-level fields), and a `responseStatus` with no `errors` list.

### Tests run, per repo (in the worktree, after the rebase)

| Repo | Command | Result |
|---|---|---|
| norbix-js | `npx vitest run` · `npx tsc --noEmit` · `npm run lint` · `prettier --check` | **747 passed**, all clean |
| norbix-net | `dotnet test Norbix.Sdk.sln -p:NuGetAudit=false` | **61 + 90 passed**, 0 failed |
| norbix-go | `go test ./norbix/...` · `go vet` · `gofmt -l` | all **ok**, vet and gofmt silent |
| norbix-python | `uv run pytest` · `make typecheck` | **608 passed**, mypy "no issues found in 36 source files" |
| norbix-dart | `dart analyze` · `dart test` | "No issues found!", **85 passed** |
| norbix-kotlin | `./gradlew build` (JDK 17) | BUILD SUCCESSFUL, **62 tests**, 0 failures |
| norbix-swift | `swift build` + a compiled smoke check | Build complete; **17/17 checks passed** (see below) |
| norbix-react-redux | `npx vitest run` · `npm run lint` · `prettier` | **38 passed, 2 failed** — both pre-existing, see below |
| cli | `npm test` · `npx tsc --noEmit` | **51 passed**, tsc clean |

### Updated tests that pinned the old behaviour

Slice API-TEST deliberately pinned "today's behaviour" so a change would be
deliberate. Three such tests are now the other way round:

- norbix-js `tests/api/files-test-integration.test.ts` — "a 200 with
  isSuccess=false comes back as a value" → "…fails with the gateway message".
- norbix-go `norbix/files_test.go` —
  `TestAPITestFilesIntegrationRejectedRequestKeepsItsResponseStatus` →
  `…RejectedRequestIsAnError`.
- cli `test/files.test.ts` — the 403 line is now
  `Forbidden: Missing permission files:create (HTTP 403)`.

No other test needed changing, in any repo.

### Per-repo notes

**norbix-js.** `fromResponse` was the only reader; it now delegates to
`errorFromBody`. A second commit (`526908a`) exports `errorFromBody`,
`readErrorBody` and `isFailedBody` from the package, so the CLI can drop its own
copy once this version is published.

**norbix-net.** The JSON success body is now buffered into memory before
deserialising, because the `isSuccess` flag has to be read before the answer is
handed back. `ResponseStatus` gained `IsSuccess`, `ResponseError` gained
`Context` (the gateway's per-error extras). The old snapshot test
`Parses_response_status_into_NorbixException` still passes unchanged — its body
carries `responseStatus.message`, which rule 2 still reads.

**norbix-go.** `errors.FromBody` replaces the ad-hoc parsing in the transport;
the now-unused `stringField` helper was deleted from `transport.go`. A 400 is
still a `*ValidationError`, a 404 still a `*NotFoundError`, and so on — only the
fields inside changed. A refused 200 is a plain `*errors.Error` with
`Status: 200`.

**norbix-python.** The sync and the async transport each had their own copy of
the error block; both now call `error_from_body`, and both check `says_it_failed`
on a 2xx. An async test pins that the second copy agrees with the first.

**norbix-dart / norbix-kotlin / norbix-swift.** Same shape as the others. Their
error classes are `const` / data classes, so the new fields are added with
defaults and every typed subclass forwards them — no call site changes.

**norbix-react-redux.** This package does not parse bodies; it turns what the
SDK threw into the plain object RTK Query keeps in the Redux state. Two changes
were needed: `SerializedNorbixError` now carries each field under both names
(`httpStatus`/`errorCode`/`errors` next to `status`/`code`/`fieldErrors`), and
`serializeNorbixError` reads **both** name sets off the thrown value — on
`NorbixError` the new names are getters on the prototype, which a spread would
lose.

**cli.** Two commands talk to the gateway with `fetch` rather than the SDK
(`files integrations test`, and `files publish` / `unpublish`), because the
published `@norbix.ai/ts` carries neither endpoint yet. Both had their own copy
of the parsing, and `publicFiles.ts` was the worst of them — it read `code` from
`payload.status`, which is not an error code at all. They now share
`src/lib/gatewayError.ts`, which is written to be **deleted**: its header names
the SDK exports that replace it once 2.0.0 is out. `norbix files publish` /
`unpublish` now fail on a refused 200; they used to exit 0.
`base.ts` prints `<errorCode>: <message> (HTTP <status>)` and does not repeat
the status when the fallback message already ends in it. Exit codes are
unchanged (`1` for a failed call, `2` for `files integrations test`).

## Rejected / moved out

- **Swift `swift test` could not run on this machine.** Only the Command Line
  Tools are installed (`xcode-select -p` → `/Library/Developer/CommandLineTools`;
  `/Applications` has `Xcodes.app`, the installer, not Xcode), and they ship no
  `XCTest` module — every test target fails to compile with
  `no such module 'XCTest'`, on `origin/main` as much as on this branch. So
  `Tests/NorbixApiTests/GatewayErrorTests.swift` is written and committed but
  was **not executed here**. To still have evidence, the parsing was compiled
  against the real `Sources/NorbixCore/*.swift` and run as a small programme:
  17 checks covering (a)–(d) plus the three extra cases, all passed. The XCTest
  file needs a machine with Xcode, or CI. → **Needs you**.
- **norbix-react-redux: 2 pre-existing test failures and 2 pre-existing `tsc`
  errors** — `src/hooks/api/files.ts` calls
  `norbix.api.files.testFilesIntegration`, which the published
  `@norbix.ai/ts` **1.3.0** does not have (slice API-TEST added it; that PR is
  still open). Verified: the installed 1.3.0 reports
  `typeof …testFilesIntegration === 'undefined'`, and `git diff --stat
  origin/main` shows this slice never touched that file. Not fixed here — it
  goes away when the SDK release lands. New ticket: none (it is API-TEST's open
  PR).
- **Making `norbix files integrations test` throw on a refused 200** — not
  done, on purpose. The command already checks `isSuccess` itself, prints the
  refusal with the gateway's errors and exits `2`. That is better output than an
  exception, and the point of #67 (a refusal must not pass silently) is already
  met there.
- **`fieldName` in the gateway's own error shape** — the gateway's
  `ErrorDto` (`Isidos.CodeMash.Sharable`) is
  `(Message, ErrorCode, Context, StackTrace)`; there is **no** `fieldName`.
  Every SDK reads `fieldName` anyway, because ServiceStack-shaped validation
  answers carry it and the packet asked for the field. The gateway's `context`
  map is read into the same item (`context` / `meta` depending on the language).
  Nothing to change in the gateway. New ticket: none.
- **Regenerating any SDK's DTOs** — not needed. This slice changes no request,
  response or route in the gateway; it changes how the SDKs *read* a body that
  was already being sent. The dependency chain in the shared brief does not
  apply.
- **A test against a running gateway** — not done, per the brief ("never call a
  real provider in a test"). The wire shape was taken from the gateway's own
  recorded answers instead:
  `gateway/tests/Isidos.CodeMash.Tests.Services.Api.Surface/test_results/FileContentRoutingTests.A_Good_Link_To_A_Missing_File_Is_A_404.verified.txt`
  and `…/LicenseServingGateTests.Suspended_Project_Is_Refused_With_A_License_503.verified.txt`.
  (The Api on `:5002` answers `401` with an **empty** body without a token, so a
  live call would have shown nothing anyway.)
- **norbix-mcp** — not in the packet's repo list, not touched.

## Needs you

- [ ] **Merge order.** The SDKs first, then `norbix-react-redux` and `cli` last:
      both build on the **published** `@norbix.ai/ts`, and both need the version
      that carries this fix — **2.0.0** (this is a `feat!:`, so semantic-release
      cuts a major). Their branches are correct as they are; they only get
      *better* once that version is on npm.
- [ ] **Run the Swift tests** on a machine with Xcode (or let CI do it):
      `cd norbix-swift && swift test`. This machine has no `XCTest`.
- [ ] **Open the 9 pull requests** (Routine A) and approve them. Every branch is
      committed, rebased on `origin/main` and green in its worktree; nothing is
      pushed and nothing is merged, as the brief requires.
- [ ] **Decide about `norbix-mcp`** — it wraps the SDKs and may show the same
      "Request failed" text to agents. Out of this packet's repo list; say if it
      should get the same treatment.
- [ ] After the `@norbix.ai/ts` 2.0.0 release: delete `cli/src/lib/gatewayError.ts`
      and import `errorFromBody` / `isFailedBody` from the SDK (the TODO in the
      file says so), together with the two raw-fetch endpoint fallbacks it
      serves.

## Open questions

1. **Should `errorCode` ever be empty?** TypeScript and .NET leave it unset when
   the gateway sent none; Go, Python, Kotlin, Dart and Swift fall back to
   `HTTP_<status>` / `NORBIX_HTTP_ERROR` because callers `switch` on that field
   in those languages. It is a deliberate difference, not an oversight — say if
   you want it uniform, in either direction.
2. **The CLI's `<errorCode>: ` prefix** is new on every error line. Scripts that
   match the exact text will need updating. It is called out as a breaking
   change in the CLI's README; confirm that is the wanted trade-off.
