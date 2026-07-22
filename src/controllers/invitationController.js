import { StatusCodes } from 'http-status-codes'
import { invitationService } from '~/services/invitationService'
import { BOARD_INVITATION_STATUS } from '~/utils/constants'
import { emitBoardUpdated } from '~/sockets/boardEvents'

const createNewBoardInvitation = async (req, res, next) => {
  try {
    // User thực hiện request này là người đi mời -  Inviter
    const inviterId = req.jwtDecoded._id
    const resInvitation = await invitationService.createNewBoardInvitation(
      req.body,
      inviterId
    )

    req.app
      .get('io')
      .to(`user:${resInvitation.inviteeId.toString()}`)
      .emit('BE_USER_INVITED_TO_BOARD', resInvitation)

    res.status(StatusCodes.CREATED).json(resInvitation)
  } catch (error) {
    next(error)
  }
}

const getInvitations = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id
    const resInvitations = await invitationService.getInvitations(userId)

    res.status(StatusCodes.OK).json(resInvitations)
  } catch (error) {
    next(error)
  }
}
const updateBoardInvitation = async (req, res, next) => {
  try {
    const userId = req.jwtDecoded._id
    const { invitationId } = req.params
    const { status } = req.body

    const updatedInvitations = await invitationService.updateBoardInvitation(
      userId,
      invitationId,
      status
    )

    if (status === BOARD_INVITATION_STATUS.ACCEPTED) {
      emitBoardUpdated(req, updatedInvitations.boardInvitation.boardId)
    }
    res.status(StatusCodes.OK).json(updatedInvitations)
  } catch (error) {
    next(error)
  }
}

export const invitationController = {
  createNewBoardInvitation,
  getInvitations,
  updateBoardInvitation
}
