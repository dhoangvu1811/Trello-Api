/* eslint-disable no-useless-catch */
import ApiError from '~/utils/ApiError'
import { slugify } from '~/utils/formatters'
import { boardModel } from '~/models/boardModel'
import { StatusCodes } from 'http-status-codes'
import { cloneDeep } from 'lodash'
import { columnModel } from '~/models/columnModel'
import { cardModel } from '~/models/cardModel'
import { DEFAULT_ITEMS_PER_PAGE, DEFAULT_PAGE } from '~/utils/constants'
import { hasSameIds } from '~/utils/resourceOrder'

const createNew = async (userId, reqBody) => {
  try {
    // Xử lý logic
    const newBoard = {
      ...reqBody,
      slug: slugify(reqBody.title)
    }

    //Gọi tới model để xử lý lưu bản ghi trong DB
    const createdBoard = await boardModel.createNew(userId, newBoard)

    const getNewBoard = await boardModel.findOneById(createdBoard.insertedId)

    return getNewBoard
  } catch (error) {
    throw error
  }
}
const getDetails = async (userId, boardId) => {
  try {
    const board = await boardModel.getDetails(userId, boardId)
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
    if (reqBody.columnOrderIds) {
      const columns = await columnModel.findByBoardId(boardId)
      const columnIds = columns.map((column) => column._id)
      if (!hasSameIds(columnIds, reqBody.columnOrderIds)) {
        throw new ApiError(
          StatusCodes.UNPROCESSABLE_ENTITY,
          'Column order must contain every column in this board exactly once.'
        )
      }
    }

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
    const cards = await cardModel.findByColumnIds([
      reqBody.prevColumnId,
      reqBody.nextColumnId
    ])
    const currentCardId = reqBody.curentCardId
    const expectedPreviousIds = cards
      .filter(
        (card) =>
          card.columnId.toString() === reqBody.prevColumnId &&
          card._id.toString() !== currentCardId
      )
      .map((card) => card._id)
    const expectedNextIds = cards
      .filter((card) => card.columnId.toString() === reqBody.nextColumnId)
      .map((card) => card._id)
      .concat(currentCardId)

    if (
      !hasSameIds(expectedPreviousIds, reqBody.prevCardOderIds) ||
      !hasSameIds(expectedNextIds, reqBody.nextCardOrderIds)
    ) {
      throw new ApiError(
        StatusCodes.UNPROCESSABLE_ENTITY,
        'Card order does not match the current board state.'
      )
    }

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

const getBoards = async (userId, page, itemsPerPage, queryFilter) => {
  try {
    if (!page) page = DEFAULT_PAGE
    if (!itemsPerPage) itemsPerPage = DEFAULT_ITEMS_PER_PAGE

    const result = await boardModel.getBoards(
      userId,
      parseInt(page, 10),
      parseInt(itemsPerPage, 10),
      queryFilter
    )

    return result
  } catch (error) {
    throw error
  }
}

export const boardService = {
  createNew,
  getDetails,
  update,
  moveCardToDifferentColumn,
  getBoards
}
