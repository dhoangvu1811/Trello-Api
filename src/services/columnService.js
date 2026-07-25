/* eslint-disable no-useless-catch */
import { StatusCodes } from 'http-status-codes'
import { boardModel } from '~/models/boardModel'
import { cardModel } from '~/models/cardModel'
import { columnModel } from '~/models/columnModel'
import ApiError from '~/utils/ApiError'
import { hasSameIds } from '~/utils/resourceOrder'
import { WITH_TRANSACTION } from '~/config/mongodb'
import { activityService } from '~/services/activityService'
import { ACTIVITY_ACTIONS, ACTIVITY_ENTITY_TYPES } from '~/utils/constants'

const createNew = async (reqBody, actorId) => {
  try {
    // Xử lý logic
    const newColumn = {
      ...reqBody
    }

    return await WITH_TRANSACTION(async (session) => {
      const createdColumn = await columnModel.createNew(newColumn, session)
      const getNewColumn = await columnModel.findOneById(
        createdColumn.insertedId,
        session
      )

      getNewColumn.cards = []
      const updatedBoard = await boardModel.pushColumnOrderIds(
        getNewColumn,
        session
      )
      if (!updatedBoard)
        throw new ApiError(StatusCodes.NOT_FOUND, 'Board not found!')

      await activityService.createNew(
        {
          boardId: getNewColumn.boardId.toString(),
          actorId,
          action: ACTIVITY_ACTIONS.COLUMN_CREATED,
          entityType: ACTIVITY_ENTITY_TYPES.COLUMN,
          entityId: getNewColumn._id.toString()
        },
        session
      )

      return getNewColumn
    })
  } catch (error) {
    throw error
  }
}

const update = async (columnId, reqBody, actorId) => {
  try {
    return await WITH_TRANSACTION(async (session) => {
      const targetColumn = await columnModel.findOneById(columnId, session)
      if (!targetColumn)
        throw new ApiError(StatusCodes.NOT_FOUND, 'Column not found!')

      if (reqBody.cardOrderIds) {
        const cards = await cardModel.findByColumnIds([columnId], session)
        if (!hasSameIds(cards.map((card) => card._id), reqBody.cardOrderIds)) {
          throw new ApiError(
            StatusCodes.UNPROCESSABLE_ENTITY,
            'Card order must contain every card in this column exactly once.'
          )
        }
      }

      const updateData = { ...reqBody, updatedAt: Date.now() }
      const updatedColumn = await columnModel.update(
        columnId,
        updateData,
        session
      )
      await activityService.createNew(
        {
          boardId: targetColumn.boardId.toString(),
          actorId,
          action: ACTIVITY_ACTIONS.COLUMN_UPDATED,
          entityType: ACTIVITY_ENTITY_TYPES.COLUMN,
          entityId: columnId,
          metadata: { fields: Object.keys(reqBody) }
        },
        session
      )

      return updatedColumn
    })
  } catch (error) {
    throw error
  }
}
const deleteItem = async (columnId, actorId) => {
  try {
    return await WITH_TRANSACTION(async (session) => {
      const targetColumn = await columnModel.findOneById(columnId, session)
      if (!targetColumn)
        throw new ApiError(StatusCodes.NOT_FOUND, 'Column not found!')

      const deleteResult = await columnModel.deleteOnebyId(columnId, session)
      await cardModel.deleteManyByColumnId(columnId, session)
      const updatedBoard = await boardModel.pullColumnOrderIds(
        targetColumn,
        session
      )
      if (!deleteResult.deletedCount || !updatedBoard) {
        throw new ApiError(
          StatusCodes.NOT_FOUND,
          'Column or parent board not found!'
        )
      }

      await activityService.createNew(
        {
          boardId: targetColumn.boardId.toString(),
          actorId,
          action: ACTIVITY_ACTIONS.COLUMN_DELETED,
          entityType: ACTIVITY_ENTITY_TYPES.COLUMN,
          entityId: columnId,
          metadata: { entityTitle: targetColumn.title }
        },
        session
      )

      return { deleteResult: 'Column and its Cards deleted successfully!' }
    })
  } catch (error) {
    throw error
  }
}

export const columnService = {
  createNew,
  update,
  deleteItem
}
