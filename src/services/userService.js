/* eslint-disable no-useless-catch */
import { userModel } from '~/models/userModel'
import ApiError from '~/utils/ApiError'
import { StatusCodes } from 'http-status-codes'
import bcryptjs from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { pickUser } from '~/utils/formatters'

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
      username: nameFromEmail,
      displayname: nameFromEmail,
      verifyToken: uuidv4()
    }
    //Gọi tới model để xử lý lưu bản ghi trong DB
    const createdUser = await userModel.createNew(newUser)
    const getNewUser = await userModel.findOneById(createdUser.insertedId)

    //Gửi email cho người dùng xác thực tài khoản

    return pickUser(getNewUser)
  } catch (error) {
    throw error
  }
}

export const userService = {
  createNew
}
