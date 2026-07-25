import { ObjectId } from 'mongodb'
import { StatusCodes } from 'http-status-codes'
import { boardModel } from '~/models/boardModel'
import { cardModel } from '~/models/cardModel'
import { columnModel } from '~/models/columnModel'
import ApiError from '~/utils/ApiError'
import {
  canAccessBoard,
  canEditBoardContent,
  canManageBoard,
  isBoardOwner
} from '~/utils/boardPermissions'

const ensureValidId = (id, resourceName) => {
  if (!ObjectId.isValid(id)) {
    throw new ApiError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      `${resourceName} id is invalid.`
    )
  }
}

const getBoard = async (boardId) => {
  ensureValidId(boardId, 'Board')
  const board = await boardModel.findOneById(boardId)

  if (!board || board._destroy) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Board not found!')
  }

  return board
}

const authorize = (resolveBoard, hasPermission) => {
  return async (req, res, next) => {
    try {
      const board = await resolveBoard(req)
      const userId = req.jwtDecoded._id

      if (!hasPermission(board, userId, req)) {
        throw new ApiError(
          StatusCodes.FORBIDDEN,
          'You do not have permission to perform this board action.'
        )
      }

      req.authorizedBoard = board
      next()
    } catch (error) {
      next(error)
    }
  }
}

const resolveBoardParam = async (req) => {
  return await getBoard(req.params.id)
}

const resolveBodyBoard = async (req) => {
  const board = await getBoard(req.body.boardId)

  if (req.body.columnId) {
    ensureValidId(req.body.columnId, 'Column')
    const column = await columnModel.findOneById(req.body.columnId)
    if (!column || column.boardId.toString() !== board._id.toString()) {
      throw new ApiError(
        StatusCodes.UNPROCESSABLE_ENTITY,
        'Column does not belong to the requested board.'
      )
    }
  }

  return board
}

const resolveColumnParam = async (req) => {
  ensureValidId(req.params.id, 'Column')
  const column = await columnModel.findOneById(req.params.id)
  if (!column) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Column not found!')
  }

  return await getBoard(column.boardId.toString())
}

const resolveCardParam = async (req) => {
  ensureValidId(req.params.id, 'Card')
  const card = await cardModel.findOneById(req.params.id)
  if (!card) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Card not found!')
  }

  return await getBoard(card.boardId.toString())
}

const resolveCardMove = async (req) => {
  const { curentCardId, prevColumnId, nextColumnId } = req.body
  ensureValidId(curentCardId, 'Card')
  ensureValidId(prevColumnId, 'Previous column')
  ensureValidId(nextColumnId, 'Next column')

  if (prevColumnId === nextColumnId) {
    throw new ApiError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      'Cross-column move requires two different columns.'
    )
  }

  const [card, previousColumn, nextColumn] = await Promise.all([
    cardModel.findOneById(curentCardId),
    columnModel.findOneById(prevColumnId),
    columnModel.findOneById(nextColumnId)
  ])

  if (!card || !previousColumn || !nextColumn) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      'Card or target column not found!'
    )
  }

  const boardId = card.boardId.toString()
  const isSameBoard =
    previousColumn.boardId.toString() === boardId &&
    nextColumn.boardId.toString() === boardId
  const isCurrentColumn = card.columnId.toString() === prevColumnId

  if (!isSameBoard || !isCurrentColumn) {
    throw new ApiError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      'Card move contains resources from different boards or columns.'
    )
  }

  return await getBoard(boardId)
}

export const boardAuthorizationMiddleware = {
  requireBoardAccessByParam: authorize(resolveBoardParam, canAccessBoard),
  requireBoardContentEditorByBody: authorize(
    resolveBodyBoard,
    canEditBoardContent
  ),
  requireBoardContentEditorByColumn: authorize(
    resolveColumnParam,
    canEditBoardContent
  ),
  requireBoardContentEditorByCard: authorize(
    resolveCardParam,
    canEditBoardContent
  ),
  requireBoardAccessByCard: authorize(resolveCardParam, canAccessBoard),
  requireBoardContentEditorForCardMove: authorize(
    resolveCardMove,
    canEditBoardContent
  ),
  requireBoardManagerByBody: authorize(resolveBodyBoard, canManageBoard),
  requireBoardOwnerByParam: authorize(resolveBoardParam, isBoardOwner),
  requireBoardUpdatePermission: authorize(
    resolveBoardParam,
    (board, userId, req) => {
      const fields = Object.keys(req.body)
      const isContentOnlyUpdate =
        fields.length === 1 && fields[0] === 'columnOrderIds'
      return isContentOnlyUpdate
        ? canEditBoardContent(board, userId)
        : canManageBoard(board, userId)
    }
  )
}
