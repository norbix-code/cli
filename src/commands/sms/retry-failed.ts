import {RetryFailedCommand, retryFailedArgs, retryFailedFlags} from '../../lib/notification-commands.js'

export default class SmsRetryFailed extends RetryFailedCommand {
  static description = `Send the failed SMS recipients of a campaign again

Only recipients whose send failed are sent again — never one the provider
accepted — each as a new attempt with the same notification id. --key is your
idempotency key: the same key again does nothing and returns the first answer,
so a retried script never sends twice. Recipients whose failure is Ambiguous
(a timeout after the request went out) are skipped unless --include-ambiguous,
which may send a duplicate. See which rows are failed first:
\`norbix sms notifications <campaignId> --state failed\`. In a non-PROD
environment the Sandbox provider fails on purpose for magic recipients such as
+99900000002 (Sandbox, non-PROD).`

  static examples = [
    '<%= config.bin %> sms retry-failed 66b2f0a1c3d4e5f6a7b8c9d0 --key retry-1',
    '<%= config.bin %> sms retry-failed 66b2f0a1c3d4e5f6a7b8c9d0 --key retry-2 --category Transient --category Unknown',
    '<%= config.bin %> sms retry-failed 66b2f0a1c3d4e5f6a7b8c9d0 --key retry-3 --notification n_1 --notification n_2 --include-ambiguous',
    '<%= config.bin %> sms retry-failed 66b2f0a1c3d4e5f6a7b8c9d0 --key retry-1 --dry-run',
  ]

  static args = retryFailedArgs
  static flags = retryFailedFlags
  protected readonly channel = 'sms' as const

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(SmsRetryFailed)
    return this.retry(args, flags)
  }
}
