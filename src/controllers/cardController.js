import { StatusCodes } from 'http-status-codes'
// import ApiError from '~/utils/ApiError'
import { cardService } from '~/services/cardService'
import { emitBoardUpdated } from '~/sockets/boardEvents'

const createNew = async (req, res, next) => {
  try {
    // console.log('req.body', req.body)
    // throw new ApiError(StatusCodes.BAD_GATEWAY, 'test')

    const createCard = await cardService.createNew(
      req.body,
      req.jwtDecoded._id
    )

    emitBoardUpdated(req)
    res.status(StatusCodes.CREATED).json(createCard)
  } catch (error) {
    next(error)
  }
}
const update = async (req, res, next) => {
  try {
    const cardId = req.params.id
    const cardCoverFile = req.file
    const userInfo = req.jwtDecoded
    const updatedCard = await cardService.update(
      cardId,
      req.body,
      cardCoverFile,
      userInfo,
      req.authorizedBoard
    )

    emitBoardUpdated(req)
    res.status(StatusCodes.OK).json(updatedCard)
  } catch (error) {
    next(error)
  }
}

const setArchived = async (req, res, next) => {
  try {
    const updatedCard = await cardService.setArchived(
      req.params.id,
      req.body.archived,
      req.jwtDecoded,
      req.authorizedBoard
    )
    emitBoardUpdated(req)
    res.status(StatusCodes.OK).json(updatedCard)
  } catch (error) {
    next(error)
  }
}

const copy = async (req, res, next) => {
  try {
    const copiedCard = await cardService.copy(
      req.params.id,
      req.body,
      req.jwtDecoded,
      req.authorizedBoard
    )
    emitBoardUpdated(req)
    res.status(StatusCodes.CREATED).json(copiedCard)
  } catch (error) {
    next(error)
  }
}

const getArchivedByBoardId = async (req, res, next) => {
  try {
    const cards = await cardService.getArchivedByBoardId(req.params.id)
    res.status(StatusCodes.OK).json(cards)
  } catch (error) {
    next(error)
  }
}

const move = async (req, res, next) => {
  try {
    const card = await cardService.move(
      req.params.id,
      req.body.targetColumnId,
      req.jwtDecoded,
      req.authorizedBoard
    )
    emitBoardUpdated(req)
    res.status(StatusCodes.OK).json(card)
  } catch (error) {
    next(error)
  }
}

const addAttachment = async (req, res, next) => {
  try {
    const card = await cardService.addAttachment(
      req.params.id,
      req.file,
      req.jwtDecoded,
      req.authorizedBoard
    )
    emitBoardUpdated(req)
    res.status(StatusCodes.CREATED).json(card)
  } catch (error) {
    next(error)
  }
}

const removeAttachment = async (req, res, next) => {
  try {
    const card = await cardService.removeAttachment(
      req.params.id,
      req.params.attachmentId,
      req.jwtDecoded,
      req.authorizedBoard
    )
    emitBoardUpdated(req)
    res.status(StatusCodes.OK).json(card)
  } catch (error) {
    next(error)
  }
}

export const cardController = {
  createNew,
  update,
  setArchived,
  copy,
  getArchivedByBoardId,
  move,
  addAttachment,
  removeAttachment
}
