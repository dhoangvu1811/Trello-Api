import Joi from 'joi'
import { ObjectId } from 'mongodb'
import { GET_DB, SESSION_OPTIONS } from '~/config/mongodb'
import { NOTIFICATION_TYPES } from '~/utils/constants'
import { OBJECT_ID_RULE } from '~/utils/validators'

const NOTIFICATION_COLLECTION_NAME = 'notifications'
const NOTIFICATION_SCHEMA = Joi.object({
  userId: Joi.string().required().pattern(OBJECT_ID_RULE),
  actorId: Joi.string().pattern(OBJECT_ID_RULE).allow(null).default(null),
  boardId: Joi.string().required().pattern(OBJECT_ID_RULE),
  cardId: Joi.string().required().pattern(OBJECT_ID_RULE),
  type: Joi.string().required().valid(...Object.values(NOTIFICATION_TYPES)),
  message: Joi.string().required().max(500),
  dedupeKey: Joi.string().required().max(500),
  readAt: Joi.date().timestamp('javascript').allow(null).default(null),
  createdAt: Joi.date().timestamp('javascript').default(Date.now)
})

const create = async (data, session) => {
  const validData = await NOTIFICATION_SCHEMA.validateAsync(data, {
    abortEarly: false
  })
  const document = {
    ...validData,
    userId: new ObjectId(validData.userId),
    actorId: validData.actorId ? new ObjectId(validData.actorId) : null,
    boardId: new ObjectId(validData.boardId),
    cardId: new ObjectId(validData.cardId)
  }
  return await GET_DB()
    .collection(NOTIFICATION_COLLECTION_NAME)
    .updateOne(
      { dedupeKey: document.dedupeKey },
      { $setOnInsert: document },
      SESSION_OPTIONS(session, { upsert: true })
    )
}

const findByUserId = async (userId, limit = 50) =>
  await GET_DB()
    .collection(NOTIFICATION_COLLECTION_NAME)
    .find({ userId: new ObjectId(userId) })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .toArray()

const markRead = async (notificationId, userId) =>
  await GET_DB()
    .collection(NOTIFICATION_COLLECTION_NAME)
    .findOneAndUpdate(
      { _id: new ObjectId(notificationId), userId: new ObjectId(userId) },
      { $set: { readAt: Date.now() } },
      { returnDocument: 'after' }
    )

const markAllRead = async (userId) =>
  await GET_DB()
    .collection(NOTIFICATION_COLLECTION_NAME)
    .updateMany(
      { userId: new ObjectId(userId), readAt: null },
      { $set: { readAt: Date.now() } }
    )

export const notificationModel = {
  NOTIFICATION_COLLECTION_NAME,
  NOTIFICATION_SCHEMA,
  create,
  findByUserId,
  markRead,
  markAllRead
}
