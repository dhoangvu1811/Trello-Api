import { StatusCodes } from 'http-status-codes'
import ms from 'ms'
import { userService } from '~/services/userService'
import ApiError from '~/utils/ApiError'
import { env } from '~/config/environment'

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/'
}

const setAuthCookies = (res, result) => {
  res.cookie('accessToken', result.accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: ms(env.ACCESS_TOKEN_LIFE)
  })
  res.cookie('refreshToken', result.refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: Math.max(0, result.sessionExpiresAt - Date.now())
  })
}

const createNew = async (req, res, next) => {
  try {
    const createUser = await userService.createNew(req.body)

    res.status(StatusCodes.CREATED).json(createUser)
  } catch (error) {
    next(error)
  }
}

const verifyAccount = async (req, res, next) => {
  try {
    const result = await userService.verifyAccount(req.body)

    res.status(StatusCodes.OK).json(result)
  } catch (error) {
    next(error)
  }
}

const login = async (req, res, next) => {
  try {
    const result = await userService.login(req.body)

    setAuthCookies(res, result)

    res.status(StatusCodes.OK).json({
      user: result.user,
      accessTokenExpiresAt: result.accessTokenExpiresAt,
      sessionExpiresAt: result.sessionExpiresAt
    })
  } catch (error) {
    next(error)
  }
}

const logout = async (req, res, next) => {
  try {
    const clientRefreshToken = req.cookies?.refreshToken
    res.clearCookie('accessToken', COOKIE_OPTIONS)
    res.clearCookie('refreshToken', COOKIE_OPTIONS)
    const sessionId = await userService.logout(clientRefreshToken)
    if (sessionId) {
      req.app.get('io').in(`session:${sessionId}`).disconnectSockets(true)
    }
    res.status(StatusCodes.OK).json({ loggedOut: true })
  } catch (error) {
    next(error)
  }
}

const refreshToken = async (req, res, next) => {
  try {
    const result = await userService.refreshToken(req.cookies?.refreshToken)
    setAuthCookies(res, result)

    res.status(StatusCodes.OK).json({
      accessTokenExpiresAt: result.accessTokenExpiresAt,
      sessionExpiresAt: result.sessionExpiresAt
    })
  } catch (error) {
    next(new ApiError(StatusCodes.UNAUTHORIZED, 'Please Sign In!'))
  }
}

const update = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id
    const userAvatarFile = req.file
    const updateUser = await userService.update(
      userId,
      req.body,
      userAvatarFile
    )
    if (req.body.current_password && req.body.new_password) {
      req.app
        .get('io')
        .in(`user:${userId}`)
        .disconnectSockets(true)
    }

    res.status(StatusCodes.OK).json(updateUser)
  } catch (error) {
    next(error)
  }
}

const getSession = async (req, res, next) => {
  try {
    const session = userService.getSession(
      req.authenticatedUser,
      req.authSession,
      req.jwtDecoded
    )
    res.status(StatusCodes.OK).json(session)
  } catch (error) {
    next(error)
  }
}

const forgotPassword = async (req, res, next) => {
  try {
    await userService.forgotPassword(req.body.email)
    res.status(StatusCodes.OK).json({
      message: 'If that account exists, a password reset email has been sent.'
    })
  } catch (error) {
    next(error)
  }
}

const resetPassword = async (req, res, next) => {
  try {
    const userId = await userService.resetPassword(
      req.body.token,
      req.body.password
    )
    req.app.get('io').in(`user:${userId}`).disconnectSockets(true)
    res.status(StatusCodes.OK).json({ passwordReset: true })
  } catch (error) {
    next(error)
  }
}

export const userController = {
  createNew,
  verifyAccount,
  login,
  logout,
  refreshToken,
  getSession,
  update,
  forgotPassword,
  resetPassword
}
