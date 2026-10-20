import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {CliError} from '../../lib/cli-error.js'
import {EXIT} from '../../lib/exit-codes.js'
import {
  RECORD_LOSS_CODE,
  choiceFlags,
  parseChoices,
  planOfError,
  renderPromotion,
  type PromoteBody,
  type PromotionResult,
} from '../../lib/promotion.js'

export default class EnvPromote extends BaseCommand {
  static description = `Promote one environment into the next one up (e.g. TEST → PROD): schemas, taxonomies and terms, templates, footers, signatures and triggers

Build and test in the lower environment, then move it up with this command — never re-create the same items in PROD by hand (they would get other ids).

A PREVIEW is the default: the Hub works out the plan and changes nothing (--dry-run says it explicitly). The preview lists every item by status — added, changed, unchanged, deleted (with the number of records a deleted collection holds), kept — one line per source integration with the choice that applies, and what is never promoted (records, users, files, …). A real run needs --yes. In a terminal you are asked after the preview instead.

Integrations: by default Fake providers are copied (seed) and everything else is left out (skip) — a database, a secret or a real sender is never copied unless you say so: --seed <id> copies one, --skip <id> leaves one out, --map <id>=<target id> points the promoted content at an integration the target already has (same module).

A real run that would hide records (a collection deleted in the target) refuses without --confirm-record-loss. The answer of a real run names its rollback anchor (fromVersion): \`norbix env rollback --to <target> --version <fromVersion>\` undoes it.

--json prints the Hub's answer as it is (summary, items, integrations, notPromoted, requiresConfirmation, fromVersion, …).`

  static examples = [
    '<%= config.bin %> env promote --from TEST --to PROD',
    '<%= config.bin %> env promote --from TEST --to PROD --dry-run --json',
    '<%= config.bin %> env promote --from TEST --to PROD --yes',
    '<%= config.bin %> env promote --from TEST --to PROD --seed int_6psM5F4vNOOXGEZbb29UHC --yes',
    '<%= config.bin %> env promote --from TEST --to PROD --map int_2XKNuL8k2YoJJZF4ffEhpw=int_7aQvYc1Lr0mXb2kP9sTzWd --yes',
    '<%= config.bin %> env promote --from TEST --to PROD --yes --confirm-record-loss',
  ]

  static flags = {
    from: Flags.string({description: 'Environment to promote FROM (the lower one, e.g. TEST)', required: true}),
    to: Flags.string({description: 'Environment to promote INTO (the higher one, e.g. PROD)', required: true}),
    'dry-run': Flags.boolean({
      description: 'Preview only (the default): the Hub returns the plan and changes nothing',
      default: false,
      exclusive: ['yes'],
    }),
    yes: Flags.boolean({char: 'y', description: 'Run it for real (without it you get the preview)', default: false}),
    'confirm-record-loss': Flags.boolean({
      description: 'Agree that collections deleted in the target hide their records (they come back on rollback)',
      default: false,
    }),
    seed: Flags.string({description: 'Copy this source integration (and its secret) into the target. Repeatable', multiple: true}),
    skip: Flags.string({description: 'Leave this source integration out. Repeatable', multiple: true}),
    map: Flags.string({
      description: 'Point promoted content at an existing target integration: <source id>=<target id>. Repeatable',
      multiple: true,
    }),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(EnvPromote)
    const source = flags.from.trim().toUpperCase()
    const target = flags.to.trim().toUpperCase()
    if (source === target) {
      throw new CliError({
        exit: EXIT.USAGE,
        code: 'USAGE_ERROR',
        message: `--from and --to are both ${source}.`,
        hint: 'Promote from the lower environment into the higher one, e.g. --from TEST --to PROD (`norbix env list`).',
        docs: 'norbix env promote --help',
      })
    }

    const choices = parseChoices(flags)
    const body = (dryRun: boolean): PromoteBody => ({
      sourceEnv: source,
      targetEnv: target,
      dryRun,
      ...(flags['confirm-record-loss'] ? {confirmRecordLoss: true} : {}),
      ...(choices.length > 0 ? {integrationChoices: choices} : {}),
    })
    const extra = [choiceFlags(choices), flags['confirm-record-loss'] ? '--confirm-record-loss' : ''].filter(Boolean).join(' ')
    const rerun = `norbix env promote --from ${source} --to ${target}${extra ? ` ${extra}` : ''}`
    // `--dry-run` here is the Hub's preview: the request IS sent (with dryRun: true).
    const client = this.client({...flags, 'dry-run': false})
    const call = async (dryRun: boolean) => {
      try {
        return (await client.hub.account.promoteEnvironment(body(dryRun) as never)) as unknown as {item?: PromotionResult}
      } catch (error) {
        throw this.explain(error, {source, target, dryRun, rerun})
      }
    }

    const askAfterPreview = !flags.yes && !flags['dry-run'] && this.isInteractive()
    if (flags.yes) {
      const res = await call(false)
      this.show(res, {source, target, dryRun: false, rerun})
      // The project's content changed; the env list itself did not.
      return res
    }

    const preview = await call(true)
    this.show(preview, {source, target, dryRun: true, rerun})
    if (!askAfterPreview || preview.item?.summary?.isNoOp || (preview.item?.blockers?.length ?? 0) > 0) return preview

    const {confirm} = await import('@inquirer/prompts')
    if (preview.item?.requiresConfirmation && !flags['confirm-record-loss']) {
      this.log('Re-run with --confirm-record-loss to apply a plan that hides records.')
      return preview
    }

    if (!(await confirm({message: `Promote ${source} → ${target} now?`, default: false}))) {
      throw new CliError({exit: EXIT.CANCELLED, code: 'CANCELLED', message: 'Cancelled. Nothing was changed.'})
    }

    const res = await call(false)
    this.log('')
    this.show(res, {source, target, dryRun: false, rerun})
    return res
  }

  private show(res: {item?: PromotionResult}, ctx: {source: string; target: string; dryRun: boolean; rerun: string}): void {
    if (this.jsonEnabled()) return // oclif prints the returned answer
    this.log(renderPromotion(res.item ?? {}, {kind: 'promote', ...ctx}))
  }

  /** A refusal that carries the plan: print the plan (text mode), then a clear error. */
  private explain(error: unknown, ctx: {source: string; target: string; dryRun: boolean; rerun: string}): unknown {
    const e = error as {raw?: unknown; code?: string; errorCode?: string; message?: string}
    const plan = planOfError(e.raw)
    const code = e.errorCode ?? e.code
    if (plan && !this.jsonEnabled()) this.log(renderPromotion(plan, {kind: 'promote', ...ctx, dryRun: true}) + '\n')
    if (code === RECORD_LOSS_CODE) {
      return new CliError({
        exit: EXIT.CONFIRMATION_REQUIRED,
        code,
        message: `The promotion would hide records in ${ctx.target} (collections deleted there still hold records). Nothing was changed.`,
        hint: `Check the DELETED items of the preview. If that is intended, re-run with --confirm-record-loss: ${ctx.rerun} --yes --confirm-record-loss`,
        docs: 'norbix env promote --help',
        ...(plan ? {context: {plan}} : {}),
      })
    }

    return error
  }
}
