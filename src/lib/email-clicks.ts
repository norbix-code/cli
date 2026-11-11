import {usageError} from './cli-error.js'

/**
 * Email click ids (`nblid`) — gateway docs/tasks/email-tracking-links.md.
 *
 * When the project's switch is on, every web link of a marketing email gets
 * `?nblid=<click id>`. Norbix never sees the click itself: the project's own
 * site, server logs or analytics hand the value back with
 * `POST /{version}/notifications/email/clicks` (1–500 clicks per call).
 */

/** The most clicks one `POST /notifications/email/clicks` takes (CM-ERRORS-EMAILS-030 above it). */
export const CLICKS_PER_BATCH = 500

/** What the switch's warning says, wherever it is printed. */
export const CLICK_TRACKING_WARNING =
  'Clicks come back only from sites you own: your pages, server logs or analytics must read the nblid from the opened link and send it back (`norbix email clicks import <file>`). A link to a site you do not own never reports a click.'

/** One click as the gateway takes it (EmailClickDto). */
export interface EmailClick {
  nblid: string
  url?: string
  clickedAt?: string
  userAgent?: string
}

/** One click's outcome as the gateway answers it (EmailClickResultDto). */
export interface EmailClickResult {
  index: number
  status: string
  reason?: string
  flag?: string
  flagReason?: string
  campaignId?: string
  notificationId?: string
  linkIndex?: number
  to?: string[]
}

/** The gateway's answer to one batch (RecordEmailClicksResponse). */
export interface RecordEmailClicksAnswer {
  recorded?: number
  duplicates?: number
  flagged?: number
  rejected?: number
  clicks?: EmailClickResult[]
}

/** The columns a CSV may have, by their lower-case name. */
const COLUMNS: Record<string, keyof EmailClick> = {
  nblid: 'nblid',
  url: 'url',
  clickedat: 'clickedAt',
  useragent: 'userAgent',
}

/**
 * Parse RFC 4180 CSV: quoted fields with commas, quotes (`""`) and line
 * breaks inside, CRLF or LF line ends, blank lines skipped. A user agent such
 * as `Mozilla/5.0 (KHTML, like Gecko)` holds commas, so a plain split breaks.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let i = 0
  const endRow = () => {
    row.push(field)
    field = ''
    // A blank line is one empty field: not a row.
    if (row.length > 1 || row[0] !== '') rows.push(row)
    row = []
  }

  while (i < text.length) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }

        quoted = false
        i++
        continue
      }

      field += c
      i++
      continue
    }

    if (c === '"' && field === '') {
      quoted = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      endRow()
    } else {
      field += c
    }

    i++
  }

  if (quoted) throw usageError('The CSV ends inside a quoted field: a closing " is missing.', 'Check the quotes of the last row.')
  if (field !== '' || row.length > 0) endRow()
  return rows
}

/** A CSV with a header row (nblid, url, clickedAt, userAgent — any order, any case) → clicks. */
function clicksFromCsv(text: string): Array<Record<string, unknown>> {
  const [header, ...rows] = parseCsv(text)
  if (!header) return []
  const names = header.map((h) => h.trim())
  const keys = names.map((n) => COLUMNS[n.toLowerCase()])
  const unknown = names.filter((_, i) => !keys[i])
  if (unknown.length > 0) {
    throw usageError(
      `Unknown CSV column${unknown.length > 1 ? 's' : ''}: ${unknown.map((u) => `"${u}"`).join(', ')}.`,
      'The first row names the columns: nblid, url, clickedAt, userAgent (any order; only nblid is required).',
    )
  }

  if (!keys.includes('nblid')) throw usageError('The CSV has no nblid column.', 'The first row names the columns: nblid, url, clickedAt, userAgent.')
  return rows.map((cells) => {
    const click: Record<string, unknown> = {}
    keys.forEach((key, i) => {
      const value = (cells[i] ?? '').trim()
      if (key && value !== '') click[key] = value
    })
    return click
  })
}

/** A JSON array of clicks, or the request body `{clicks: [...]}`. */
function clicksFromJson(text: string): Array<Record<string, unknown>> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw usageError(`The file is not valid JSON: ${(error as Error).message}`, 'Give a JSON array of clicks, or a CSV with the columns nblid, url, clickedAt, userAgent.')
  }

  const list = Array.isArray(parsed) ? parsed : (parsed as {clicks?: unknown} | null)?.clicks
  if (!Array.isArray(list)) throw usageError('The JSON is not an array of clicks.', 'Give [{"nblid": "...", "url": "...", "clickedAt": "...", "userAgent": "..."}, ...].')
  return list.map((item, i) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) throw usageError(`Row ${i + 1} is not an object.`, 'Each click is {"nblid": "...", ...}.')
    return item as Record<string, unknown>
  })
}

/**
 * Read a clicks file: a JSON array (or `{clicks: [...]}`) or a CSV with a
 * header row. Checks every row before anything is sent: the file is not
 * empty, every row has an nblid, the values are text and clickedAt is a time.
 * Rows are numbered from 1 (the CSV header not counted).
 */
export function parseClicksFile(text: string): EmailClick[] {
  const body = text.replace(/^﻿/, '')
  if (body.trim() === '') throw usageError('The file is empty: no clicks to send.', 'Give a JSON array of clicks, or a CSV with a header row and one click per row.')
  const raw = body.trimStart().startsWith('[') || body.trimStart().startsWith('{') ? clicksFromJson(body) : clicksFromCsv(body)
  if (raw.length === 0) throw usageError('The file has no clicks.', 'Add one click per row (a CSV needs a header row and at least one row under it).')

  const problems: string[] = []
  const clicks = raw.map((row, i) => {
    const n = i + 1
    const click: Partial<EmailClick> = {}
    for (const [key, value] of Object.entries(row)) {
      const field = COLUMNS[key.toLowerCase()]
      if (!field) {
        problems.push(`row ${n}: unknown field "${key}"`)
        continue
      }

      if (value === null || value === undefined || value === '') continue
      if (typeof value !== 'string') {
        problems.push(`row ${n}: ${field} must be text`)
        continue
      }

      click[field] = value.trim()
    }

    if (!click.nblid) problems.push(`row ${n}: no nblid`)
    else if (click.clickedAt && Number.isNaN(Date.parse(click.clickedAt))) problems.push(`row ${n}: clickedAt "${click.clickedAt}" is not a time`)
    return click as EmailClick
  })

  if (problems.length > 0) {
    const shown = problems.slice(0, 10)
    const more = problems.length - shown.length
    throw usageError(
      `Nothing was sent — ${problems.length} row${problems.length > 1 ? 's' : ''} cannot be sent:\n  ${shown.join('\n  ')}${more > 0 ? `\n  … and ${more} more` : ''}`,
      'Every row needs the nblid from the opened link; url, clickedAt (an ISO time, UTC when it has no zone) and userAgent are optional.',
    )
  }

  return clicks
}

/** Split into batches of at most `size`. */
export function batches<T>(items: T[], size = CLICKS_PER_BATCH): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** One rejected row of the file, with its row number (from 1) across all batches. */
export interface RejectedRow {
  row: number
  nblid: string
  reason?: string
}

/** The totals of every batch, and the rejected rows numbered by their place in the file. */
export interface ClicksImportSummary {
  clicks: number
  batches: number
  recorded: number
  duplicates: number
  flagged: number
  rejected: number
  rejectedRows: RejectedRow[]
}

/**
 * Add the batch answers up. The gateway numbers `index` from 0 within each
 * request, so the batch's first row is added to it.
 */
export function summarize(clicks: EmailClick[], answers: RecordEmailClicksAnswer[], size = CLICKS_PER_BATCH): ClicksImportSummary {
  const summary: ClicksImportSummary = {clicks: clicks.length, batches: answers.length, recorded: 0, duplicates: 0, flagged: 0, rejected: 0, rejectedRows: []}
  answers.forEach((answer, b) => {
    summary.recorded += answer.recorded ?? 0
    summary.duplicates += answer.duplicates ?? 0
    summary.flagged += answer.flagged ?? 0
    summary.rejected += answer.rejected ?? 0
    for (const result of answer.clicks ?? []) {
      if (result.status !== 'rejected') continue
      const at = b * size + result.index
      summary.rejectedRows.push({row: at + 1, nblid: clicks[at]?.nblid ?? '', ...(result.reason ? {reason: result.reason} : {})})
    }
  })
  return summary
}

/** The lines `email clicks import` prints. */
export function formatSummary(summary: ClicksImportSummary): string[] {
  const lines = [
    `Sent ${summary.clicks} click${summary.clicks === 1 ? '' : 's'} in ${summary.batches} batch${summary.batches === 1 ? '' : 'es'}.`,
    `recorded: ${summary.recorded}  duplicates: ${summary.duplicates}  flagged: ${summary.flagged}  rejected: ${summary.rejected}`,
  ]
  if (summary.rejectedRows.length > 0) {
    lines.push('Rejected:')
    for (const r of summary.rejectedRows) lines.push(`  row ${r.row}  ${r.nblid}  ${r.reason ?? 'rejected'}`)
  }

  return lines
}
