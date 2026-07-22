/* eslint-disable no-useless-catch */
import ApiError from '~/utils/ApiError'
import { slugify } from '~/utils/formatters'
import { boardModel } from '~/models/boardModel'
import { StatusCodes } from 'http-status-codes'
import { cloneDeep } from 'lodash'
import { columnModel } from '~/models/columnModel'
import { cardModel } from '~/models/cardModel'
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ENTITY_TYPES,
  DEFAULT_ITEMS_PER_PAGE,
  DEFAULT_PAGE
} from '~/utils/constants'
import { hasSameIds } from '~/utils/resourceOrder'
import { WITH_TRANSACTION } from '~/config/mongodb'
import { activityService } from '~/services/activityService'
import { getBoardRole } from '~/utils/boardPermissions'

const createNew = async (userId, reqBody) => {
  try {
    // Xử lý logic
    const newBoard = {
      ...reqBody,
      slug: slugify(reqBody.title)
    }

    return await WITH_TRANSACTION(async (session) => {
      const createdBoard = await boardModel.createNew(userId, newBoard, session)
      const getNewBoard = await boardModel.findOneById(
        createdBoard.insertedId,
        session
      )

      await activityService.createNew(
        {
          boardId: createdBoard.insertedId.toString(),
          actorId: userId,
          action: ACTIVITY_ACTIONS.BOARD_CREATED,
          entityType: ACTIVITY_ENTITY_TYPES.BOARD,
          entityId: createdBoard.insertedId.toString()
        },
        session
      )

      return getNewBoard
    })
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
    resBoard.currentUserRole = getBoardRole(board, userId)
    resBoard.owners = resBoard.owners.map((owner) => ({
      ...owner,
      boardRole: getBoardRole(board, owner._id)
    }))
    resBoard.members = resBoard.members.map((member) => ({
      ...member,
      boardRole: getBoardRole(board, member._id)
    }))
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
const update = async (boardId, reqBody, actorId) => {
  try {
    return await WITH_TRANSACTION(async (session) => {
      if (reqBody.columnOrderIds) {
        const columns = await columnModel.findByBoardId(boardId, session)
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
      const updatedBoard = await boardModel.update(boardId, updateData, session)
      if (!updatedBoard)
        throw new ApiError(StatusCodes.NOT_FOUND, 'Board not found!')

      await activityService.createNew(
        {
          boardId,
          actorId,
          action: ACTIVITY_ACTIONS.BOARD_UPDATED,
          entityType: ACTIVITY_ENTITY_TYPES.BOARD,
          entityId: boardId,
          metadata: { fields: Object.keys(reqBody) }
        },
        session
      )

      return updatedBoard
    })
  } catch (error) {
    throw error
  }
}
const moveCardToDifferentColumn = async (reqBody, actorId) => {
  try {
    return await WITH_TRANSACTION(async (session) => {
      const cards = await cardModel.findByColumnIds(
        [reqBody.prevColumnId, reqBody.nextColumnId],
        session
      )
      const currentCardId = reqBody.curentCardId
      const currentCard = cards.find(
        (card) => card._id.toString() === currentCardId
      )
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
        !currentCard ||
        !hasSameIds(expectedPreviousIds, reqBody.prevCardOderIds) ||
        !hasSameIds(expectedNextIds, reqBody.nextCardOrderIds)
      ) {
        throw new ApiError(
          StatusCodes.UNPROCESSABLE_ENTITY,
          'Card order does not match the current board state.'
        )
      }

      const updatedPreviousColumn = await columnModel.update(
        reqBody.prevColumnId,
        {
          cardOrderIds: reqBody.prevCardOderIds,
          updatedAt: Date.now()
        },
        session
      )
      const updatedNextColumn = await columnModel.update(
        reqBody.nextColumnId,
        {
          cardOrderIds: reqBody.nextCardOrderIds,
          updatedAt: Date.now()
        },
        session
      )
      const updatedCard = await cardModel.update(
        currentCardId,
        { columnId: reqBody.nextColumnId, updatedAt: Date.now() },
        session
      )
      if (!updatedPreviousColumn || !updatedNextColumn || !updatedCard) {
        throw new ApiError(
          StatusCodes.NOT_FOUND,
          'Card or target column not found!'
        )
      }

      await activityService.createNew(
        {
          boardId: currentCard.boardId.toString(),
          actorId,
          action: ACTIVITY_ACTIONS.CARD_MOVED,
          entityType: ACTIVITY_ENTITY_TYPES.CARD,
          entityId: currentCardId,
          metadata: {
            fromColumnId: reqBody.prevColumnId,
            toColumnId: reqBody.nextColumnId
          }
        },
        session
      )

      return { updateResult: 'Successfully!' }
    })
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

const updateMemberRole = async (
  boardId,
  memberId,
  role,
  actorId
) => {
  return await WITH_TRANSACTION(async (session) => {
    const updatedBoard = await boardModel.setMemberRole(
      boardId,
      memberId,
      role,
      session
    )
    if (!updatedBoard) {
      throw new ApiError(
        StatusCodes.UNPROCESSABLE_ENTITY,
        'The target user is not a non-owner member of this board.'
      )
    }

    await activityService.createNew(
      {
        boardId,
        actorId,
        action: ACTIVITY_ACTIONS.BOARD_MEMBER_ROLE_CHANGED,
        entityType: ACTIVITY_ENTITY_TYPES.BOARD,
        entityId: boardId,
        metadata: { memberId, role }
      },
      session
    )

    return { memberId, role }
  })
}

export const boardService = {
  createNew,
  getDetails,
  update,
  moveCardToDifferentColumn,
  getBoards,
  updateMemberRole
}
