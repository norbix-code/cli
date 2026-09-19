import {Args} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {
  callTestFilesIntegration,
  normaliseResult,
  type IntegrationTestResultItem,
  type TestFilesIntegrationResult,
} from '../../../lib/filesIntegrationTest.js'

/** What `--json` returns, and what the command returns to a caller. */
export interface FilesIntegrationTestOutput {
  filesIntegrationId: string
  /** True only when the gateway said so AND every step is OK. */
  ok: boolean
  steps: Array<{operation: string; result: string; errors: string[]}>
  errors: string[]
}

export default class FilesIntegrationsTest extends BaseCommand {
  static description = `Check that a files integration really works

Runs a live probe against the storage: uploads a small file, reads it, lists
its folder and deletes it again. Prints one line per step — OK, FAILED or
NOT_TESTED (skipped because an earlier step failed) — with the errors of a
failed step. Exits non-zero unless every step is OK.

Needs the files:create permission, because the probe writes to the storage.`

  static examples = [
    '<%= config.bin %> files integrations test 55555555-5555-5555-5555-555555555555',
    '<%= config.bin %> files integrations test 55555555-5555-5555-5555-555555555555 --json',
  ]

  static args = {
    id: Args.string({required: true, description: 'Files integration ID'}),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(FilesIntegrationsTest)
    const ctx = this.resolveContext(flags)
    // Builds nothing itself, but it is what refuses early and with a useful
    // sentence when there is no project, region or credentials.
    this.client(flags)

    // TODO(10b-API-TEST): switch to `client.api.files.testFilesIntegration`
    // once @norbix.ai/ts releases it (sdk-ts PR #44) — see the lib file.
    const res = await callTestFilesIntegration(ctx, args.id)
    const output = summarise(args.id, res)

    if (this.jsonEnabled()) {
      // oclif prints the returned value; the exit code still tells a script
      // whether the integration works.
      if (!output.ok) process.exitCode = 2
      return output
    }

    for (const line of render(output.steps)) this.log(line)

    if (!output.ok) {
      this.error(failureMessage(output))
    }

    this.log(`\nAll ${output.steps.length} steps passed.`)
    return output
  }
}

function summarise(id: string, res: TestFilesIntegrationResult): FilesIntegrationTestOutput {
  const steps = (res.items ?? []).map((item: IntegrationTestResultItem) => ({
    operation: item.operation,
    result: normaliseResult(item.result),
    errors: item.errors ?? [],
  }))
  const errors = (res.responseStatus?.errors ?? [])
    .map((e) => e.message ?? e.errorCode ?? '')
    .filter(Boolean)
  const gatewayOk = res.responseStatus?.isSuccess !== false
  if (!gatewayOk && errors.length === 0) {
    errors.push('the gateway answered isSuccess: false without an error message')
  }

  const ok = gatewayOk && steps.length > 0 && steps.every((s) => s.result === 'OK')
  return {filesIntegrationId: id, ok, steps, errors}
}

function render(steps: FilesIntegrationTestOutput['steps']): string[] {
  const width = Math.max(0, ...steps.map((s) => s.operation.length))
  const lines: string[] = []
  for (const step of steps) {
    lines.push(`${step.operation.padEnd(width)}  ${step.result}`)
    for (const error of step.errors) lines.push(`${' '.repeat(width)}    - ${error}`)
  }
  return lines
}

function failureMessage(output: FilesIntegrationTestOutput): string {
  if (output.errors.length > 0) {
    return `The files integration test was refused: ${output.errors.join('; ')}`
  }

  if (output.steps.length === 0) {
    return 'The gateway returned no test steps, so nothing was proven.'
  }

  const notOk = output.steps.filter((s) => s.result !== 'OK')
  const failed = notOk.filter((s) => s.result !== 'NOT_TESTED')
  const skipped = notOk.length - failed.length
  const named = (failed.length > 0 ? failed : notOk).map((s) => `${s.operation} ${s.result}`).join(', ')
  const tail = failed.length > 0 && skipped > 0 ? ` (${skipped} later step${skipped === 1 ? '' : 's'} not tested)` : ''
  return `The files integration test failed: ${named}${tail}.`
}
