/* eslint-disable no-useless-catch */
import ApiError from '~/utils/ApiError'
import { slugify } from '~/utils/formatters'
import { boardModel } from '~/models/boardModel'
import { StatusCodes } from 'http-status-codes'
import { cloneDeep } from 'lodash'
import { columnModel } from '~/models/columnModel'
import { cardModel } from '~/models/cardModel'

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

    const resBoard = cloneDeep(board)
    //Đưa card về đúng column (dữ liệu chưa đúng vì card nằm cùng cấp với column)
    //method equals được mongoDb support
    resBoard.columns.forEach((column) => {
      column.cards = resBoard.cards.filter((card) =>
        card.columnId.equals(column._id)
      )
    })

    // resBoard.columns.forEach((column) => {
    //   column.cards = resBoard.cards.filter(
    //     (card) => card.columnId.toString() === column._id.toString()
    //   )
    // })

    delete resBoard.cards

    return resBoard
  } catch (error) {
    throw error
  }
}
const update = async (boardId, reqBody) => {
  try {
    const updateData = {
      ...reqBody,
      updatedAt: Date.now()
    }
    const updatedBoard = await boardModel.update(boardId, updateData)

    return updatedBoard
  } catch (error) {
    throw error
  }
}
const moveCardToDifferentColumn = async (reqBody) => {
  try {
    // B1: Cập nhật lại mảng cardOrderIds trong column cũ (xoá đi id của card đã kéo)
    await columnModel.update(reqBody.prevColumnId, {
      cardOrderIds: reqBody.prevCardOderIds,
      updatedAt: Date.now()
    })
    // B2: Cập nhật lại mảng  cardOrderIds trong column mới (thêm id của card đã kéo)
    await columnModel.update(reqBody.nextColumnId, {
      cardOrderIds: reqBody.nextCardOrderIds,
      updatedAt: Date.now()
    })
    // B3: Cập nhật lại trường columnId của card đã kéo
    await cardModel.update(reqBody.curentCardId, {
      columnId: reqBody.nextColumnId,
      updatedAt: Date.now()
    })

    return { updateResult: 'Successfully!' }
  } catch (error) {
    throw error
  }
}

export const boardService = {
  createNew,
  getDetails,
  update,
  moveCardToDifferentColumn
}
