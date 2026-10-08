import {describe, expect, it} from 'vitest'

import {isDestructive, matchMethods, parseArgv, typeFields} from '../src/lib/dispatch.js'

describe('parseArgv', () => {
  it('splits words, the id and the fields', () => {
    const p = parseArgv(['database', 'aggregates', 'delete', 'maggr_123', '--schemaId', 'sch_456'])
    expect(p.words).toEqual(['database', 'aggregates', 'delete'])
    expect(p.positionals).toEqual(['maggr_123'])
    expect(p.rawFields).toEqual([{name: 'schemaId', value: 'sch_456', fromNextToken: true, explicit: undefined}])
  })

  it('reads an explicit type suffix', () => {
    const p = parseArgv(['--userId:str', '0042', '--count:num=7', '--archived:bool'])
    expect(p.rawFields).toEqual([
      {name: 'userId', value: '0042', fromNextToken: true, explicit: 'str'},
      {name: 'count', value: '7', fromNextToken: false, explicit: 'num'},
      {name: 'archived', fromNextToken: false, explicit: 'bool'},
    ])
  })
})

describe('typeFields', () => {
  it('keeps a string field as text even when it looks like a number', () => {
    const {fields} = typeFields(parseArgv(['--userId', '0042']).rawFields, {userId: 'string'})
    expect(fields).toEqual({userId: '0042'})
  })

  it('converts a number field and rejects text in it', () => {
    expect(typeFields(parseArgv(['--pageSize', '100']).rawFields, {pageSize: 'number'}).fields).toEqual({pageSize: 100})
    expect(typeFields(parseArgv(['--pageSize', 'many']).rawFields, {pageSize: 'number'}).errors).toEqual(['--pageSize expects a number, got "many"'])
  })

  it('does not let a boolean flag swallow the next word', () => {
    const {fields, returned} = typeFields(parseArgv(['--showArchived', 'tpl_1']).rawFields, {showArchived: 'boolean'})
    expect(fields).toEqual({showArchived: true})
    expect(returned).toEqual(['tpl_1'])
  })

  it('still takes true/false for a boolean flag', () => {
    expect(typeFields(parseArgv(['--showArchived', 'false']).rawFields, {showArchived: 'boolean'}).fields).toEqual({showArchived: false})
  })

  it('lets an explicit type win over the map and the heuristic', () => {
    const {fields} = typeFields(parseArgv(['--id:str', '0042', '--n:num', '7', '--ok:bool', 'false', '--doc:json', '{"a":1}']).rawFields, {id: 'number'})
    expect(fields).toEqual({id: '0042', n: 7, ok: false, doc: {a: 1}})
  })

  it('reports a bad explicit value', () => {
    expect(typeFields(parseArgv(['--n:num', 'x']).rawFields, {}).errors).toEqual(['--n:num expects a number, got "x"'])
    expect(typeFields(parseArgv(['--doc:json', '{bad']).rawFields, {}).errors[0]).toMatch(/not valid JSON/)
  })

  it('falls back to the old heuristic for unknown fields', () => {
    expect(typeFields(parseArgv(['--a', 'true', '--b', '42', '--c', 'x']).rawFields, {}).fields).toEqual({a: true, b: 42, c: 'x'})
  })

  it('parses JSON for object fields and splits string lists', () => {
    const {fields} = typeFields(parseArgv(['--paging', '{"pageSize":5}', '--tags', 'a,b']).rawFields, {paging: 'json', tags: 'string[]'})
    expect(fields).toEqual({paging: {pageSize: 5}, tags: ['a', 'b']})
  })
})

describe('method matching', () => {
  const methods = ['getSchedulerTask', 'getSchedulerTasks', 'deleteSchedulerTask', 'disableSchedulerTask', 'enableSchedulerTask']

  it('plural lists, singular gets one', () => {
    expect(matchMethods(methods, ['tasks', 'get'], 'scheduler').map((m) => m.method)).toEqual(['getSchedulerTasks'])
    expect(matchMethods(methods, ['task', 'get'], 'scheduler').map((m) => m.method)).toEqual(['getSchedulerTask'])
  })

  describe('words without a verb pick the read method', () => {
    const roles = ['createRole', 'deleteRole', 'getRole', 'getRoles', 'updateRolePolicies']
    const pick = (words: string[], hasId?: boolean) =>
      matchMethods(roles, words, 'membership', hasId === undefined ? {} : {hasId}).map((m) => m.method)

    it('`role <id>` → getRole', () => {
      expect(pick(['role'], true)).toEqual(['getRole'])
    })

    it('`role` without an id → getRoles (the list)', () => {
      expect(pick(['role'], false)).toEqual(['getRoles'])
    })

    it('`roles` → getRoles', () => {
      expect(pick(['roles'], false)).toEqual(['getRoles'])
    })

    it('a typed verb still decides: `role create`, `role delete <id>`', () => {
      expect(pick(['role', 'create'], false)).toEqual(['createRole'])
      expect(pick(['role', 'delete'], true)).toEqual(['deleteRole'])
    })

    it('never a write verb implicitly: no read method fits → still ambiguous', () => {
      const writes = ['createTag', 'deleteTag', 'saveTag']
      expect(matchMethods(writes, ['tag'], 'notifications', {hasId: true}).map((m) => m.method)).toEqual(['createTag', 'deleteTag', 'saveTag'])
    })

    it('two read methods that fit equally → still ambiguous', () => {
      const two = ['createItem', 'deleteItem', 'getItemOwner', 'getItemName']
      expect(matchMethods(two, ['item'], 'x', {hasId: true}).map((m) => m.method)).toEqual(['createItem', 'deleteItem'])
    })

    it('without hasId (scope help) every tie is kept', () => {
      expect(pick(['role'])).toEqual(['createRole', 'deleteRole', 'getRole'])
    })
  })

  it('treats delete, disable and block as destructive', () => {
    expect(isDestructive('deleteSchedulerTask')).toBe(true)
    expect(isDestructive('disableSchedulerTask')).toBe(true)
    expect(isDestructive('blockUser')).toBe(true)
    expect(isDestructive('enableSchedulerTask')).toBe(false)
  })
})
