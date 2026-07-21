import Joi from 'joi'
import { StatusCodes } from 'http-status-codes'
import ApiError from '~/utils/ApiError'
import {
  BOARD_INVITATION_STATUS,
  BOARD_ROLES
} from '~/utils/constants'
import {
  EMAIL_RULE,
  EMAIL_RULE_MESSAGE,
  OBJECT_ID_RULE,
  OBJECT_ID_RULE_MESSAGE
} from '~/utils/validators'

const createNewBoardInvitation = async (req, res, next) => {
  const correctCondition = Joi.object({
    inviteeEmail: Joi.string()
      .required()
      .pattern(EMAIL_RULE)
      .message(EMAIL_RULE_MESSAGE),
    boardId: Joi.string()
      .required()
      .pattern(OBJECT_ID_RULE)
      .message(OBJECT_ID_RULE_MESSAGE),
    role: Joi.string().valid(BOARD_ROLES.MEMBER, BOARD_ROLES.VIEWER)
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

const updateBoardInvitation = async (req, res, next) => {
  const correctCondition = Joi.object({
    status: Joi.string()
      .required()
      .valid(
        BOARD_INVITATION_STATUS.ACCEPTED,
        BOARD_INVITATION_STATUS.REJECTED
      )
  })

  try {
    await correctCondition.validateAsync(req.body, { abortEarly: false })
    next()
  } catch (error) {
    next(
      new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, new Error(error).message)
    )
  }
}

export const invitationValidation = {
  createNewBoardInvitation,
  updateBoardInvitation
}
