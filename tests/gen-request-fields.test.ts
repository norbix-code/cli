import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {dirname, join} from 'node:path'
import {describe, expect, it} from 'vitest'

// A plain .mjs build script (no type declarations); tests are not type-checked.
import {sdkMethods} from '../scripts/gen-request-fields.mjs'

/**
 * `npm run gen:fields` reads the SDK's dist/index.js as text. It once matched
 * only one doc-comment shape, so every method with an extra doc line was left
 * out of request-fields.json without a word (issue S187, @norbix.ai/ts 4.9.1).
 * These fixtures copy the shapes the SDK really uses.
 */

/** One SDK method the way esbuild writes it into dist/index.js. */
function method(name: string, doc: string[] | null, send = {target: 'hub', path: '/{version}/things', method: 'GET'}): string {
  const comment = doc === null ? '' : ['  /**', ...doc.map((l) => (l === '' ? '   *' : `   * ${l}`)), '   */', ''].join('\n')
  return `${comment}  ${name} = (request = {}, options = {}) => {
    return this.transport.send({
      target: "${send.target}",
      path: "${send.path}",
      method: "${send.method}",
      request,
      pathParams: [],
      scope: "project",
      ...options
    });
  };
`
}

function moduleClass(className: string, body: string): string {
  return `// src/hub/x.ts
var ${className} = class {
  constructor(transport) {
    this.transport = transport;
  }
  transport;
${body}};

`
}

function sdk(modules: string): string {
  return `${modules}var ApiNamespace = class {
  constructor(transport) {
  }
};
var HubNamespace = class {
  constructor(transport) {
    this.things = new ThingsModule(transport);
  }
};
`
}

describe('gen:fields reads SDK methods', () => {
  it('reads every doc-comment shape the SDK uses', () => {
    const source = sdk(
      moduleClass(
        'ThingsModule',
        [
          // plain shape
          method('plain', ['GET /{version}/things', 'Request DTO: GetThings']),
          // extra lines between the verb line and the DTO line (alias list)
          method('aliased', ['POST /{version}/things', 'Aliases:', '  - POST /{version}/things/{Environment}', 'Request DTO: CreateThing'], {
            target: 'hub',
            path: '/{version}/things',
            method: 'POST',
          }),
          // the "Anonymous" line that 4.9.1 added, over two lines
          method('anonymous', ['GET /{version}/account/verify', 'Anonymous — no token needed. The account id travels in the request', '(`accountId`, query string), not from the client.', 'Request DTO: VerifyAccount'], {
            target: 'hub',
            path: '/{version}/account/verify',
            method: 'GET',
          }),
          // blank ` *` lines around a description
          method('withBlankLines', ['DELETE /{version}/things/{id}', '', 'Deletes one thing.', '', 'Request DTO: DeleteThing'], {
            target: 'hub',
            path: '/{version}/things/{id}',
            method: 'DELETE',
          }),
          // a description before the verb line
          method('describedFirst', ['Lists the regions of the account.', 'GET /{version}/account/regions', 'Request DTO: GetAccountRegions'], {
            target: 'hub',
            path: '/{version}/account/regions',
            method: 'GET',
          }),
          // the DTO named at the end of a description line, no verb line at all
          method('dtoMidLine', ['Updates the regions a project spans. Request DTO: UpdateProjectRegions'], {
            target: 'hub',
            path: '/{version}/account/projects/{projectId}/settings/regions',
            method: 'PATCH',
          }),
        ].join(''),
      ),
    )

    const {methods, problems} = sdkMethods(source)

    expect(problems).toEqual([])
    expect(methods).toEqual({
      api: {},
      hub: {
        things: {
          plain: {http: 'GET', path: '/{version}/things', dto: 'GetThings', target: 'hub'},
          aliased: {http: 'POST', path: '/{version}/things', dto: 'CreateThing', target: 'hub'},
          anonymous: {http: 'GET', path: '/{version}/account/verify', dto: 'VerifyAccount', target: 'hub'},
          withBlankLines: {http: 'DELETE', path: '/{version}/things/{id}', dto: 'DeleteThing', target: 'hub'},
          describedFirst: {http: 'GET', path: '/{version}/account/regions', dto: 'GetAccountRegions', target: 'hub'},
          dtoMidLine: {http: 'PATCH', path: '/{version}/account/projects/{projectId}/settings/regions', dto: 'UpdateProjectRegions', target: 'hub'},
        },
      },
    })
  })

  it('lists every method it cannot read instead of dropping it', () => {
    const source = sdk(
      moduleClass(
        'ThingsModule',
        [
          method('ok', ['GET /{version}/things', 'Request DTO: GetThings']),
          // no request DTO line
          method('noDto', ['GET /{version}/things', 'Anonymous — no token needed.']),
          // no doc comment at all
          method('noDoc', null),
          // two DTO lines: which one is it?
          method('twoDtos', ['GET /{version}/things', 'Request DTO: A', 'Request DTO: B']),
          // the doc and the real call disagree
          method('wrongDoc', ['POST /{version}/other', 'Request DTO: GetThings']),
          // sends to the wrong service for its namespace
          method('wrongTarget', ['GET /things', 'Request DTO: GetThings'], {target: 'api', path: '/things', method: 'GET'}),
          // a send call in a method of another shape
          `  async custom(body) {
    return this.transport.send({
      target: "hub",
      path: "/x",
      method: "POST",
      request: body
    });
  }
`,
        ].join(''),
      ),
    ).replace('this.things = new ThingsModule(transport);', 'this.things = new ThingsModule(transport);\n    this.gone = new GoneModule(transport);')

    const {methods, problems} = sdkMethods(source)

    expect(problems).toEqual([
      'hub.things.noDto: no "Request DTO:" line in the doc comment',
      'hub.things.noDoc: no doc comment, so no "Request DTO:" line',
      'hub.things.twoDtos: 2 "Request DTO:" lines in the doc comment',
      'hub.things.wrongDoc: doc says "POST /{version}/other" but the send call is "GET /{version}/things"',
      'hub.things: 1 send call(s) outside a method of the shape `name = (request = {}, options = {}) => {`',
      'hub.things.wrongTarget: sends to "api", not "hub"',
      'hub.gone: class GoneModule not found in dist/index.js',
    ])
    expect(Object.keys(methods.hub.things)).toEqual(['ok', 'wrongTarget'])
  })

  it('reads every method of the installed @norbix.ai/ts with no problem', () => {
    const require = createRequire(import.meta.url)
    const sdkDir = dirname(dirname(require.resolve('@norbix.ai/ts')))
    const indexJs = readFileSync(join(sdkDir, 'dist/index.js'), 'utf8')

    const {methods, problems} = sdkMethods(indexJs)

    // No problem also means: every send call in every module class was read.
    expect(problems).toEqual([])
    // The methods with extra doc lines that the old one-shape match lost.
    expect(Object.keys(methods.hub.account)).toEqual(
      expect.arrayContaining(['getAccountRegions', 'createTeamMemberFromInvitation', 'createAccount', 'verifyAccount']),
    )
    expect(methods.hub.regions.list).toEqual({http: 'GET', path: '/{version}/account/regions', dto: 'GetAccountRegions', target: 'hub'})
  })
})
