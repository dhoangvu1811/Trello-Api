import Joi from 'joi'
import { ObjectId } from 'mongodb'
import { GET_DB, SESSION_OPTIONS } from '~/config/mongodb'
import { CARD_MEMBER_ACTIONS, CARD_PRIORITIES } from '~/utils/constants'
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
  priority: Joi.string()
    .valid(...Object.values(CARD_PRIORITIES))
    .default(CARD_PRIORITIES.MEDIUM),
  startDate: Joi.date().timestamp('javascript').allow(null).default(null),
  dueDate: Joi.date().timestamp('javascript').allow(null).default(null),
  completedAt: Joi.date().timestamp('javascript').allow(null).default(null),
  labels: Joi.array()
    .items(
      Joi.object({
        _id: Joi.string().required().pattern(OBJECT_ID_RULE),
        name: Joi.string().required().min(1).max(32).trim().strict(),
        color: Joi.string().required().pattern(/^#[0-9a-fA-F]{6}$/)
      })
    )
    .max(20)
    .default([]),
  checklist: Joi.array()
    .items(
      Joi.object({
        _id: Joi.string().required().pattern(OBJECT_ID_RULE),
        title: Joi.string().required().min(1).max(120).trim().strict(),
        isCompleted: Joi.boolean().default(false),
        completedAt: Joi.date().timestamp('javascript').allow(null).default(null),
        completedBy: Joi.string().pattern(OBJECT_ID_RULE).allow(null).default(null)
      })
    )
    .max(100)
    .default([]),
  attachments: Joi.array()
    .items(
      Joi.object({
        _id: Joi.string().required().pattern(OBJECT_ID_RULE),
        name: Joi.string().required().min(1).max(255),
        url: Joi.string().uri().required(),
        publicId: Joi.string().required(),
        resourceType: Joi.string().required(),
        mimeType: Joi.string().required(),
        size: Joi.number().integer().min(0).required(),
        uploadedBy: Joi.string().required().pattern(OBJECT_ID_RULE),
        createdAt: Joi.date().timestamp('javascript').required()
      })
    )
    .max(50)
    .default([]),
  memberIds: Joi.array()
    .items(Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE))
    .default([]),
  watcherIds: Joi.array()
    .items(Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE))
    .default([]),
  comments: Joi.array()
    .items({
      _id: Joi.string().pattern(OBJECT_ID_RULE),
      userId: Joi.string()
        .pattern(OBJECT_ID_RULE)
        .message(OBJECT_ID_RULE_MESSAGE),
      userEmail: Joi.string().pattern(EMAIL_RULE).message(EMAIL_RULE_MESSAGE),
      userAvatar: Joi.string(),
      userDisplayName: Joi.string(),
      content: Joi.string(),
      editedAt: Joi.date().timestamp().allow(null),
      reactions: Joi.array()
        .items({
          emoji: Joi.string().min(1).max(16),
          userIds: Joi.array().items(Joi.string().pattern(OBJECT_ID_RULE))
        })
        .default([]),
      // Dùng hàm $push để thêm comment nên không set default là Date.now
      commentedAt: Joi.date().timestamp()
    })
    .default([]),
  archivedAt: Joi.date().timestamp('javascript').allow(null).default(null),
  archivedBy: Joi.string().pattern(OBJECT_ID_RULE).allow(null).default(null),

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

const createNew = async (data, session) => {
  try {
    const validDate = await validateBeforeCreate(data)
    const newCardToAdd = {
      ...validDate,
      boardId: new ObjectId(validDate.boardId),
      columnId: new ObjectId(validDate.columnId)
    }

    const createdCard = await GET_DB()
      .collection(CARD_COLLECTION_NAME)
      .insertOne(newCardToAdd, SESSION_OPTIONS(session))

    return createdCard
  } catch (error) {
    throw new Error(error)
  }
}

const findOneById = async (cardId, session) => {
  try {
    const result = await GET_DB()
      .collection(CARD_COLLECTION_NAME)
      .findOne(
        { _id: new ObjectId(cardId) },
        SESSION_OPTIONS(session)
      )

    return result
  } catch (error) {
    throw new Error(error)
  }
}

const findByColumnIds = async (columnIds, session) => {
  try {
    return await GET_DB()
      .collection(CARD_COLLECTION_NAME)
      .find(
        {
          columnId: { $in: columnIds.map((id) => new ObjectId(id)) },
          _destroy: false
        },
        SESSION_OPTIONS(session)
      )
      .toArray()
  } catch (error) {
    throw new Error(error)
  }
}

const findArchivedByBoardId = async (boardId) => {
  return await GET_DB()
    .collection(CARD_COLLECTION_NAME)
    .find({
      boardId: new ObjectId(boardId),
      archivedAt: { $ne: null },
      _destroy: false
    })
    .sort({ archivedAt: -1, _id: -1 })
    .toArray()
}

const update = async (cardId, updateData, session) => {
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
        SESSION_OPTIONS(session, { returnDocument: 'after' })
      )

    return result
  } catch (error) {
    throw new Error(error)
  }
}

const deleteManyByColumnId = async (columnId, session) => {
  try {
    const result = await GET_DB()
      .collection(CARD_COLLECTION_NAME)
      .deleteMany(
        { columnId: new ObjectId(columnId) },
        SESSION_OPTIONS(session)
      )

    return result
  } catch (error) {
    throw new Error(error)
  }
}

const unShiftNewComment = async (cardId, commentData, session) => {
  try {
    const result = await GET_DB()
      .collection(CARD_COLLECTION_NAME)
      .findOneAndUpdate(
        { _id: new ObjectId(cardId) },
        { $push: { comments: { $each: [commentData], $position: 0 } } },
        SESSION_OPTIONS(session, { returnDocument: 'after' })
      )

    return result
  } catch (error) {
    throw new Error(error)
  }
}

const updateMembers = async (cardId, incommingMemberInfo, session) => {
  try {
    let updateCondition = {}
    if (incommingMemberInfo.action === CARD_MEMBER_ACTIONS.ADD) {
      updateCondition = {
        $addToSet: { memberIds: new ObjectId(incommingMemberInfo.userId) }
      }
    }
    if (incommingMemberInfo.action === CARD_MEMBER_ACTIONS.REMOVE) {
      updateCondition = {
        $pull: { memberIds: new ObjectId(incommingMemberInfo.userId) }
      }
    }

    const result = await GET_DB()
      .collection(CARD_COLLECTION_NAME)
      .findOneAndUpdate(
        { _id: new ObjectId(cardId) },
        updateCondition,
        SESSION_OPTIONS(session, { returnDocument: 'after' })
      )

    return result
  } catch (error) {
    throw new Error(error)
  }
}

const updateComment = async (cardId, commentId, commentData, session) =>
  await GET_DB()
    .collection(CARD_COLLECTION_NAME)
    .findOneAndUpdate(
      { _id: new ObjectId(cardId), 'comments._id': commentId },
      {
        $set: {
          'comments.$.content': commentData.content,
          'comments.$.editedAt': commentData.editedAt,
          'comments.$.reactions': commentData.reactions
        }
      },
      SESSION_OPTIONS(session, { returnDocument: 'after' })
    )

const removeComment = async (cardId, commentId, session) =>
  await GET_DB()
    .collection(CARD_COLLECTION_NAME)
    .findOneAndUpdate(
      { _id: new ObjectId(cardId), 'comments._id': commentId },
      { $pull: { comments: { _id: commentId } } },
      SESSION_OPTIONS(session, { returnDocument: 'after' })
    )

const addAttachment = async (cardId, attachment, session) =>
  await GET_DB()
    .collection(CARD_COLLECTION_NAME)
    .findOneAndUpdate(
      { _id: new ObjectId(cardId), 'attachments.49': { $exists: false } },
      { $push: { attachments: attachment }, $set: { updatedAt: Date.now() } },
      SESSION_OPTIONS(session, { returnDocument: 'after' })
    )

const removeAttachment = async (cardId, attachmentId, session) =>
  await GET_DB()
    .collection(CARD_COLLECTION_NAME)
    .findOneAndUpdate(
      { _id: new ObjectId(cardId), 'attachments._id': attachmentId },
      {
        $pull: { attachments: { _id: attachmentId } },
        $set: { updatedAt: Date.now() }
      },
      SESSION_OPTIONS(session, { returnDocument: 'after' })
    )

export const cardModel = {
  CARD_COLLECTION_NAME,
  CARD_COLLECTION_SCHEMA,
  createNew,
  findOneById,
  findByColumnIds,
  findArchivedByBoardId,
  update,
  deleteManyByColumnId,
  unShiftNewComment,
  updateComment,
  removeComment,
  updateMembers,
  addAttachment,
  removeAttachment
}
