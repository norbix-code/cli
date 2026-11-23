import {Args, Flags} from '@oclif/core'
import {readFile, stat} from 'node:fs/promises'
import {basename, resolve} from 'node:path'

import {BaseCommand} from '../../base.js'
import {usageError} from '../../lib/cli-error.js'
import {SUPPORT_FILE_KINDS, SUPPORT_FILE_MAX_BYTES, supportFileType} from '../../lib/support-files.js'

interface PlannedFile {
  path: string
  fileName: string
  contentType: string
  sizeBytes: number
}

export default class SupportAttach extends BaseCommand {
  static description = `Add files to one of your support cases (a log, a screenshot, a config file)

Each file is sent on its own. At most 10 MB per file and 20 files per case.
Allowed: ${SUPPORT_FILE_KINDS}.
Look at a file before you send it: never attach one that holds a secret, a key, a token or a password.`

  static examples = [
    '<%= config.bin %> support attach sup_1o5A0SxVXzWo9yqOfmQf8F ./app.log',
    '<%= config.bin %> support attach sup_1o5A0SxVXzWo9yqOfmQf8F ./app.log ./screen.png --json',
    '<%= config.bin %> support attach sup_1o5A0SxVXzWo9yqOfmQf8F ./app.log --dry-run',
  ]

  static strict = false

  static args = {
    caseId: Args.string({required: true, description: 'Support case id (sup_…)'}),
    file: Args.string({required: true, description: 'File to add; give several to add several'}),
  }

  static flags = {
    ...BaseCommand.dryRunFlags,
    name: Flags.string({description: "Name shown on the case (one file only; default the file's own name)"}),
  }

  async run(): Promise<unknown> {
    const {args, argv, flags} = await this.parse(SupportAttach)
    const paths = (argv as string[]).slice(1)
    if (paths.length === 0) throw usageError('No file given.', 'Name at least one file after the case id.', 'norbix support attach --help')
    if (flags.name && paths.length > 1) {
      throw usageError('--name works with one file only.', 'Drop --name, or add the files one by one.', 'norbix support attach --help')
    }

    // Check every file before sending any, so a bad one does not leave half the list sent.
    const planned: PlannedFile[] = []
    for (const p of paths) {
      const full = resolve(p)
      const info = await stat(full).catch(() => undefined)
      if (!info?.isFile()) throw usageError(`${p} is not a file.`, 'Check the path.', 'norbix support attach --help')
      if (info.size > SUPPORT_FILE_MAX_BYTES) {
        throw usageError(`${p} is ${info.size} bytes; a support case file may be at most 10 MB.`, 'Send a smaller file, or zip it.', 'norbix support attach --help')
      }

      const fileName = flags.name?.trim() || basename(full)
      const contentType = supportFileType(fileName)
      if (!contentType) {
        throw usageError(`${fileName}: this kind of file cannot be added to a support case.`, `Allowed: ${SUPPORT_FILE_KINDS}.`, 'norbix support attach --help')
      }

      planned.push({path: full, fileName, contentType, sizeBytes: info.size})
    }

    if (flags['dry-run']) {
      return this.dryRun({
        method: 'hub.support.addSupportCaseAttachment',
        request: {caseId: args.caseId, files: planned.map(({fileName, contentType, sizeBytes}) => ({fileName, contentType, sizeBytes}))},
      })
    }

    const client = this.client(flags)
    const added: {fileName: string; id?: string; sizeBytes: number}[] = []
    for (const f of planned) {
      // eslint-disable-next-line no-await-in-loop -- one file per call, in order
      const file = new Uint8Array(await readFile(f.path))
      // eslint-disable-next-line no-await-in-loop
      const res = await client.hub.support.addSupportCaseAttachment({caseId: args.caseId, file, fileName: f.fileName, contentType: f.contentType})
      added.push({fileName: f.fileName, id: res?.id, sizeBytes: f.sizeBytes})
    }

    const result = {caseId: args.caseId, added}
    this.print(added.map((a) => `Added ${a.fileName} (${a.sizeBytes} bytes) → ${a.id ?? '?'}`).join('\n'))
    return result
  }
}
