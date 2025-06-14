import Joi from 'joi'
import { StatusCodes } from 'http-status-codes'
import ApiError from '~/utils/ApiError'

const createNewBoardInvitation = async (req, res, next) => {
  const correctCondition = Joi.object({
    inviteeEmail: Joi.string().required(),
    boardId: Joi.string().required()
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

export const invitationValidation = {
  createNewBoardInvitation
}
