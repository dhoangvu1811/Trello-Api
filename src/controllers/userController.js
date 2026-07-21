import { StatusCodes } from 'http-status-codes'
import ms from 'ms'
import { userService } from '~/services/userService'
import ApiError from '~/utils/ApiError'

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'none'
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

    /**
     * Xử lý trả về http cookie cho phía trình duyệt
     * đối với maxage - thời gian sống của cookie thì chúng ta để tối đa 14 ngày,tuỳ từng dự án
    */
    res.cookie('accessToken', result.accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: ms('14 days')
    })
    res.cookie('refreshToken', result.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: ms('14 days')
    })

    res.status(StatusCodes.OK).json(result)
  } catch (error) {
    next(error)
  }
}

const logout = async (req, res, next) => {
  try {
    //Xoá cookie (làm ngược lại so với việc gắn cookie trên hàm login)
    res.clearCookie('accessToken', COOKIE_OPTIONS)
    res.clearCookie('refreshToken', COOKIE_OPTIONS)

    res.status(StatusCodes.OK).json({ loggedOut: true })
  } catch (error) {
    next(error)
  }
}

const refreshToken = async (req, res, next) => {
  try {
    const result = await userService.refreshToken(req.cookies?.refreshToken)
    res.cookie('accessToken', result.accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: ms('14 days')
    })

    res.status(StatusCodes.OK).json(result)
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

    res.status(StatusCodes.OK).json(updateUser)
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
    await userService.resetPassword(req.body.token, req.body.password)
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
  update,
  forgotPassword,
  resetPassword
}
