import type {Norbix} from '@norbix.ai/ts'
import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {CliError, usageError} from '../../lib/cli-error.js'
import {EXIT} from '../../lib/exit-codes.js'
import {readJsonInput} from '../../lib/json.js'
import {refuseEmptyFilter} from '../../lib/records.js'

export default class DbDelete extends BaseCommand {
  static description = `Delete records: one by --id, the one record a --filter matches, many by --filter with --many, or every record with --all

--filter alone deletes exactly one record: the CLI first reads which records
match (one read; a --dry-run sends nothing); one match is
deleted by its id, none exits 5, and more than one is refused (exit 2) — add
--many to delete them all, or narrow the filter. So a filter that was meant
for one record can never delete several.

An empty filter ('{}') is refused: it would delete the whole collection. Use
--all to do that on purpose. A caller with only "delete own" rights deletes
only the records it owns.`

  static examples = [
    '<%= config.bin %> db delete orders --id 66b2f0a1c3d4e5f6a7b8c9d0 --dry-run',
    '<%= config.bin %> db delete orders --id 66b2f0a1c3d4e5f6a7b8c9d0 --yes',
    `<%= config.bin %> db delete orders --filter '{"orderNo":"A-1001"}' --yes`,
    `<%= config.bin %> db delete orders --filter '{"status":"cancelled"}' --many --yes`,
    '<%= config.bin %> db delete orders --all --dry-run',
  ]

  static args = {
    collection: Args.string({required: true, description: 'Collection name'}),
  }

  static flags = {
    id: Flags.string({description: 'Record ID (single delete)', exclusive: ['many', 'filter', 'all']}),
    filter: Flags.string({char: 'f', description: 'JSON filter; alone it deletes the ONE matching record (refused when several match), with --many every match; must not be empty', exclusive: ['all']}),
    many: Flags.boolean({description: 'Delete every record matching --filter', default: false}),
    all: Flags.boolean({description: 'Delete EVERY record of the collection (sends allRecords: true)', default: false}),
    ...BaseCommand.mutatingFlags,
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(DbDelete)
    const client = this.client(flags)

    if (flags.all) {
      await this.confirmOrFail(`Delete EVERY record in "${args.collection}"?`, flags)
      const res = await client.api.database.deleteMany({collectionName: args.collection, filter: '{}', allRecords: true})
      this.print(res)
      return res
    }

    if (flags.many) {
      if (!flags.filter) this.error('--many requires --filter (or use --all to delete every record).')
      const filter = await readJsonInput(flags.filter, 'filter')
      refuseEmptyFilter(filter, 'delete')
      await this.confirmOrFail(`Delete ALL records in "${args.collection}" matching ${filter}?`, flags)

      const res = await client.api.database.deleteMany({collectionName: args.collection, filter})
      this.print(res)
      return res
    }

    if (flags.filter) {
      const filter = await readJsonInput(flags.filter, 'filter')
      refuseEmptyFilter(filter, 'delete')
      const id = await this.lookup(flags, '<id of the one record matching --filter>', (c) => onlyMatch(c, args.collection, filter))
      await this.confirmOrFail(`Delete the one record ${id} in "${args.collection}" matching ${filter}?`, flags)
      const res = await client.api.database.deleteOne({collectionName: args.collection, id})
      this.print(res)
      return res
    }

    if (!flags.id) this.error('Pass --id or --filter for a single delete, --filter with --many, or --all.')
    await this.confirmOrFail(`Delete record ${flags.id} from "${args.collection}"?`, flags)
    const res = await client.api.database.deleteOne({collectionName: args.collection, id: flags.id})
    this.print(res)
    return res
  }
}

/** The id of the only record `filter` matches; none → exit 5, several → exit 2. */
async function onlyMatch(client: Norbix, collection: string, filter: string): Promise<string> {
  const res = await client.api.database.find({collectionName: collection, filter, pageSize: 2})
  const items = (res.list?.items ?? []) as Array<{_id?: unknown}>
  if (items.length === 0) {
    throw new CliError({
      exit: EXIT.NOT_FOUND,
      code: 'NOT_FOUND',
      message: `No record in "${collection}" matches ${filter}.`,
      hint: `Check the filter with \`norbix db find ${collection} --filter '${filter}'\` (and --env).`,
      docs: 'norbix db delete --help',
    })
  }

  if (items.length > 1 || res.list?.hasMore) {
    throw usageError(
      `More than one record in "${collection}" matches ${filter}; --filter alone deletes exactly one.`,
      `Add --many to delete every match (preview with --dry-run, count with \`norbix db count ${collection} --filter '${filter}'\`), or narrow the filter.`,
      'norbix db delete --help',
    )
  }

  const raw = items[0]._id
  const id = typeof raw === 'object' && raw !== null && '$oid' in raw ? String((raw as {$oid: unknown}).$oid) : raw === undefined ? undefined : String(raw)
  if (!id) throw usageError(`The record matching ${filter} has no _id.`, 'Delete it with --many --filter instead.', 'norbix db delete --help')
  return id
}
