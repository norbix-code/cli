import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {CliError} from '../../lib/cli-error.js'
import {EXIT} from '../../lib/exit-codes.js'
import {RECORD_LOSS_CODE, planOfError, renderPromotion, type PromotionResult, type RollbackBody} from '../../lib/promotion.js'

export default class EnvRollback extends BaseCommand {
  static description = `Undo a promotion: the target environment goes back to its content before that promote

--version is the rollback anchor (fromVersion) the promote printed. The integrations that promote copied into the target are removed (one that became the target's default is kept, with a warning).

A PREVIEW is the default (--dry-run says it explicitly): nothing changes. A real run needs --yes; in a terminal you are asked after the preview. A rollback that deletes a collection holding records refuses without --confirm-record-loss. --json prints the Hub's answer as it is.`

  static examples = [
    '<%= config.bin %> env rollback --to PROD --version 279',
    '<%= config.bin %> env rollback --to PROD --version 279 --dry-run --json',
    '<%= config.bin %> env rollback --to PROD --version 279 --yes',
    '<%= config.bin %> env rollback --to PROD --version 279 --yes --confirm-record-loss',
  ]

  static flags = {
    to: Flags.string({description: 'The environment to roll back (the target of the promote, e.g. PROD)', required: true}),
    version: Flags.integer({description: 'The fromVersion the promote answered (its rollback anchor)', required: true, min: 0}),
    'dry-run': Flags.boolean({
      description: 'Preview only (the default): the Hub returns the plan and changes nothing',
      default: false,
      exclusive: ['yes'],
    }),
    yes: Flags.boolean({char: 'y', description: 'Run it for real (without it you get the preview)', default: false}),
    'confirm-record-loss': Flags.boolean({
      description: 'Agree that collections the rollback deletes hide their records',
      default: false,
    }),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(EnvRollback)
    const target = flags.to.trim().toUpperCase()
    const body = (dryRun: boolean): RollbackBody => ({
      targetEnv: target,
      fromVersion: flags.version,
      dryRun,
      ...(flags['confirm-record-loss'] ? {confirmRecordLoss: true} : {}),
    })
    const rerun = `norbix env rollback --to ${target} --version ${flags.version}${flags['confirm-record-loss'] ? ' --confirm-record-loss' : ''}`
    const ctx = {target, rerun}
    const client = this.client({...flags, 'dry-run': false})
    const call = async (dryRun: boolean) => {
      try {
        return (await client.hub.account.rollbackPromotion(body(dryRun) as never)) as unknown as {item?: PromotionResult}
      } catch (error) {
        throw this.explain(error, ctx)
      }
    }

    if (flags.yes) {
      const res = await call(false)
      this.show(res, false, ctx)
      return res
    }

    const preview = await call(true)
    this.show(preview, true, ctx)
    if (flags['dry-run'] || !this.isInteractive() || preview.item?.summary?.isNoOp) return preview
    if (preview.item?.requiresConfirmation && !flags['confirm-record-loss']) {
      this.log('Re-run with --confirm-record-loss to apply a plan that hides records.')
      return preview
    }

    const {confirm} = await import('@inquirer/prompts')
    if (!(await confirm({message: `Roll ${target} back to before version ${flags.version} now?`, default: false}))) {
      throw new CliError({exit: EXIT.CANCELLED, code: 'CANCELLED', message: 'Cancelled. Nothing was changed.'})
    }

    const res = await call(false)
    this.log('')
    this.show(res, false, ctx)
    return res
  }

  private show(res: {item?: PromotionResult}, dryRun: boolean, ctx: {target: string; rerun: string}): void {
    if (this.jsonEnabled()) return
    this.log(renderPromotion(res.item ?? {}, {kind: 'rollback', dryRun, ...ctx}))
  }

  private explain(error: unknown, ctx: {target: string; rerun: string}): unknown {
    const e = error as {raw?: unknown; code?: string; errorCode?: string}
    const plan = planOfError(e.raw)
    const code = e.errorCode ?? e.code
    if (plan && !this.jsonEnabled()) this.log(renderPromotion(plan, {kind: 'rollback', dryRun: true, ...ctx}) + '\n')
    if (code === RECORD_LOSS_CODE) {
      return new CliError({
        exit: EXIT.CONFIRMATION_REQUIRED,
        code,
        message: `The rollback would hide records in ${ctx.target}. Nothing was changed.`,
        hint: `Check the DELETED items of the preview. If that is intended: ${ctx.rerun} --yes --confirm-record-loss`,
        docs: 'norbix env rollback --help',
        ...(plan ? {context: {plan}} : {}),
      })
    }

    return error
  }
}
