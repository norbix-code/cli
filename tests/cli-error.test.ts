import {describe, expect, it} from 'vitest'

import {CliError, fieldErrorsOf, formatErrorText, toEnvelope, traceIdOf, usageError} from '../src/lib/cli-error.js'
import {EXIT, EXIT_CODES, exitForStatus} from '../src/lib/exit-codes.js'

/** A stand-in for the SDK's NorbixError family (duck-typed by name + status). */
function sdkError(name: string, init: {message: string; status: number; code?: string; raw?: unknown; url?: string; fieldErrors?: unknown[]}): Error {
  const err = Object.assign(new Error(init.message), init)
  err.name = name
  return err
}

describe('exit codes', () => {
  it('maps HTTP statuses to the documented codes', () => {
    expect(exitForStatus(401)).toBe(EXIT.AUTH)
    expect(exitForStatus(403)).toBe(EXIT.AUTH)
    expect(exitForStatus(404)).toBe(EXIT.NOT_FOUND)
    expect(exitForStatus(400)).toBe(EXIT.VALIDATION)
    expect(exitForStatus(422)).toBe(EXIT.VALIDATION)
    expect(exitForStatus(429)).toBe(EXIT.SERVER)
    expect(exitForStatus(503)).toBe(EXIT.SERVER)
    expect(exitForStatus(200)).toBe(EXIT.VALIDATION)
  })

  it('documents every code once, 0 to 9', () => {
    expect(EXIT_CODES.map((c) => c.code)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })
})

describe('toEnvelope', () => {
  it('passes a CliError through with its hint and docs', () => {
    const env = toEnvelope(new CliError({exit: EXIT.CONFIRMATION_REQUIRED, code: 'CONFIRMATION_REQUIRED', message: 'Confirmation required: x', hint: 'Re-run with --yes.'}), {command: 'users delete'})
    expect(env).toEqual({
      code: 'CONFIRMATION_REQUIRED',
      message: 'Confirmation required: x',
      exit: 3,
      hint: 'Re-run with --yes.',
      docs: 'norbix users delete --help',
    })
  })

  it('maps a 404 from the SDK, keeping the body code and trace id', () => {
    const env = toEnvelope(sdkError('NorbixError', {message: 'User not found', status: 404, raw: {code: 'USER_NOT_FOUND', traceId: 't-1'}, url: 'http://x/u/1'}), {command: 'users get'})
    expect(env.exit).toBe(5)
    expect(env.code).toBe('USER_NOT_FOUND')
    expect(env.status).toBe(404)
    expect(env.traceId).toBe('t-1')
    expect(env.url).toBe('http://x/u/1')
    expect(env.hint).toMatch(/Check the id/)
  })

  it('maps a network error to exit 7 without a status', () => {
    const env = toEnvelope(sdkError('NorbixNetworkError', {message: 'fetch failed', status: 0, code: 'NORBIX_NETWORK_ERROR', url: 'http://localhost:1/v2/x'}))
    expect(env.exit).toBe(7)
    expect(env.status).toBeUndefined()
    expect(env.hint).toContain('http://localhost:1/v2/x')
  })

  it('maps the SDK’s local "not authenticated" to exit 4', () => {
    const env = toEnvelope(sdkError('NorbixError', {message: 'Norbix is not authenticated.', status: 0, code: 'NORBIX_NOT_AUTHENTICATED'}))
    expect(env.exit).toBe(4)
  })

  it('maps a 403 to exit 4 with the permission hint', () => {
    const env = toEnvelope(sdkError('NorbixAuthError', {message: 'Forbidden', status: 403}))
    expect(env.exit).toBe(4)
    expect(env.hint).toMatch(/permission/)
  })

  it('keeps the gateway code and the context of the matching error item', () => {
    const env = toEnvelope(
      sdkError('NorbixAuthError', {
        message: "Caller is missing required permission 'db:read'.",
        status: 403,
        code: 'CM-ERRORS-MEMBERSHIP-039',
        fieldErrors: [
          {message: 'other', errorCode: 'CM-ERRORS-X-001', meta: {a: 'b'}},
          {message: "Caller is missing required permission 'db:read'.", errorCode: 'CM-ERRORS-MEMBERSHIP-039', meta: {missingPermissions: 'db:read'}},
        ],
      }),
    )
    expect(env).toMatchObject({code: 'CM-ERRORS-MEMBERSHIP-039', status: 403, exit: 4, context: {missingPermissions: 'db:read'}})
    expect(formatErrorText(env)).toContain('  code: CM-ERRORS-MEMBERSHIP-039\n  status: 403\n  context.missingPermissions: db:read')
  })

  it('has no context when no error item carries one', () => {
    const env = toEnvelope(sdkError('NorbixError', {message: 'Not found', status: 404, code: 'CM-ERRORS-FILES-004', fieldErrors: [{message: 'Not found', errorCode: 'CM-ERRORS-FILES-004'}]}))
    expect(env.context).toBeUndefined()
    expect(env.code).toBe('CM-ERRORS-FILES-004')
  })

  it('maps a 500 to exit 8', () => {
    expect(toEnvelope(sdkError('NorbixError', {message: 'boom', status: 500})).exit).toBe(8)
  })

  it('cleans the oclif parser message and exits 2', () => {
    const err = Object.assign(new Error('The following error occurred:\n  Missing required flag update\nSee more help with --help'), {oclif: {exit: 2}, parse: {}})
    const env = toEnvelope(err, {command: 'db update'})
    expect(env).toMatchObject({code: 'USAGE_ERROR', exit: 2, message: 'Missing required flag update', docs: 'norbix db update --help'})
  })

  it('treats Ctrl+C at a prompt as cancelled, exit 9', () => {
    const err = new Error('User force closed the prompt')
    err.name = 'ExitPromptError'
    expect(toEnvelope(err)).toEqual({code: 'CANCELLED', message: 'Cancelled.', exit: 9})
  })

  it('maps an unknown error to exit 1', () => {
    const env = toEnvelope(new TypeError('x is not a function'))
    expect(env).toMatchObject({code: 'INTERNAL_ERROR', exit: 1, message: 'x is not a function'})
  })

  it('usageError is exit 2', () => {
    expect(toEnvelope(usageError('bad', 'do this')).exit).toBe(2)
  })
})

describe('field errors and trace ids', () => {
  it('reads both the item list and the object map', () => {
    expect(fieldErrorsOf({errors: {email: ['is required']}}, [{fieldName: 'name', message: 'too short'}])).toEqual({
      name: ['too short'],
      email: ['is required'],
    })
  })

  it('is absent when nothing names a field', () => {
    expect(fieldErrorsOf({message: 'x'}, [{message: 'no field'}])).toBeUndefined()
  })

  it('finds the correlation id inside responseStatus.meta', () => {
    expect(traceIdOf({responseStatus: {meta: {correlationId: 'c-9'}}})).toBe('c-9')
    expect(traceIdOf({correlationId: 'top'})).toBe('top')
    expect(traceIdOf('text')).toBeUndefined()
  })
})

describe('formatErrorText', () => {
  it('renders message, details, hint and docs with no ANSI codes', () => {
    const text = formatErrorText({
      code: 'USER_NOT_FOUND',
      message: 'User not found',
      status: 404,
      exit: 5,
      url: 'http://x/u/1',
      traceId: 't-1',
      fieldErrors: {email: ['is required']},
      hint: 'Check the id.',
      docs: 'norbix users get --help',
    })
    expect(text).toBe(
      [
        'Error: User not found',
        '  code: USER_NOT_FOUND',
        '  status: 404',
        '  url: http://x/u/1',
        '  traceId: t-1',
        '  email: is required',
        'Hint: Check the id.',
        'Docs: norbix users get --help',
      ].join('\n'),
    )
    expect(text).not.toMatch(/\u001B\[/)
  })
})
