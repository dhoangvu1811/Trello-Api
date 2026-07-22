/* eslint-disable no-useless-catch */
import { userModel } from '~/models/userModel'
import ApiError from '~/utils/ApiError'
import { StatusCodes } from 'http-status-codes'
import bcryptjs from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { pickUser } from '~/utils/formatters'
import { WEBSITE_DOMAIN } from '~/utils/constants'
import { BrevoProvider } from '~/providers/BrevoProvider'
import { env } from '~/config/environment'
import { JwtProvider } from '~/providers/JwtProvider'
import { CloudinaryProvider } from '~/providers/CloudinaryProvider'
import crypto from 'crypto'
import ms from 'ms'
import { authSessionModel } from '~/models/authSessionModel'

const PASSWORD_RESET_LIFE_MS = 30 * 60 * 1000
const hashResetToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex')
const hashRefreshToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex')
const createTokenMetadata = (now = Date.now()) => ({
  accessTokenExpiresAt: now + ms(env.ACCESS_TOKEN_LIFE),
  sessionExpiresAt: now + ms(env.REFRESH_TOKEN_LIFE)
})

const createNew = async (reqBody) => {
  try {
    //Check email đã tồn tại hay chưa
    const existUser = await userModel.findOneByEmail(reqBody.email)
    if (existUser) {
      throw new ApiError(StatusCodes.CONFLICT, 'Email already exists!')
    }
    // Tạo data để lưu vào DB
    const nameFromEmail = reqBody.email.split('@')[0] // DHVuxDev@gmail.com => DHVuxDev
    const newUser = {
      email: reqBody.email,
      password: bcryptjs.hashSync(reqBody.password, 8), // Tham số thứ hai là độ phức tạp giá trị càng cao băm càng lâu
      userName: nameFromEmail,
      displayName: nameFromEmail,
      verifyToken: uuidv4()
    }
    //Gọi tới model để xử lý lưu bản ghi trong DB
    const createdUser = await userModel.createNew(newUser)
    const getNewUser = await userModel.findOneById(createdUser.insertedId)

    //Gửi email cho người dùng xác thực tài khoản
    const verificationLink = `${WEBSITE_DOMAIN}/account/verification?email=${getNewUser.email}&token=${getNewUser.verifyToken}`
    const customSubject =
      'Trello Web MERN: Please verify your email before using our services!'
    const htmlContent = `
      <h3>Here is your verification link: </h3>
      <h3>${verificationLink}</h3>
      <h3>Sincerely,<br/> - DHVuxDev - </h3>
    `
    //Gọi tới Provider để gửi mail
    await BrevoProvider.sendEmail(getNewUser.email, customSubject, htmlContent)

    return pickUser(getNewUser)
  } catch (error) {
    throw error
  }
}

const verifyAccount = async (reqBody) => {
  try {
    //Query user trong DB
    const existUser = await userModel.findOneByEmail(reqBody.email)

    // Các bước kiểm tra cần thiết
    if (!existUser)
      throw new ApiError(StatusCodes.NOT_FOUND, 'Account not found!')
    if (existUser.isActive)
      throw new ApiError(
        StatusCodes.NOT_ACCEPTABLE,
        'Your account is already active!'
      )
    if (reqBody.token !== existUser.verifyToken)
      throw new ApiError(StatusCodes.NOT_ACCEPTABLE, 'Token is in valid!')

    // Nếu mọi thứ ok thì update lại thông tin user
    const updateData = { isActive: true, verifyToken: null }
    const updatedUser = await userModel.update(existUser._id, updateData)

    return pickUser(updatedUser)
  } catch (error) {
    throw error
  }
}
const login = async (reqBody) => {
  try {
    const existUser = await userModel.findOneByEmail(reqBody.email)

    // Các bước kiểm tra cần thiết
    if (
      !existUser ||
      !bcryptjs.compareSync(reqBody.password, existUser.password)
    ) {
      throw new ApiError(
        StatusCodes.NOT_ACCEPTABLE,
        'Your Email or Password is incorrect!'
      )
    }
    if (!existUser.isActive || existUser._destroy)
      throw new ApiError(
        StatusCodes.NOT_ACCEPTABLE,
        'Your account is not active!'
      )

    //Nếu mọi thứ ok thì bắt đầu tạo token trả về phía FE
    //Tạo thông tin đính kèm trong JWT token là _id và email của User
    const sessionId = uuidv4()
    const userInfo = {
      _id: existUser._id.toString(),
      email: existUser.email,
      sessionId
    }

    // The controller keeps both tokens in httpOnly cookies and never exposes them in JSON.
    const accessToken = await JwtProvider.generateToken(
      userInfo,
      env.ACCESS_TOKEN_SECRET_SIGNATURE,
      env.ACCESS_TOKEN_LIFE
    )
    const refreshToken = await JwtProvider.generateToken(
      { ...userInfo, tokenId: uuidv4() },
      env.REFRESH_TOKEN_SECRET_SIGNATURE,
      env.REFRESH_TOKEN_LIFE
    )

    const tokenMetadata = createTokenMetadata()
    await authSessionModel.createNew({
      _id: sessionId,
      userId: existUser._id,
      refreshTokenHash: hashRefreshToken(refreshToken),
      expiresAt: tokenMetadata.sessionExpiresAt
    })

    return {
      accessToken,
      refreshToken,
      user: pickUser(existUser),
      ...tokenMetadata
    }
  } catch (error) {
    throw error
  }
}

const refreshToken = async (clientRefreshToken) => {
  try {
    const refreshTokenDecoded = await JwtProvider.verifyToken(
      clientRefreshToken,
      env.REFRESH_TOKEN_SECRET_SIGNATURE
    )
    const session = await authSessionModel.findActiveById(
      refreshTokenDecoded.sessionId
    )
    const user = await userModel.findOneById(refreshTokenDecoded._id)
    if (
      !session ||
      !user ||
      !user.isActive ||
      user._destroy ||
      session.userId.toString() !== refreshTokenDecoded._id
    ) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Session is no longer valid.')
    }

    const userInfo = {
      _id: refreshTokenDecoded._id,
      email: user.email,
      sessionId: refreshTokenDecoded.sessionId
    }
    const accessToken = await JwtProvider.generateToken(
      userInfo,
      env.ACCESS_TOKEN_SECRET_SIGNATURE,
      env.ACCESS_TOKEN_LIFE
    )
    const remainingSessionMs = session.expiresAt.getTime() - Date.now()
    const nextRefreshToken = await JwtProvider.generateToken(
      { ...userInfo, tokenId: uuidv4() },
      env.REFRESH_TOKEN_SECRET_SIGNATURE,
      Math.max(1, Math.ceil(remainingSessionMs / 1000))
    )
    const rotatedSession = await authSessionModel.rotateRefreshToken(
      session._id,
      hashRefreshToken(clientRefreshToken),
      hashRefreshToken(nextRefreshToken)
    )
    if (!rotatedSession) {
      await authSessionModel.revoke(session._id)
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Session is no longer valid.')
    }

    return {
      accessToken,
      refreshToken: nextRefreshToken,
      accessTokenExpiresAt: Date.now() + ms(env.ACCESS_TOKEN_LIFE),
      sessionExpiresAt: rotatedSession.expiresAt.getTime()
    }
  } catch (error) {
    throw error
  }
}

const logout = async (clientRefreshToken) => {
  if (!clientRefreshToken) return
  let decoded
  try {
    decoded = await JwtProvider.verifyToken(
      clientRefreshToken,
      env.REFRESH_TOKEN_SECRET_SIGNATURE
    )
  } catch (_error) {
    return
  }
  if (decoded.sessionId) {
    await authSessionModel.revoke(decoded.sessionId)
    return decoded.sessionId
  }
}

const validateAccessSession = async (accessTokenDecoded) => {
  if (!accessTokenDecoded.sessionId) return null
  const [session, user] = await Promise.all([
    authSessionModel.findActiveById(accessTokenDecoded.sessionId),
    userModel.findOneById(accessTokenDecoded._id)
  ])
  if (
    !session ||
    !user ||
    !user.isActive ||
    user._destroy ||
    session.userId.toString() !== accessTokenDecoded._id
  ) {
    return null
  }
  return { user, session }
}

const getSession = (user, session, accessTokenDecoded) => ({
  user: pickUser(user),
  accessTokenExpiresAt: accessTokenDecoded.exp * 1000,
  sessionExpiresAt: session.expiresAt.getTime()
})

const update = async (userId, reqBody, userAvatarFile) => {
  try {
    const existUser = await userModel.findOneById(userId)
    if (!existUser)
      throw new ApiError(StatusCodes.NOT_FOUND, 'Account not found!')
    if (!existUser.isActive)
      throw new ApiError(
        StatusCodes.NOT_ACCEPTABLE,
        'Your account is not active!'
      )

    // khởi tạo kết quả updated User ban đầu là empty
    let updatedUser = {}

    //TH1: change password
    if (reqBody.current_password && reqBody.new_password) {
      //Check current_password có đúng hay không
      if (!bcryptjs.compareSync(reqBody.current_password, existUser.password)) {
        throw new ApiError(
          StatusCodes.NOT_ACCEPTABLE,
          'Your Current Password is incorrect!'
        )
      }
      // Hash new password và update
      updatedUser = await userModel.update(existUser._id, {
        password: bcryptjs.hashSync(reqBody.new_password, 8)
      })
      await authSessionModel.revokeAllForUser(existUser._id)
    } else if (userAvatarFile) {
      // TH upload file lên cloudinary
      const uploadResult = await CloudinaryProvider.streamUpload(
        userAvatarFile.buffer,
        'users'
      )

      // Lưu lại URL (secure_url) của file ảnh vào DB
      updatedUser = await userModel.update(existUser._id, {
        avatar: uploadResult.secure_url
      })
    } else {
      //TH2: change các thông tin chung như displayName
      updatedUser = await userModel.update(existUser._id, reqBody)
    }

    return pickUser(updatedUser)
  } catch (error) {
    throw error
  }
}

const forgotPassword = async (email) => {
  const user = await userModel.findOneByEmail(email)
  if (!user || !user.isActive || user._destroy) return

  const resetToken = crypto.randomBytes(32).toString('hex')
  await userModel.update(user._id, {
    passwordResetTokenHash: hashResetToken(resetToken),
    passwordResetExpiresAt: Date.now() + PASSWORD_RESET_LIFE_MS,
    updatedAt: Date.now()
  })

  const resetLink = `${WEBSITE_DOMAIN}/account/reset-password?token=${resetToken}`
  await BrevoProvider.sendEmail(
    user.email,
    'Trello Web MERN: Reset your password',
    `<h3>Password reset</h3><p>This link expires in 30 minutes:</p><p>${resetLink}</p>`
  )
}

const resetPassword = async (token, password) => {
  const user = await userModel.resetPassword(
    hashResetToken(token),
    bcryptjs.hashSync(password, 8)
  )
  if (!user) {
    throw new ApiError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      'Password reset token is invalid or expired.'
    )
  }
  await authSessionModel.revokeAllForUser(user._id)
  return user._id.toString()
}

export const userService = {
  createNew,
  verifyAccount,
  login,
  refreshToken,
  logout,
  validateAccessSession,
  getSession,
  update,
  forgotPassword,
  resetPassword
}
