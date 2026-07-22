import { env } from '~/config/environment'

export const AUTH_COOKIE_NAMES = Object.freeze({
  access: 'trelloAccessToken',
  refresh: 'trelloRefreshToken'
})

export const createAuthCookieOptions = (buildMode = env.BUILD_MODE) => ({
  httpOnly: true,
  secure: !['dev', 'test'].includes(buildMode),
  sameSite: 'lax',
  path: '/'
})

export const AUTH_COOKIE_OPTIONS = createAuthCookieOptions()
