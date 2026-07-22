const test = require('node:test')
const assert = require('node:assert/strict')
const {
  AUTH_COOKIE_NAMES,
  createAuthCookieOptions
} = require('../build/src/config/authCookie')

test('uses namespaced authentication cookie names', () => {
  assert.deepEqual(AUTH_COOKIE_NAMES, {
    access: 'trelloAccessToken',
    refresh: 'trelloRefreshToken'
  })
})

test('uses HTTP-compatible auth cookies during local development', () => {
  assert.deepEqual(createAuthCookieOptions('dev'), {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/'
  })
})

test('uses secure cross-site auth cookies in production', () => {
  assert.deepEqual(createAuthCookieOptions('production'), {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/'
  })
})

test('defaults unknown deployment modes to secure cookies', () => {
  assert.equal(createAuthCookieOptions(undefined).secure, true)
})
