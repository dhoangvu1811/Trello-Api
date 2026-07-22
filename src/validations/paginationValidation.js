import Joi from 'joi'
import { StatusCodes } from 'http-status-codes'
import ApiError from '~/utils/ApiError'
import { MAX_ITEMS_PER_PAGE } from '~/utils/constants'

const validate = (querySchema) => async (req, res, next) => {
  const paginationSchema = Joi.object({
    page: Joi.number().integer().min(1),
    itemsPerPage: Joi.number().integer().min(1).max(MAX_ITEMS_PER_PAGE),
    ...querySchema
  })

  try {
    req.query = await paginationSchema.validateAsync(req.query, {
      abortEarly: false,
      stripUnknown: true
    })
    next()
  } catch (error) {
    next(
      new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, new Error(error).message)
    )
  }
}

export const paginationValidation = {
  boards: validate({
    q: Joi.object({
      title: Joi.string().trim().max(50)
    })
  }),
  activities: validate({})
}
