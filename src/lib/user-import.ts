import {readFileSync} from 'node:fs'
import {extname} from 'node:path'

import {usageError} from './cli-error.js'

/**
 * `norbix users import`: the rows of POST /membership/users/import (gateway
 * ImportUsers.cs, client finding N7) read from a JSON or CSV file.
 */

/** The gateway takes at most this many users per request. */
export const MAX_ROWS_PER_REQUEST = 1000

export const HASH_FORMATS = ['servicestack-saltedhash', 'servicestack-pbkdf2']

export interface ImportRow {
  email?: string
  userName?: string
  userGeneralInfo?: Record<string, unknown>
  roles?: string[]
  createdOn?: number
  hashFormat?: string
  passwordHash?: string
  passwordSalt?: string
}

export interface ImportOutcome {
  row: number
  login?: string
  outcome: string
  userId?: string
  errors?: Array<{code?: string; message: string}>
}

export interface ImportReport {
  dryRun: boolean
  received: number
  imported: number
  valid: number
  existing: number
  invalid: number
  failed: number
  rows: ImportOutcome[]
}

const ROW_FIELDS = new Set(['email', 'userName', 'roles', 'createdOn', 'hashFormat', 'passwordHash', 'passwordSalt'])
/** CSV columns that go into userGeneralInfo (UserGeneralInfoDto). */
const PROFILE_FIELDS = new Set([
  'phone', 'primaryEmail', 'displayName', 'firstName', 'lastName', 'fullName', 'addressLine1', 'addressLine2',
  'country', 'city', 'state', 'postalCode', 'company', 'gender', 'birthDate', 'timeZone', 'language',
])

/** The users of a file: a JSON array (or `{"users": [...]}`), or a CSV with a header row. */
export function readImportFile(path: string): ImportRow[] {
  let text: string
  try {
    text = readFileSync(path, 'utf8').replace(/^﻿/, '')
  } catch (error) {
    throw usageError(`Cannot read ${path}: ${error instanceof Error ? error.message : String(error)}.`, undefined, 'norbix users import --help')
  }

  const rows = extname(path).toLowerCase() === '.csv' || (!text.trimStart().startsWith('[') && !text.trimStart().startsWith('{')) ? fromCsv(text) : fromJson(text, path)
  if (rows.length === 0) throw usageError(`${path} holds no users.`, undefined, 'norbix users import --help')
  return rows
}

function fromJson(text: string, path: string): ImportRow[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw usageError(`${path} is not valid JSON: ${error instanceof Error ? error.message : String(error)}.`, undefined, 'norbix users import --help')
  }

  const list = Array.isArray(parsed) ? parsed : (parsed as {users?: unknown})?.users
  if (!Array.isArray(list) || list.some((r) => typeof r !== 'object' || r === null || Array.isArray(r))) {
    throw usageError(`${path} must be a JSON array of users, or {"users": [...]}.`, 'One user: {"email": "…", "hashFormat": "servicestack-saltedhash", "passwordHash": "…", "passwordSalt": "…"}.', 'norbix users import --help')
  }

  return list as ImportRow[]
}

/** RFC 4180 CSV: a header row, quoted fields with "" for a quote. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      if (row.some((f) => f !== '')) rows.push(row)
      row = []
      field = ''
    } else field += c
  }

  row.push(field)
  if (row.some((f) => f !== '')) rows.push(row)
  return rows
}

function fromCsv(text: string): ImportRow[] {
  const [header, ...lines] = parseCsv(text)
  if (!header) return []
  const columns = header.map((h) => h.trim())
  const unknown = columns.filter((c) => !ROW_FIELDS.has(c) && !PROFILE_FIELDS.has(c))
  if (unknown.length > 0) {
    throw usageError(
      `Unknown CSV column${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}.`,
      `Columns: ${[...ROW_FIELDS].join(', ')} (roles separated by ";"), and profile fields: ${[...PROFILE_FIELDS].join(', ')}.`,
      'norbix users import --help',
    )
  }

  return lines.map((cells) => {
    const row: ImportRow = {}
    const info: Record<string, unknown> = {}
    columns.forEach((column, i) => {
      const value = (cells[i] ?? '').trim()
      if (!value) return
      if (column === 'roles') row.roles = value.split(';').map((r) => r.trim()).filter(Boolean)
      else if (column === 'createdOn') row.createdOn = /^\d+$/.test(value) ? Number(value) : Date.parse(value)
      else if (column === 'birthDate') info.birthDate = /^\d+$/.test(value) ? Number(value) : Date.parse(value)
      else if (ROW_FIELDS.has(column)) (row as Record<string, unknown>)[column] = value
      else info[column] = value
    })
    if (Object.keys(info).length > 0) row.userGeneralInfo = info
    return row
  })
}

/** Split into requests of at most MAX_ROWS_PER_REQUEST users. */
export function batches<T>(rows: T[], size = MAX_ROWS_PER_REQUEST): T[][] {
  const out: T[][] = []
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size))
  return out
}

/** One report for several requests: counts added, row numbers continued. */
export function mergeReports(reports: Array<{report: ImportReport; offset: number}>): ImportReport {
  const total: ImportReport = {dryRun: true, received: 0, imported: 0, valid: 0, existing: 0, invalid: 0, failed: 0, rows: []}
  for (const {report, offset} of reports) {
    total.dryRun = report.dryRun
    for (const key of ['received', 'imported', 'valid', 'existing', 'invalid', 'failed'] as const) total[key] += report[key] ?? 0
    total.rows.push(...(report.rows ?? []).map((r) => ({...r, row: r.row + offset})))
  }

  return total
}

/** The request body for a dry-run print: hashes and salts masked. */
export function redactRows(body: unknown): unknown {
  const b = body as {users?: ImportRow[]}
  if (!b?.users) return body
  return {...b, users: b.users.map((u) => ({...u, ...(u.passwordHash ? {passwordHash: '***'} : {}), ...(u.passwordSalt ? {passwordSalt: '***'} : {})}))}
}

/** The per-row table. */
export function reportTable(report: ImportReport): string {
  const lines = report.rows.map((r) => {
    const errors = (r.errors ?? []).map((e) => `${e.code ? `${e.code} ` : ''}${e.message}`).join('; ')
    return [String(r.row).padStart(5), r.outcome.padEnd(8), (r.login ?? '').padEnd(32), r.userId ?? '', errors].join('  ').trimEnd()
  })
  return ['  row  outcome   login                             user / errors', ...lines].join('\n')
}
