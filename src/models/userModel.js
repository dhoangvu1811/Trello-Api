import Joi from 'joi'
import { ObjectId, ReturnDocument } from 'mongodb'
import { GET_DB } from '~/config/mongodb'
import { EMAIL_RULE, EMAIL_RULE_MESSAGE } from '~/utils/validators'
import { USER_ROLES } from '~/utils/constants'
import { columnModel } from '~/models/columnModel'
import { cardModel } from '~/models/cardModel'

//Define Collection (Name & Schema)
const USER_COLLECTION_NAME = 'users'
const USER_COLLECTION_SCHEMA = Joi.object({
  email: Joi.string()
    .required()
    .pattern(EMAIL_RULE)
    .message(EMAIL_RULE_MESSAGE),
  password: Joi.string().required(),
  username: Joi.string().required().trim().strict(),
  displayname: Joi.string().required().trim().strict(),
  avatar: Joi.string().default(null),
  role: Joi.string()
    .valid(USER_ROLES.ADMIN, USER_ROLES.CLIENT)
    .default(USER_ROLES.CLIENT),
  isActive: Joi.boolean().default(false),
  verifyToken: Joi.string(),
  createdAt: Joi.date().timestamp('javascript').default(Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
})

// Chỉ định ra các trường không cho phép cập nhật trong hàm update
const INVALID_UPDATE_FIELDS = ['_id', 'createdAt', 'email', 'createdAt']

const validateBeforeCreate = async (data) => {
  return await USER_COLLECTION_SCHEMA.validateAsync(data, {
    abortEarly: false
  })
}

const createNew = async (data) => {
  try {
    const validDate = await validateBeforeCreate(data)

    const createdUser = await GET_DB()
      .collection(USER_COLLECTION_NAME)
      .insertOne(validDate)

    return createdUser
  } catch (error) {
    throw new Error(error)
  }
}

const findOneById = async (userId) => {
  try {
    const result = await GET_DB()
      .collection(USER_COLLECTION_NAME)
      .findOne({
        _id: new ObjectId(userId)
      })

    return result
  } catch (error) {
    throw new Error(error)
  }
}
const findOneByEmail = async (emailValue) => {
  try {
    const result = await GET_DB().collection(USER_COLLECTION_NAME).findOne({
      email: emailValue
    })

    return result
  } catch (error) {
    throw new Error(error)
  }
}

const update = async (userId, updateData) => {
  try {
    // Lọc những trường không cho phép cập nhật
    Object.keys(updateData).forEach((fieldName) => {
      if (INVALID_UPDATE_FIELDS.includes(fieldName)) {
        delete updateData[fieldName]
      }
    })

    const result = await GET_DB()
      .collection(USER_COLLECTION_NAME)
      .findOneAndUpdate(
        {
          _id: new ObjectId(userId)
        },
        { $set: updateData },
        { returnDocument: 'after' }
      )
    return result
  } catch (error) {
    throw new Error(error)
  }
}

export const userModel = {
  USER_COLLECTION_NAME,
  USER_COLLECTION_SCHEMA,
  createNew,
  findOneById,
  findOneByEmail,
  update
}
