import {describe, expect, it} from 'vitest'

import {evidenceFrom} from '../src/commands/support/report.js'

describe('norbix support report', () => {
  it('reads --evidence key=value pairs, keeps "=" inside a value and skips a pair with no key', () => {
    expect(
      evidenceFrom([
        'errorCode=CM-ERRORS-GENERIC-500',
        ' httpStatus = 500 ',
        'endpoint=/v3/db/collections/orders/records?filter=a=b',
        '=no-key',
        'no-equals-sign',
      ]),
    ).toEqual({
      errorCode: 'CM-ERRORS-GENERIC-500',
      httpStatus: '500',
      endpoint: '/v3/db/collections/orders/records?filter=a=b',
    })
    expect(evidenceFrom(undefined)).toEqual({})
  })
})
