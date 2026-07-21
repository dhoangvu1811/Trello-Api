import Joi from 'joi'
import { ObjectId } from 'mongodb'
import { GET_DB, SESSION_OPTIONS } from '~/config/mongodb'
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ENTITY_TYPES
} from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'

const ACTIVITY_COLLECTION_NAME = 'activities'
const ACTIVITY_COLLECTION_SCHEMA = Joi.object({
  boardId: Joi.string()
    .required()
    .pattern(OBJECT_ID_RULE)
    .message(OBJECT_ID_RULE_MESSAGE),
  actorId: Joi.string()
    .required()
    .pattern(OBJECT_ID_RULE)
    .message(OBJECT_ID_RULE_MESSAGE),
  action: Joi.string()
    .required()
    .valid(...Object.values(ACTIVITY_ACTIONS)),
  entityType: Joi.string()
    .required()
    .valid(...Object.values(ACTIVITY_ENTITY_TYPES)),
  entityId: Joi.string()
    .required()
    .pattern(OBJECT_ID_RULE)
    .message(OBJECT_ID_RULE_MESSAGE),
  metadata: Joi.object().unknown(true).default({}),
  createdAt: Joi.date().timestamp('javascript').default(Date.now)
})

const createNew = async (data, session) => {
  const validData = await ACTIVITY_COLLECTION_SCHEMA.validateAsync(data, {
    abortEarly: false
  })
  const newActivity = {
    ...validData,
    boardId: new ObjectId(validData.boardId),
    actorId: new ObjectId(validData.actorId),
    entityId: new ObjectId(validData.entityId)
  }

  return await GET_DB()
    .collection(ACTIVITY_COLLECTION_NAME)
    .insertOne(newActivity, SESSION_OPTIONS(session))
}

export const activityModel = {
  ACTIVITY_COLLECTION_NAME,
  ACTIVITY_COLLECTION_SCHEMA,
  createNew
}
