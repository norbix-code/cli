import {Flags} from '@oclif/core'

import {BaseCommand} from '../../base.js'
import {EVENT_SOURCES, eventSource} from '../../lib/code.js'

export default class CodeEventSample extends BaseCommand {
  static description = `Print a sample event envelope — the fixture for a local run of your function

The exact JSON a function receives for the source (and event) with sample data: specVersion, event, source, context (ids, environment, hub/api urls, a placeholder runAs token), data (one slot per source) and config. Write it to a file and run the handler with \`sam local invoke\`, \`func start\` or the Functions Framework.`

  static examples = [
    '<%= config.bin %> code event-sample --source database --event database.record.updated --schema sch_7lPCzWonEvTQsheGDCaKq > event.json',
    '<%= config.bin %> code event-sample --source scheduler',
    '<%= config.bin %> code event-sample --source manual --json',
  ]

  static flags = {
    source: Flags.string({
      required: true,
      description: `Event source: ${Object.keys(EVENT_SOURCES).join(', ')}`,
      options: Object.keys(EVENT_SOURCES),
    }),
    event: Flags.string({description: 'Event name, e.g. database.record.updated; default: the usual event of the source'}),
    schema: Flags.string({description: 'Schema ID (sch_…) for data.database.schemaId (database source)'}),
  }

  async run(): Promise<unknown> {
    const {flags} = await this.parse(CodeEventSample)
    const client = this.client(flags)

    const res = await client.hub.code.getCodeFunctionEventSample({
      source: eventSource(flags.source),
      event: flags.event,
      schemaId: flags.schema,
    } as Parameters<typeof client.hub.code.getCodeFunctionEventSample>[0])

    // The envelope alone, so `> event.json` is a fixture a local runner takes as-is.
    const sample = (res as {sample?: unknown} | undefined)?.sample ?? res
    this.print(sample)
    return sample
  }
}
