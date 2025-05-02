import { StatusCodes } from 'http-status-codes'
// import ApiError from '~/utils/ApiError'
import { cardService } from '~/services/cardService'

const createNew = async (req, res, next) => {
  try {
    // console.log('req.body', req.body)
    // throw new ApiError(StatusCodes.BAD_GATEWAY, 'test')

    const createCard = await cardService.createNew(req.body)

    res.status(StatusCodes.CREATED).json(createCard)
  } catch (error) {
    next(error)
  }
}

export const cardController = {
  createNew
}
