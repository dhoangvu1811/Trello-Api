import Joi from 'joi'
import { ObjectId } from 'mongodb'
import { GET_DB, SESSION_OPTIONS } from '~/config/mongodb'
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ENTITY_TYPES
} from '~/utils/constants'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'
import { pagingSkipValue } from '~/utils/algorithms'
import { userModel } from '~/models/userModel'
import { cardModel } from '~/models/cardModel'
import { columnModel } from '~/models/columnModel'
import { boardModel } from '~/models/boardModel'

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

const findByBoardId = async (boardId, page, itemsPerPage) => {
  const [result] = await GET_DB()
    .collection(ACTIVITY_COLLECTION_NAME)
    .aggregate([
      { $match: { boardId: new ObjectId(boardId) } },
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $facet: {
          activities: [
            { $skip: pagingSkipValue(page, itemsPerPage) },
            { $limit: itemsPerPage },
            {
              $lookup: {
                from: userModel.USER_COLLECTION_NAME,
                localField: 'actorId',
                foreignField: '_id',
                as: 'actor',
                pipeline: [{ $project: userModel.PUBLIC_USER_PROJECTION }]
              }
            },
            {
              $set: {
                targetUserObjectId: {
                  $convert: {
                    input: {
                      $ifNull: [
                        '$metadata.targetUserId',
                        {
                          $ifNull: [
                            '$metadata.memberId',
                            '$metadata.inviteeId'
                          ]
                        }
                      ]
                    },
                    to: 'objectId',
                    onError: null,
                    onNull: null
                  }
                }
              }
            },
            {
              $lookup: {
                from: userModel.USER_COLLECTION_NAME,
                localField: 'targetUserObjectId',
                foreignField: '_id',
                as: 'targetUser',
                pipeline: [{
                  $project: {
                    _id: 1,
                    userName: 1,
                    displayName: 1,
                    avatar: 1
                  }
                }]
              }
            },
            {
              $lookup: {
                from: cardModel.CARD_COLLECTION_NAME,
                localField: 'entityId',
                foreignField: '_id',
                as: 'cardEntity',
                pipeline: [{ $project: { title: 1 } }]
              }
            },
            {
              $lookup: {
                from: columnModel.COLUMN_COLLECTION_NAME,
                localField: 'entityId',
                foreignField: '_id',
                as: 'columnEntity',
                pipeline: [{ $project: { title: 1 } }]
              }
            },
            {
              $lookup: {
                from: boardModel.BOARD_COLLECTION_NAME,
                localField: 'entityId',
                foreignField: '_id',
                as: 'boardEntity',
                pipeline: [{ $project: { title: 1 } }]
              }
            },
            {
              $set: {
                actor: { $first: '$actor' },
                targetUser: { $first: '$targetUser' },
                entityTitle: {
                  $ifNull: [
                    { $first: '$cardEntity.title' },
                    {
                      $ifNull: [
                        { $first: '$columnEntity.title' },
                        { $first: '$boardEntity.title' }
                      ]
                    }
                  ]
                }
              }
            },
            {
              $unset: [
                'targetUserObjectId',
                'cardEntity',
                'columnEntity',
                'boardEntity'
              ]
            }
          ],
          total: [{ $count: 'count' }]
        }
      }
    ])
    .toArray()

  return {
    activities: result?.activities || [],
    totalActivities: result?.total[0]?.count || 0
  }
}

export const activityModel = {
  ACTIVITY_COLLECTION_NAME,
  ACTIVITY_COLLECTION_SCHEMA,
  createNew,
  findByBoardId
}
