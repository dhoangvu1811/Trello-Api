import { StatusCodes } from 'http-status-codes'
// import ApiError from '~/utils/ApiError'
import { boardService } from '~/services/boardService'
import { activityService } from '~/services/activityService'
import {
  DEFAULT_ITEMS_PER_PAGE,
  DEFAULT_PAGE
} from '~/utils/constants'
import { emitBoardUpdated } from '~/sockets/boardEvents'

const createNew = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id

    const createBoard = await boardService.createNew(userId, req.body)

    res.status(StatusCodes.CREATED).json(createBoard)
  } catch (error) {
    next(error)
  }
}

const getDetails = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id
    const boardId = req.params.id

    const board = await boardService.getDetails(userId, boardId)

    res.status(StatusCodes.OK).json(board)
  } catch (error) {
    next(error)
  }
}

const update = async (req, res, next) => {
  try {
    const boardId = req.params.id

    const updatedBoard = await boardService.update(
      boardId,
      req.body,
      req.jwtDecoded._id
    )

    emitBoardUpdated(req)
    res.status(StatusCodes.OK).json(updatedBoard)
  } catch (error) {
    next(error)
  }
}

const moveCardToDifferentColumn = async (req, res, next) => {
  try {
    const result = await boardService.moveCardToDifferentColumn(
      req.body,
      req.jwtDecoded._id
    )

    emitBoardUpdated(req)
    res.status(StatusCodes.OK).json(result)
  } catch (error) {
    next(error)
  }
}

const getBoards = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id
    const { page, itemsPerPage, q } = req.query
    const queryFilter = q

    const result = await boardService.getBoards(
      userId,
      page,
      itemsPerPage,
      queryFilter
    )

    res.status(StatusCodes.OK).json(result)
  } catch (error) {
    next(error)
  }
}

const updateMemberRole = async (req, res, next) => {
  try {
    const result = await boardService.updateMemberRole(
      req.params.id,
      req.params.userId,
      req.body.role,
      req.jwtDecoded._id
    )
    emitBoardUpdated(req)
    res.status(StatusCodes.OK).json(result)
  } catch (error) {
    next(error)
  }
}

const getActivities = async (req, res, next) => {
  try {
    const result = await activityService.getByBoardId(
      req.params.id,
      req.query.page || DEFAULT_PAGE,
      req.query.itemsPerPage || DEFAULT_ITEMS_PER_PAGE
    )
    res.status(StatusCodes.OK).json(result)
  } catch (error) {
    next(error)
  }
}

export const boardController = {
  createNew,
  getDetails,
  update,
  moveCardToDifferentColumn,
  getBoards,
  updateMemberRole,
  getActivities
}
