import {Flags} from '@oclif/core'

import {BaseCommand} from '../../../base.js'
import {parseMetadata, parseOrderLine, readJsonObject} from '../../../lib/payments.js'

export default class PaymentsOrderCreate extends BaseCommand {
  static description = `Create a payment order for one buyer

The price is yours: give each line as --line sku:quantity:unitCents[:title]
(repeat for several); Norbix adds up the total in cents. --key is the
idempotency key (8 characters or more): the same key with the same body
returns the same order, the same key with another body is refused. Needs a
key whose role may create orders (Payments — full access, or Administrator).
--file takes the whole body as JSON instead (inline, @file.json or -), with
the flags on top.`

  static examples = [
    '<%= config.bin %> payments order create --buyer usr_1szWVIyZFBV8HfvC4SfVw --reference ad-1042-promo-1 --key promo-1042-0001 --line star-day:21:30 --meta adId=ad_1042',
    '<%= config.bin %> payments order create --file @order.json',
    '<%= config.bin %> payments order create --file @order.json --dry-run',
  ]

  static flags = {
    ...BaseCommand.dryRunFlags,
    buyer: Flags.string({description: 'The buyer (a project user id, usr_…)'}),
    reference: Flags.string({description: 'Your own reference for the order (unique in the project, no spaces)'}),
    key: Flags.string({description: 'Idempotency key, 8 characters or more'}),
    currency: Flags.string({description: 'Currency (EUR only for now; default EUR)'}),
    'price-version': Flags.string({description: 'The version of your price list the lines come from (default v1)'}),
    line: Flags.string({multiple: true, description: 'Order line sku:quantity:unitCents[:title] (repeat for several)'}),
    meta: Flags.string({multiple: true, description: 'Metadata key=value (repeat for several)'}),
    file: Flags.string({description: 'The whole request body as JSON, @file or -'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(PaymentsOrderCreate)
    const client = this.client(flags)

    const fromFile = flags.file ? await readJsonObject(flags.file, 'file') : {}
    let lines: ReturnType<typeof parseOrderLine>[] | undefined
    let metadata: Record<string, string> | undefined
    try {
      lines = flags.line?.map(parseOrderLine)
      metadata = parseMetadata(flags.meta)
    } catch (error) {
      this.error((error as Error).message, {exit: 2})
    }

    const body: Record<string, unknown> = {...fromFile}
    if (flags.buyer) body.buyerUserId = flags.buyer
    if (flags.reference) body.merchantReference = flags.reference
    if (flags.key) body.idempotencyKey = flags.key
    body.currency = flags.currency ?? fromFile.currency ?? 'EUR'
    body.priceVersion = flags['price-version'] ?? fromFile.priceVersion ?? 'v1'
    if (lines) body.lines = lines
    if (metadata) body.metadata = {...(fromFile.metadata as Record<string, string> | undefined), ...metadata}

    const res = await client.api.payments.createPaymentOrder(body as Parameters<typeof client.api.payments.createPaymentOrder>[0])

    this.print(res)
    return res
  }
}
