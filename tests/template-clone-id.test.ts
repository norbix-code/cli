import {afterEach, describe, expect, it} from 'vitest'

import {cli, makeHome, parseSingleJson, startFakeGateway, type FakeGateway} from './_cli.js'

/**
 * Template clone answers with the new copy's id (gateway 2026-10-23,
 * @norbix.ai/ts 4.37.0: `IdResponse`, was `EmptyResponse`). `email|sms|push
 * clone <id>` prints that id, and `--json` prints the answer `{"id": "…"}`.
 *
 * The built CLI runs as a child process against a fake gateway on a local
 * port — nothing else is contacted.
 */

const ID = '66b2f0a1'
const COPY = '77c3a1b2'

let gateway: FakeGateway | undefined

afterEach(async () => {
  await gateway?.close()
  gateway = undefined
})

describe.each(['email', 'sms', 'push'])('%s clone returns the new copy id', (channel) => {
  const path = `/v3/notifications/${channel}/templates/${ID}/clone`

  it('prints the id of the copy', async () => {
    gateway = await startFakeGateway({[path]: {id: COPY}})
    const r = await cli(makeHome(gateway.port), [channel, 'clone', ID, '--profile', 'x'])

    expect(r.code).toBe(0)
    expect(r.stdout.trim()).toBe(`Template ${ID} cloned as ${COPY}.`)
    expect(gateway.hits.map((h) => `${h.method} ${h.url}`)).toEqual([`POST ${path}`])
  })

  it('--json prints the answer with the id', async () => {
    gateway = await startFakeGateway({[path]: {id: COPY}})
    const r = await cli(makeHome(gateway.port), [channel, 'clone', ID, '--profile', 'x', '--json'])

    expect(r.code).toBe(0)
    expect(parseSingleJson(r.stdout)).toEqual({id: COPY})
  })
})
