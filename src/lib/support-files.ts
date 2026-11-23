/**
 * Support case files: the rules the gateway checks (CM-ERRORS-SUPPORT-011…017),
 * checked here first so a wrong file is refused before anything is sent.
 *
 * No oclif import.
 */
import {extname} from 'node:path'

export const SUPPORT_FILE_MAX_BYTES = 10 * 1024 * 1024
export const SUPPORT_FILES_PER_CASE = 20

const TYPES: Record<string, string> = {
  csv: 'text/csv',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  json: 'application/json',
  log: 'text/plain',
  md: 'text/markdown',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odt: 'application/vnd.oasis.opendocument.text',
  pdf: 'application/pdf',
  png: 'image/png',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  webp: 'image/webp',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xml: 'application/xml',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  zip: 'application/zip',
}

/** The allowed extensions, in a line for a message. */
export const SUPPORT_FILE_KINDS = Object.keys(TYPES).join(' ')

/** The content type of an allowed file name; undefined when its kind is not allowed. */
export function supportFileType(fileName: string): string | undefined {
  return TYPES[extname(fileName).slice(1).toLowerCase()]
}
