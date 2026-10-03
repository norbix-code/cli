/**
 * Exit codes of the Norbix CLI — the agent contract (docs/agent-contract.md).
 *
 * No oclif import here on purpose: the MCP server shares this table.
 * Codes are identical with and without `--json`.
 */

export const EXIT = {
  OK: 0,
  /** Unexpected / internal error — file an issue, include `traceId`. */
  INTERNAL: 1,
  /** Usage: bad flags/args, invalid JSON input, unknown command, missing config. */
  USAGE: 2,
  /** Confirmation required: non-interactive shell and no `--yes`. */
  CONFIRMATION_REQUIRED: 3,
  /** Not authenticated / auth rejected (401, 403, no key). */
  AUTH: 4,
  /** Not found (404). */
  NOT_FOUND: 5,
  /** Validation rejected by the server (400/422, or a 200 with isSuccess=false). */
  VALIDATION: 6,
  /** Network / timeout / endpoint unreachable. */
  NETWORK: 7,
  /** Rate limited / server error (429, 5xx). */
  SERVER: 8,
  /** Cancelled by the user at a prompt. */
  CANCELLED: 9,
} as const

export type ExitCode = (typeof EXIT)[keyof typeof EXIT]

export interface ExitCodeInfo {
  code: ExitCode
  name: keyof typeof EXIT
  meaning: string
  hint: string
}

/** The documented table, in order — `norbix schema --json` prints it. */
export const EXIT_CODES: ExitCodeInfo[] = [
  {code: EXIT.OK, name: 'OK', meaning: 'success', hint: ''},
  {code: EXIT.INTERNAL, name: 'INTERNAL', meaning: 'unexpected / internal error', hint: 'file an issue, include traceId'},
  {
    code: EXIT.USAGE,
    name: 'USAGE',
    meaning: 'usage: bad flags/args, invalid JSON input, unknown command, missing config',
    hint: 'norbix <cmd> --help  /  norbix schema <cmd> --json',
  },
  {
    code: EXIT.CONFIRMATION_REQUIRED,
    name: 'CONFIRMATION_REQUIRED',
    meaning: 'confirmation required (non-interactive, no --yes)',
    hint: 're-run with --yes after a --dry-run',
  },
  {
    code: EXIT.AUTH,
    name: 'AUTH',
    meaning: 'not authenticated / auth rejected (401, 403, no key)',
    hint: 'norbix login, --api-key, --profile',
  },
  {code: EXIT.NOT_FOUND, name: 'NOT_FOUND', meaning: 'not found (404)', hint: 'check id / env / project'},
  {
    code: EXIT.VALIDATION,
    name: 'VALIDATION',
    meaning: 'validation rejected by server (400/422)',
    hint: 'fieldErrors lists the fields',
  },
  {
    code: EXIT.NETWORK,
    name: 'NETWORK',
    meaning: 'network / timeout / endpoint unreachable',
    hint: 'shows the URL; check --region, api_url, connectivity',
  },
  {
    code: EXIT.SERVER,
    name: 'SERVER',
    meaning: 'rate limited / server error (429, 5xx)',
    hint: 'retry with backoff; include traceId',
  },
  {code: EXIT.CANCELLED, name: 'CANCELLED', meaning: 'cancelled by user at a prompt', hint: ''},
]

/** Exit code for an HTTP status the server answered with. */
export function exitForStatus(status: number | undefined): ExitCode {
  if (status === undefined) return EXIT.INTERNAL
  if (status === 401 || status === 403) return EXIT.AUTH
  if (status === 404) return EXIT.NOT_FOUND
  if (status === 400 || status === 422) return EXIT.VALIDATION
  if (status === 429 || (status >= 500 && status <= 599)) return EXIT.SERVER
  // A business refusal comes back as HTTP 200 with isSuccess=false.
  if (status === 200) return EXIT.VALIDATION
  if (status >= 400) return EXIT.VALIDATION
  return EXIT.INTERNAL
}

/** Default machine code for an exit code when the server gave none. */
export function codeForExit(exit: ExitCode): string {
  switch (exit) {
    case EXIT.USAGE:
      return 'USAGE_ERROR'
    case EXIT.CONFIRMATION_REQUIRED:
      return 'CONFIRMATION_REQUIRED'
    case EXIT.AUTH:
      return 'UNAUTHENTICATED'
    case EXIT.NOT_FOUND:
      return 'NOT_FOUND'
    case EXIT.VALIDATION:
      return 'VALIDATION_FAILED'
    case EXIT.NETWORK:
      return 'NETWORK_ERROR'
    case EXIT.SERVER:
      return 'SERVER_ERROR'
    case EXIT.CANCELLED:
      return 'CANCELLED'
    default:
      return 'INTERNAL_ERROR'
  }
}
