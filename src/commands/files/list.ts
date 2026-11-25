import {Args, Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {integrationFlag, resolveIntegration} from '../../lib/files.js'

/** The parts of a list answer this command reads. */
interface FilesPage {
  folders?: string[]
  list?: {hasMore?: boolean; items?: unknown[]; startingAfter?: string}
  publicFolders?: Array<{path?: string}>
  [key: string]: unknown
}

/**
 * --all stops after this many pages even when the server still says "more".
 * 1,000 pages of 1,000 entries is a million entries — more than a terminal
 * listing is for, and a hard stop if a cursor ever loops.
 */
const MAX_PAGES = 1000

export default class FilesList extends BaseCommand {
  static description = `List files in a folder of a files integration

One call returns one page: at most --page-size entries (server default 50),
files and sub-folders together. When the answer has list.hasMore = true, pass
its list.startingAfter to --after to read the next page, or use --all to read
every page in one go. A sub-folder shows on the page where it sorts, so a
folder with many entries needs every page before you have all its sub-folders.`

  static examples = [
    '<%= config.bin %> files list --integration 66b2f0a1c3d4e5f6a7b8c9d0',
    '<%= config.bin %> files list invoices/2026',
    '<%= config.bin %> files list invoices/2026 --page-size 200',
    '<%= config.bin %> files list invoices/2026 --after <list.startingAfter of the page before>',
    '<%= config.bin %> files list invoices/2026 --all',
  ]

  static args = {
    path: Args.string({required: false, description: 'Folder path (default: root)'}),
  }

  static flags = {
    integration: integrationFlag,
    'page-size': Flags.integer({description: 'Entries per page (server default 50)', min: 1}),
    after: Flags.string({
      description: 'Cursor: fetch the page after this one (list.startingAfter of the page before)',
    }),
    all: Flags.boolean({
      description: 'Read every page and print one merged list',
      default: false,
    }),
  }

  async run(): Promise<unknown> {
    const {args, flags} = await this.parse(FilesList)
    const client = this.client(flags)
    const integration = resolveIntegration(flags.integration, this.resolveContext(flags).filesIntegrationId)
    if (!integration) {
      this.error('No files integration ID. Pass --integration or run `norbix config set filesIntegrationId <id>`.')
    }

    // Only set fields are sent, so a plain `files list` sends the same request as before.
    const fetchPage = (after: string | undefined) =>
      client.api.files.listFiles({
        filesIntegrationId: integration,
        path: args.path,
        ...(flags['page-size'] === undefined ? {} : {pageSize: flags['page-size']}),
        ...(after ? {startingAfter: after} : {}),
      }) as unknown as Promise<FilesPage>

    if (!flags.all) {
      const res = await fetchPage(flags.after)
      this.print(res)
      return res
    }

    // --all: follow list.startingAfter until the server says there is no more.
    const items: unknown[] = []
    const folders = new Set<string>()
    const publicFolders = new Map<string, {path?: string}>()
    const seenCursors = new Set<string>()
    let cursor = flags.after
    let last: FilesPage = {}
    let pages = 0
    let stoppedEarly = false

    for (;;) {
      last = await fetchPage(cursor)
      pages++
      items.push(...(last.list?.items ?? []))
      for (const folder of last.folders ?? []) folders.add(folder)
      for (const folder of last.publicFolders ?? []) publicFolders.set(folder.path ?? '', folder)

      const next = last.list?.hasMore ? last.list.startingAfter : undefined
      if (!next) break
      // A cursor seen before means the listing started over; a page cap stops a runaway.
      if (seenCursors.has(next) || pages >= MAX_PAGES) {
        stoppedEarly = true
        cursor = next
        break
      }

      seenCursors.add(next)
      cursor = next
    }

    if (stoppedEarly) {
      this.warn(`Stopped after ${pages} page(s) before the end of the folder. Continue with --after ${cursor}`)
    }

    const merged = {
      ...last,
      folders: [...folders],
      list: {
        ...last.list,
        hasMore: stoppedEarly,
        items,
        ...(stoppedEarly ? {startingAfter: cursor} : {startingAfter: undefined}),
      },
      publicFolders: [...publicFolders.values()],
    }

    this.print(merged)
    return merged
  }
}
