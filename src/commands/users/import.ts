import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {batches, mergeReports, readImportFile, redactRows, reportTable, type ImportReport} from '../../lib/user-import.js'

export default class UsersImport extends BaseCommand {
  static description = `Import users with their existing password hashes (CodeMash V1 → Norbix)

Checks by default and writes nothing: the Hub validates every row and answers
valid / exists / invalid per row. Add --apply to write. Users keep their
passwords: the hash is stored as it is and re-hashed at the first sign-in.
A login that already exists is answered "exists" and left alone, so a file
can be sent again. The file is split into requests of 1000 users.

The file is JSON — an array of users, or {"users": [...]} — or CSV with a
header row. Fields: email or userName (one of them), hashFormat
(servicestack-saltedhash for CodeMash V1, servicestack-pbkdf2 for Norbix),
passwordHash and passwordSalt (base64, exactly as stored; the salt only for
V1), roles (names or role ids; in CSV separated by ";"), createdOn (Unix
ms), and the profile (JSON: userGeneralInfo {…}; CSV: firstName, lastName,
displayName, phone, language, … as columns).

Writes into the environment of the call: --apply needs a named environment
(--env TEST, or --env PROD on purpose — see \`norbix env --help\`). Project
or account administrators only. --dry-run prints the request with the hashes
masked and sends nothing.`

  static examples = [
    '<%= config.bin %> users import users.json --env TEST',
    '<%= config.bin %> users import users.json --dry-run',
    '<%= config.bin %> users import users.csv --env TEST --apply',
    '<%= config.bin %> users import users.json --env PROD --apply --json',
  ]

  static args = {
    file: Args.string({required: true, description: 'JSON or CSV file with the users'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    apply: Flags.boolean({description: 'Write the users (default: check every row and write nothing)', default: false}),
    'ignore-default-roles': Flags.boolean({description: "Do not add the project's default roles", default: false}),
  }

  /** The env rule applies to --apply only; the check is a read. */
  static envWrite = false

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(UsersImport)
    const rows = readImportFile(args.file)
    if (flags.apply) await this.assertWriteEnv(flags)

    const parts: Array<{report: ImportReport; offset: number}> = []
    let offset = 0
    for (const users of batches(rows)) {
      // Typed SDK call once @norbix.ai/ts has it: hub.membership.importUsers.
      const res = await this.hubRequest<{result?: ImportReport}>(flags, {
        method: 'POST',
        path: '/membership/users/import',
        name: 'hub POST /membership/users/import',
        body: {dryRun: !flags.apply, ignoreDefaultRoles: flags['ignore-default-roles'], users},
        redact: redactRows,
      })
      if (res.result) parts.push({report: res.result, offset})
      offset += users.length
    }

    const report = mergeReports(parts)
    const counts = `${report.received} received: ${report.imported} imported, ${report.valid} valid, ${report.existing} already there, ${report.invalid} invalid, ${report.failed} failed`
    this.print(
      [
        reportTable(report),
        '',
        report.dryRun ? `Checked — nothing written. ${counts}.` : `${counts}.`,
        ...(report.dryRun && report.valid > 0 ? ['Write them with the same command and --apply.'] : []),
      ].join('\n'),
    )
    return report
  }
}
