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
    //Query user trong DB
    const existUser = await userModel.findOneByEmail(reqBody.email)
    console.log('🚀 ~ login ~ existUser:', existUser)
    console.log(
      '🚀 ~ login ~ bcryptjs.compareSync(reqBody.password, existUser.password:',
      bcryptjs.compareSync(reqBody.password, existUser.password)
    )

    // Các bước kiểm tra cần thiết
    if (!existUser)
      throw new ApiError(StatusCodes.NOT_FOUND, 'Account not found!')
    if (!existUser.isActive)
      throw new ApiError(
        StatusCodes.NOT_ACCEPTABLE,
        'Your account is not active!'
      )

    if (!bcryptjs.compareSync(reqBody.password, existUser.password)) {
      throw new ApiError(
        StatusCodes.NOT_ACCEPTABLE,
        'Your Email or Password is incorrect!'
      )
    }

    //Nếu mọi thứ ok thì bắt đầu tạo token trả về phía FE
    //Tạo thông tin đính kèm trong JWT token là _id và email của User
    const userInfo = {
      _id: existUser._id,
      email: existUser.email
    }

    //Tạo ra hai loại token, accessToken và refreshToken để tra về phía FE
    const accessToken = await JwtProvider.generateToken(
      userInfo,
      env.ACCESS_TOKEN_SECRET_SIGNATURE,
      env.ACCESS_TOKEN_LIFE
    )
    const refreshToken = await JwtProvider.generateToken(
      userInfo,
      env.REFRESH_TOKEN_SECRET_SIGNATURE,
      env.REFRESH_TOKEN_LIFE
    )

    //Trả thông tin user kèm với hai token vừa tạo ra
    return { accessToken, refreshToken, ...pickUser(existUser) }
  } catch (error) {
    throw error
  }
}

const refreshToken = async (clientRefreshToken) => {
  try {
    // Verify giải mã cái refreshToken xem có hợp lệ không
    const refreshTokenDecoded = await JwtProvider.verifyToken(
      clientRefreshToken,
      env.REFRESH_TOKEN_SECRET_SIGNATURE
    )

    //Đoạn này vì chúng ta đã lưu những thông tin unique của user trong token, vì vậy có thể lấy luôn từ decoded ra tiết kiệm thời gian query vào DB
    const userInfo = {
      _id: refreshTokenDecoded._id,
      email: refreshTokenDecoded.email
    }

    // Tạo accessToken mới
    const accessToken = await JwtProvider.generateToken(
      userInfo,
      env.ACCESS_TOKEN_SECRET_SIGNATURE,
      env.ACCESS_TOKEN_LIFE
    )

    return { accessToken }
  } catch (error) {
    throw error
  }
}

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

export const userService = {
  createNew,
  verifyAccount,
  login,
  refreshToken,
  update
}
