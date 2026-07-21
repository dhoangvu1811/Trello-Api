import Joi from 'joi'
import { ObjectId } from 'mongodb'
import { GET_DB, SESSION_OPTIONS } from '~/config/mongodb'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'

import {
  BOARD_INVITATION_STATUS,
  BOARD_ROLES,
  INVITATION_TYPES
} from '~/utils/constants'
import { userModel } from './userModel'
import { boardModel } from './boardModel'

//Define Collection (Name & Schema)
const INVITATION_COLLECTION_NAME = 'invitations'
const INVITATION_COLLECTION_SCHEMA = Joi.object({
  inviterId: Joi.string()
    .required()
    .pattern(OBJECT_ID_RULE)
    .message(OBJECT_ID_RULE_MESSAGE),
  inviteeId: Joi.string()
    .required()
    .pattern(OBJECT_ID_RULE)
    .message(OBJECT_ID_RULE_MESSAGE),
  type: Joi.string()
    .required()
    .valid(...Object.values(INVITATION_TYPES)),

  boardInvitation: Joi.object({
    boardId: Joi.string()
      .required()
      .pattern(OBJECT_ID_RULE)
      .message(OBJECT_ID_RULE_MESSAGE),
    status: Joi.string()
      .required()
      .valid(...Object.values(BOARD_INVITATION_STATUS)),
    role: Joi.string()
      .valid(BOARD_ROLES.MEMBER, BOARD_ROLES.VIEWER)
      .default(BOARD_ROLES.MEMBER)
  }).optional(),

  createdAt: Joi.date().timestamp('javascript').default(Date.now),
  updatedAt: Joi.date().timestamp('javascript').default(null),
  _destroy: Joi.boolean().default(false)
})

// Chỉ định ra các trường không cho phép cập nhật trong hàm update
const INVALID_UPDATE_FIELDS = [
  '_id',
  'createdAt',
  'inviterId',
  'inviteeId',
  'type'
]

const validateBeforeCreate = async (data) => {
  return await INVITATION_COLLECTION_SCHEMA.validateAsync(data, {
    abortEarly: false
  })
}

const createNewBoardInvitation = async (data, session) => {
  try {
    const validData = await validateBeforeCreate(data)
    // Biến đổi một dữ liệu liên quan đến ObjectId
    let newInvitationToAdd = {
      ...validData,
      inviteeId: new ObjectId(validData.inviteeId),
      inviterId: new ObjectId(validData.inviterId)
    }

    // Nếu tồn tại dữ liệu boardInvitation thì update cho cái boardId
    if (validData.boardInvitation) {
      newInvitationToAdd.boardInvitation = {
        ...validData.boardInvitation,
        boardId: new ObjectId(validData.boardInvitation.boardId)
      }
    }

    // Gọi insert vào DB
    const createInvitation = await GET_DB()
      .collection(INVITATION_COLLECTION_NAME)
      .insertOne(newInvitationToAdd, SESSION_OPTIONS(session))

    return createInvitation
  } catch (error) {
    throw new Error(error)
  }
}

const findOneById = async (invitationId, session) => {
  try {
    const result = await GET_DB()
      .collection(INVITATION_COLLECTION_NAME)
      .findOne(
        { _id: new ObjectId(invitationId) },
        SESSION_OPTIONS(session)
      )

    return result
  } catch (error) {
    throw new Error(error)
  }
}

const update = async (invitationId, updateData, session) => {
  try {
    // Lọc những field không cho cập nhật
    Object.keys(updateData).forEach((fieldName) => {
      if (INVALID_UPDATE_FIELDS.includes(fieldName)) {
        delete updateData[fieldName]
      }
    })

    // Đối với những dữ liệu liên quan đến ObjectId, biến đổi ở đây
    if (updateData.boardInvitation) {
      updateData.boardInvitation = {
        ...updateData.boardInvitation,
        boardId: new ObjectId(updateData.boardInvitation.boardId)
      }
    }

    const result = await GET_DB()
      .collection(INVITATION_COLLECTION_NAME)
      .findOneAndUpdate(
        { _id: new ObjectId(invitationId) },
        {
          $set: updateData
        },
        SESSION_OPTIONS(session, { returnDocument: 'after' })
      )

    return result
  } catch (error) {
    throw new Error(error)
  }
}

// Query tổng hợp (aggregate) để những bản ghi invitation thuộc về một user cụ thể
const findByUser = async (userId) => {
  try {
    const queryCondition = [
      { inviteeId: new ObjectId(userId) }, // Tìm theo người được mời chính là người đang thực hiện request này
      { _destroy: false }
    ]

    const results = await GET_DB()
      .collection(INVITATION_COLLECTION_NAME)
      .aggregate([
        {
          $match: { $and: queryCondition }
        },
        {
          $lookup: {
            from: userModel.USER_COLLECTION_NAME,
            localField: 'inviterId', // Người đi mời
            foreignField: '_id',
            as: 'inviter',
            pipeline: [{ $project: userModel.PUBLIC_USER_PROJECTION }]
          }
        },
        {
          $lookup: {
            from: userModel.USER_COLLECTION_NAME,
            localField: 'inviteeId', // Người được mời
            foreignField: '_id',
            as: 'invitee',
            pipeline: [{ $project: userModel.PUBLIC_USER_PROJECTION }]
          }
        },
        {
          $lookup: {
            from: boardModel.BOARD_COLLECTION_NAME,
            localField: 'boardInvitation.boardId', // Thông tin của board
            foreignField: '_id',
            as: 'board'
          }
        }
      ])
      .toArray()

    return results
  } catch (error) {
    throw new Error(error)
  }
}

export const invitationModel = {
  INVITATION_COLLECTION_NAME,
  INVITATION_COLLECTION_SCHEMA,
  createNewBoardInvitation,
  findOneById,
  update,
  findByUser
}
