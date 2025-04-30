/* eslint-disable no-useless-catch */
import ApiError from '~/utils/ApiError'
import { slugify } from '~/utils/formatters'
import { boardModel } from '~/models/boardModel'
import { StatusCodes } from 'http-status-codes'

const createNew = async (reqBody) => {
  try {
    // Xử lý logic
    const newBoard = {
      ...reqBody,
      slug: slugify(reqBody.title)
    }

    //Gọi tới model để xử lý lưu bản ghi trong DB
    const createdBoard = await boardModel.createNew(newBoard)

    const getNewBoard = await boardModel.findOneById(createdBoard.insertedId)

    return getNewBoard
  } catch (error) {
    throw error
  }
}
const getDetails = async (boardId) => {
  try {
    const board = await boardModel.getDetails(boardId)
    if (!board) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Board not found!')
    }

    return board
  } catch (error) {
    throw error
  }
}

export const boardService = {
  createNew,
  getDetails
}
