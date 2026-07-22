const test = require('node:test')
const assert = require('node:assert/strict')
const {
  createAuthCookieOptions
} = require('../build/src/config/authCookie')

test('uses HTTP-compatible auth cookies during local development', () => {
  assert.deepEqual(createAuthCookieOptions('dev'), {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/'
  })
})

test('requires HTTPS auth cookies in production', () => {
  assert.deepEqual(createAuthCookieOptions('production'), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/'
  })
})

test('defaults unknown deployment modes to secure cookies', () => {
  assert.equal(createAuthCookieOptions(undefined).secure, true)
})
