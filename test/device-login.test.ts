import {describe, expect, it} from 'vitest'

import {browserCommand, toHttpUrl} from '../src/lib/device-login.js'

/**
 * Opening the login page. The URL comes from the hub's response, so it must
 * never reach a shell: only http(s) is opened, and Windows does not go
 * through `cmd /c start`.
 */
describe('openBrowser', () => {
  it('keeps http and https URLs', () => {
    expect(toHttpUrl('https://hub.norbix.ai/device?code=AB-CD')).toBe('https://hub.norbix.ai/device?code=AB-CD')
    expect(toHttpUrl('http://localhost:5000/device')).toBe('http://localhost:5000/device')
  })

  it('refuses other schemes and non-URLs', () => {
    expect(toHttpUrl('file:///etc/passwd')).toBeUndefined()
    expect(toHttpUrl('javascript:alert(1)')).toBeUndefined()
    expect(toHttpUrl('calc.exe')).toBeUndefined()
    expect(toHttpUrl('')).toBeUndefined()
  })

  it('does not use cmd on Windows, so & and | stay part of the URL', () => {
    const href = toHttpUrl('https://hub.norbix.ai/device?a=1&b=2|calc')!
    const [cmd, args] = browserCommand(href, 'win32')
    expect(cmd).toBe('rundll32')
    expect(args).toEqual(['url.dll,FileProtocolHandler', href])
  })

  it('uses open on macOS and xdg-open elsewhere', () => {
    expect(browserCommand('https://x.test/', 'darwin')).toEqual(['open', ['https://x.test/']])
    expect(browserCommand('https://x.test/', 'linux')).toEqual(['xdg-open', ['https://x.test/']])
  })
})
