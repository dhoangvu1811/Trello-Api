import { env } from '~/config/environment'

export const AUTH_COOKIE_NAMES = Object.freeze({
  access: 'trelloAccessToken',
  refresh: 'trelloRefreshToken'
})

export const createAuthCookieOptions = (buildMode = env.BUILD_MODE) => ({
  httpOnly: true,
  secure: !['dev', 'test'].includes(buildMode),
  // Production serves the web app and API from different sites, so browsers
  // require SameSite=None before credentialed API requests may include cookies.
  sameSite: buildMode === 'production' ? 'none' : 'lax',
  path: '/'
})

export const AUTH_COOKIE_OPTIONS = createAuthCookieOptions()
