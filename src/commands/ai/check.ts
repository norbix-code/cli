import {resolve} from 'node:path'

import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {ALLOW_FILE, readAllow, scan} from '../../lib/boundary-check.js'
import {CliError} from '../../lib/cli-error.js'
import {EXIT} from '../../lib/exit-codes.js'

export default class AiCheck extends BaseCommand {
  static discoversHost = false

  static description = `Check that this project builds on Norbix instead of beside it.

Looks through the folder, offline, for what an agent tends to add on its own:
runtime packages for sign-in, databases, file storage, email, cron and payments,
cloud schedulers in infrastructure files, the \`norbix\` CLI called from app code,
and raw HTTP calls to the Norbix API.

A finding is a question. When Norbix really does not cover the need, write why
in ${ALLOW_FILE}, and the rule is reported as allowed:

  {"allow": {"files": "Portraits must stay in the customer's own bucket"}}

Exits 6 when something is left, so it works as a CI step or an agent hook.`

  static examples = [
    '<%= config.bin %> ai check',
    '<%= config.bin %> ai check --json',
    '<%= config.bin %> ai check --dir ./backend',
  ]

  static flags = {
    dir: Flags.string({description: 'Project folder (default: current folder)'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(AiCheck)
    const root = resolve(flags.dir ?? process.cwd())

    let allow: Record<string, string>
    try {
      allow = readAllow(root)
    } catch (error) {
      throw new CliError({
        exit: EXIT.USAGE,
        code: 'INVALID_ALLOW_FILE',
        message: `${ALLOW_FILE} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
        hint: `Fix ${ALLOW_FILE}: {"allow": {"<rule>": "<reason>"}}.`,
        docs: 'norbix ai check --help',
      })
    }

    const findings = scan(root)
    const open = findings.filter((f) => !(f.rule in allow))
    const allowed = findings.filter((f) => f.rule in allow).map((f) => ({...f, reason: allow[f.rule]}))

    if (open.length > 0) {
      const places = open.map((f) => `${f.file}${f.line ? `:${f.line}` : ''}`)
      throw new CliError({
        exit: EXIT.VALIDATION,
        code: 'BUILT_BESIDE_NORBIX',
        message: `${open.length} thing(s) added beside Norbix:\n${open.map((f, i) => `  ${places[i]}  ${f.match} → use ${f.use}`).join('\n')}`,
        context: {findings: open, allowed},
        hint: `Move each one to Norbix. If Norbix does not cover it, ask the user, then write why in ${ALLOW_FILE}.`,
        docs: 'norbix ai check --help',
      })
    }

    this.print(allowed.length > 0 ? `Nothing beside Norbix, ${allowed.length} allowed in ${ALLOW_FILE}.` : 'Nothing beside Norbix.')
    return {ok: true, findings: [], allowed}
  }
}
