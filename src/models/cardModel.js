import Joi from 'joi'
import { ObjectId } from 'mongodb'
import { GET_DB } from '~/config/mongodb'
import { CARD_MEMBER_ACTIONS } from '~/utils/constants'
import {
  EMAIL_RULE,
  EMAIL_RULE_MESSAGE,
  OBJECT_ID_RULE,
  OBJECT_ID_RULE_MESSAGE
} from '~/utils/validators'

// Define Collection (name & schema)
const CARD_COLLECTION_NAME = 'cards'
const CARD_COLLECTION_SCHEMA = Joi.object({
  boardId: Joi.string()
    .required()
    .pattern(OBJECT_ID_RULE)
    .message(OBJECT_ID_RULE_MESSAGE),
  columnId: Joi.string()
    .required()
    .pattern(OBJECT_ID_RULE)
    .message(OBJECT_ID_RULE_MESSAGE),

  title: Joi.string().required().min(3).max(50).trim().strict(),
  description: Joi.string().optional(),
  cover: Joi.string().default(null),
  memberIds: Joi.array()
    .items(Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE))
    .default([]),
  comments: Joi.array()
    .items({
      userId: Joi.string()
        .pattern(OBJECT_ID_RULE)
        .message(OBJECT_ID_RULE_MESSAGE),
      userEmail: Joi.string().pattern(EMAIL_RULE).message(EMAIL_RULE_MESSAGE),
      userAvatar: Joi.string(),
      userDisplayName: Joi.string(),
      content: Joi.string(),
      // Dùng hàm $push để thêm comment nên không set default là Date.now
      commentedAt: Joi.date().timestamp()
    })
    .default([]),

  createdAt: Joi.date().timestamp('javascript').default(Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
})
// Chỉ định ra các trường không cho phép cập nhật trong hàm update
const INVALID_UPDATE_FIELDS = ['_id', 'createdAt', 'boardId']

const validateBeforeCreate = async (data) => {
  return await CARD_COLLECTION_SCHEMA.validateAsync(data, {
    abortEarly: false
  })
}

const createNew = async (data) => {
  try {
    const validDate = await validateBeforeCreate(data)
    const newCardToAdd = {
      ...validDate,
      boardId: new ObjectId(validDate.boardId),
      columnId: new ObjectId(validDate.columnId)
    }

    const createdCard = await GET_DB()
      .collection(CARD_COLLECTION_NAME)
      .insertOne(newCardToAdd)

    return createdCard
  } catch (error) {
    throw new Error(error)
  }
}

const findOneById = async (cardId) => {
  try {
    const result = await GET_DB()
      .collection(CARD_COLLECTION_NAME)
      .findOne({
        _id: new ObjectId(cardId)
      })

    return result
  } catch (error) {
    throw new Error(error)
  }
}

const update = async (cardId, updateData) => {
  try {
    // Lọc những trường không cho phép cập nhật
    Object.keys(updateData).forEach((fieldName) => {
      if (INVALID_UPDATE_FIELDS.includes(fieldName)) {
        delete updateData[fieldName]
      }
    })
    //Đối với dữ liệu liên quan đến objectId, biến đổi ở đây
    if (updateData.columnId) {
      updateData.columnId = new ObjectId(updateData.columnId)
    }

    const result = await GET_DB()
      .collection(CARD_COLLECTION_NAME)
      .findOneAndUpdate(
        { _id: new ObjectId(cardId) },
        { $set: updateData },
        { returnDocument: 'after' } // Trả về kết quả mới sau khi cập nhật
      )

    return result
  } catch (error) {
    throw new Error(error)
  }
}

const deleteManyByColumnId = async (columnId) => {
  try {
    const result = await GET_DB()
      .collection(CARD_COLLECTION_NAME)
      .deleteMany({
        columnId: new ObjectId(columnId)
      })

    return result
  } catch (error) {
    throw new Error(error)
  }
}

const unShiftNewComment = async (cardId, commentData) => {
  try {
    const result = await GET_DB()
      .collection(CARD_COLLECTION_NAME)
      .findOneAndUpdate(
        { _id: new ObjectId(cardId) },
        { $push: { comments: { $each: [commentData], $position: 0 } } },
        {
          returnDocument: 'after'
        }
      )

    return result
  } catch (error) {
    throw new Error(error)
  }
}

const updateMembers = async (cardId, incommingMemberInfo) => {
  try {
    let updateCondition = {}
    if (incommingMemberInfo.action === CARD_MEMBER_ACTIONS.ADD) {
      updateCondition = {
        $push: { memberIds: new ObjectId(incommingMemberInfo.userId) }
      }
    }
    if (incommingMemberInfo.action === CARD_MEMBER_ACTIONS.REMOVE) {
      updateCondition = {
        $pull: { memberIds: new ObjectId(incommingMemberInfo.userId) }
      }
    }

    const result = await GET_DB()
      .collection(CARD_COLLECTION_NAME)
      .findOneAndUpdate({ _id: new ObjectId(cardId) }, updateCondition, {
        returnDocument: 'after'
      })

    return result
  } catch (error) {
    throw new Error(error)
  }
}

export const cardModel = {
  CARD_COLLECTION_NAME,
  CARD_COLLECTION_SCHEMA,
  createNew,
  findOneById,
  update,
  deleteManyByColumnId,
  unShiftNewComment,
  updateMembers
}
