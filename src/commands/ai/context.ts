import {resolve} from 'node:path'

import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {CliError} from '../../lib/cli-error.js'
import {CONTEXT_MD, fetchContext, writeContextFiles, type ContextResult} from '../../lib/agent-context.js'
import {EXIT} from '../../lib/exit-codes.js'

export default class AiContext extends BaseCommand {
  static description = `Print the project context an AI agent needs: every project you may work on.

For each project (scoped to your roles): id and name, environments,
regions, enabled modules, integrations (id, name, kind, the default per
environment), CORS origins and languages. Without the right to read a
project's settings you get only its name, description and languages
("access": "minimal"). Never contains a secret: no keys, tokens, connection
strings or integration settings.

Default output is Markdown for a prompt; --json prints the structured summary
(with "version"). --project narrows it to one project.

--write also saves it into this folder as ${CONTEXT_MD} (+ context.json and a
.gitignore — the summary follows your roles, so it is never committed).
\`norbix ai init\` points the agent at that file. After \`norbix login\` and
after a token renewal the copy is refreshed by itself in a folder set up with
\`norbix ai init\`; run this command again after your context was compressed.`

  static examples = [
    '<%= config.bin %> ai context',
    '<%= config.bin %> ai context --json',
    '<%= config.bin %> ai context --project 66b2f0a1c3d4e5f6a7b8c9d0',
    '<%= config.bin %> ai context --write',
  ]

  static flags = {
    write: Flags.boolean({description: `Also save it to ${CONTEXT_MD} (and context.json) in the project folder`, default: false}),
    dir: Flags.string({description: 'Project folder for --write (default: current folder)'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(AiContext)
    const ctx = await this.freshContext(flags)
    const base = await this.agentContextRequest(ctx, flags.project)
    if (!base) {
      throw new CliError({
        exit: EXIT.AUTH,
        code: 'UNAUTHENTICATED',
        message: 'Not authenticated.',
        hint: 'Run `norbix login` (browser sign-in) or pass --api-key / set NORBIX_API_KEY.',
        docs: 'norbix login --help',
      })
    }

    const wantMarkdown = !this.jsonEnabled() || flags.write
    const json = this.orFail(await this.call(() => fetchContext({...base, format: 'json'})))
    const md = wantMarkdown ? this.orFail(await this.call(() => fetchContext({...base, format: 'markdown'}))) : undefined
    const summary = json.status === 'ok' ? json.context : undefined
    const markdown = md?.status === 'ok' ? md.markdown : undefined

    let written: string[] = []
    if (flags.write && summary && markdown) {
      written = writeContextFiles(resolve(flags.dir ?? process.cwd()), summary, markdown)
    }

    if (!this.jsonEnabled()) {
      this.log((markdown ?? '').trimEnd())
      if (written.length > 0) this.logToStderr(`wrote  ${written.join(', ')}`)
    }

    return written.length > 0 ? {...summary, written} : summary
  }

  /** A network failure becomes the usual exit 7 envelope. */
  private async call(request: () => Promise<ContextResult>): Promise<ContextResult> {
    try {
      return await request()
    } catch (error) {
      throw new CliError({
        exit: EXIT.NETWORK,
        code: 'NETWORK_ERROR',
        message: `Could not reach the Hub: ${error instanceof Error ? error.message : String(error)}`,
        hint: 'Check the network and `norbix whoami --json`.',
        docs: 'norbix ai context --help',
      })
    }
  }

  private orFail(result: ContextResult): ContextResult {
    if (result.status !== 'error') return result
    const exit = result.httpStatus === 401 || result.httpStatus === 403 ? EXIT.AUTH : result.httpStatus === 404 ? EXIT.NOT_FOUND : result.httpStatus >= 500 ? EXIT.SERVER : EXIT.VALIDATION
    throw new CliError({
      exit,
      code: result.httpStatus === 404 ? 'NOT_FOUND' : 'AI_CONTEXT_FAILED',
      message: `Could not read the project context: ${result.message}`,
      hint:
        result.httpStatus === 404
          ? 'This Hub is older than the project-context summary (GET /account/ai/context); update the gateway.'
          : 'Check the sign-in with `norbix whoami --json`.',
      docs: 'norbix ai context --help',
    })
  }
}
