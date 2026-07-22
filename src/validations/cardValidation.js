import Joi from 'joi'
import { StatusCodes } from 'http-status-codes'
import ApiError from '~/utils/ApiError'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validators'
import {
  CARD_MEMBER_ACTIONS,
  CARD_PRIORITIES
} from '~/utils/constants'

const nullableTimestamp = Joi.date().timestamp('javascript').allow(null)
const labelSchema = Joi.object({
  _id: Joi.string().pattern(OBJECT_ID_RULE),
  name: Joi.string().required().min(1).max(32).trim().strict(),
  color: Joi.string().required().pattern(/^#[0-9a-fA-F]{6}$/)
})
const checklistItemSchema = Joi.object({
  _id: Joi.string().pattern(OBJECT_ID_RULE),
  title: Joi.string().required().min(1).max(120).trim().strict(),
  isCompleted: Joi.boolean().required(),
  completedAt: nullableTimestamp,
  completedBy: Joi.string().pattern(OBJECT_ID_RULE).allow(null)
})

const createNew = async (req, res, next) => {
  const correctCondition = Joi.object({
    boardId: Joi.string()
      .required()
      .pattern(OBJECT_ID_RULE)
      .message(OBJECT_ID_RULE_MESSAGE),
    columnId: Joi.string()
      .required()
      .pattern(OBJECT_ID_RULE)
      .message(OBJECT_ID_RULE_MESSAGE),
    title: Joi.string().required().min(3).max(50).trim().strict()
  })

  try {
    //set abortEarly: false trong có nhiều lỗi validation thì trả về tất cả lỗi
    await correctCondition.validateAsync(req.body, { abortEarly: false })
    next()
  } catch (error) {
    const errorMessage = new Error(error).message
    const customError = new ApiError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      errorMessage
    )
    next(customError)
  }
}
const update = async (req, res, next) => {
  const correctCondition = Joi.object({
    title: Joi.string().min(3).max(50).trim().strict(),
    description: Joi.string().optional(),
    priority: Joi.string().valid(...Object.values(CARD_PRIORITIES)),
    startDate: nullableTimestamp,
    dueDate: nullableTimestamp,
    completedAt: nullableTimestamp,
    labels: Joi.array().items(labelSchema).max(20),
    checklist: Joi.array().items(checklistItemSchema).max(100),
    watcherIds: Joi.array()
      .items(Joi.string().pattern(OBJECT_ID_RULE))
      .unique(),
    commentToAdd: Joi.object({
      content: Joi.string().min(1).max(2000).trim().strict().required()
    }),
    commentToUpdate: Joi.object({
      commentId: Joi.string().required().pattern(OBJECT_ID_RULE),
      content: Joi.string().min(1).max(2000).trim().strict().required()
    }),
    commentToDelete: Joi.object({
      commentId: Joi.string().required().pattern(OBJECT_ID_RULE)
    }),
    commentReaction: Joi.object({
      commentId: Joi.string().required().pattern(OBJECT_ID_RULE),
      emoji: Joi.string().min(1).max(16).required()
    }),
    incommingMemberInfo: Joi.object({
      userId: Joi.string()
        .required()
        .pattern(OBJECT_ID_RULE)
        .message(OBJECT_ID_RULE_MESSAGE),
      action: Joi.string()
        .required()
        .valid(CARD_MEMBER_ACTIONS.ADD, CARD_MEMBER_ACTIONS.REMOVE)
    })
  })

  try {
    //set abortEarly: false trong có nhiều lỗi validation thì trả về tất cả lỗi
    await correctCondition.validateAsync(req.body, { abortEarly: false })
    next()
  } catch (error) {
    next(
      new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, new Error(error).message)
    )
  }
}

const setArchived = async (req, res, next) => {
  try {
    await Joi.object({
      archived: Joi.boolean().required()
    }).validateAsync(req.body, { abortEarly: false })
    next()
  } catch (error) {
    next(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, new Error(error).message))
  }
}

const copy = async (req, res, next) => {
  try {
    await Joi.object({
      targetColumnId: Joi.string()
        .required()
        .pattern(OBJECT_ID_RULE)
        .message(OBJECT_ID_RULE_MESSAGE),
      title: Joi.string().min(3).max(50).trim().strict()
    }).validateAsync(req.body, { abortEarly: false })
    next()
  } catch (error) {
    next(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, new Error(error).message))
  }
}

const move = async (req, res, next) => {
  try {
    await Joi.object({
      targetColumnId: Joi.string()
        .required()
        .pattern(OBJECT_ID_RULE)
        .message(OBJECT_ID_RULE_MESSAGE)
    }).validateAsync(req.body, { abortEarly: false })
    next()
  } catch (error) {
    next(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, new Error(error).message))
  }
}

export const cardValidation = {
  createNew,
  update,
  setArchived,
  copy,
  move
}
