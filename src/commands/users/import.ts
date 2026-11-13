import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {usageError} from '../../lib/cli-error.js'
import {readJsonInput} from '../../lib/json.js'

/** The gateway takes at most this many users per request; a bigger file is sent in parts. */
export const IMPORT_BATCH = 1000

interface ImportRow {
  row?: number
  login?: string
  outcome?: string
  userId?: string
  errors?: Array<{code?: string; message?: string}>
}

interface ImportReport {
  dryRun?: boolean
  received?: number
  imported?: number
  valid?: number
  existing?: number
  invalid?: number
  failed?: number
  rows?: ImportRow[]
}

/** The rows of the file: a JSON array, or an object with a `users` array. */
export function importRows(json: unknown): unknown[] {
  const rows = Array.isArray(json) ? json : (json as {users?: unknown} | null)?.users
  if (!Array.isArray(rows) || rows.length === 0) {
    throw usageError('The file must hold a JSON array of users (or {"users": [...]}) with at least one user.')
  }

  return rows
}

export default class UsersImport extends BaseCommand {
  static description = `Import users from another system with their password hashes, so they keep their passwords

The file is a JSON array; one object per user:
  {"email": "alice@example.com", "hashFormat": "servicestack-pbkdf2",
   "passwordHash": "<base64>", "passwordSalt": "<base64, CodeMash V1 only>",
   "roles": ["Customer"], "createdOn": 1700000000000,
   "userGeneralInfo": {"displayName": "Alice"}}
Use "userName" instead of "email" for a user-name login. hashFormat is
servicestack-saltedhash (CodeMash V1) or servicestack-pbkdf2 (Norbix).

A PREVIEW is the default: the gateway checks every row and writes nothing.
Only --yes writes. A user who already exists is left alone, so a file can be
sent again. Users are imported into the --env environment, up to 1000 per
request (a bigger file is sent in parts). Hashes are never printed.`

  static examples = [
    '<%= config.bin %> users import users.json --env TEST',
    '<%= config.bin %> users import users.json --env TEST --dry-run --json',
    '<%= config.bin %> users import users.json --env TEST --yes',
    'cat users.json | <%= config.bin %> users import - --skip-default-roles --json',
  ]

  static args = {
    file: Args.string({required: true, description: 'JSON file with the users, or - to read stdin'}),
  }

  static flags = {
    'dry-run': Flags.boolean({description: 'Preview only (the default): the gateway checks the rows and writes nothing', default: false, exclusive: ['yes']}),
    yes: Flags.boolean({char: 'y', description: 'Import for real (without it you get the preview)', default: false}),
    'skip-default-roles': Flags.boolean({description: "Do not add the project's default roles to the imported users", default: false}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersImport)
    const rows = importRows(JSON.parse(await readJsonInput(args.file === '-' ? '-' : `@${args.file}`, 'file')))
    const dryRun = !flags.yes
    const client = this.client({...flags, 'dry-run': false})

    const total: Required<Omit<ImportReport, 'rows'>> & {rows: ImportRow[]} = {
      dryRun, received: 0, imported: 0, valid: 0, existing: 0, invalid: 0, failed: 0, rows: [],
    }
    for (let start = 0; start < rows.length; start += IMPORT_BATCH) {
      const users = rows.slice(start, start + IMPORT_BATCH)
      const res = (await client.hub.membership.importUsers({
        dryRun,
        ignoreDefaultRoles: flags['skip-default-roles'],
        users: users as never,
      })) as {result?: ImportReport}
      const part = res.result ?? {}
      for (const key of ['received', 'imported', 'valid', 'existing', 'invalid', 'failed'] as const) total[key] += part[key] ?? 0
      for (const row of part.rows ?? []) total.rows.push({...row, row: (row.row ?? 0) + start})
    }

    if (!this.jsonEnabled()) this.log(describeImport(total))
    return total
  }
}

/** The plain-text report: the counts, then every row that is not fine. */
export function describeImport(r: ImportReport): string {
  const lines = [
    r.dryRun
      ? `Preview — nothing was written. ${r.received} users: ${r.valid} valid, ${r.existing} already exist, ${r.invalid} invalid.`
      : `${r.received} users: ${r.imported} imported, ${r.existing} already exist, ${r.invalid} invalid, ${r.failed} failed.`,
  ]
  for (const row of r.rows ?? []) {
    if (row.outcome !== 'invalid' && row.outcome !== 'failed') continue
    const why = (row.errors ?? []).map((e) => [e.code, e.message].filter(Boolean).join(': ')).join('; ')
    lines.push(`  row ${row.row}${row.login ? ` (${row.login})` : ''}: ${row.outcome}${why ? ` — ${why}` : ''}`)
  }

  if (r.dryRun && (r.valid ?? 0) > 0) lines.push('Run again with --yes to import.')
  return lines.join('\n')
}
