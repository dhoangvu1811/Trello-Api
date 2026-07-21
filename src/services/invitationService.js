/* eslint-disable no-useless-catch */
import { StatusCodes } from 'http-status-codes'
import { boardModel } from '~/models/boardModel'
import { invitationModel } from '~/models/invitationModel'
import { userModel } from '~/models/userModel'
import ApiError from '~/utils/ApiError'
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ENTITY_TYPES,
  BOARD_INVITATION_STATUS,
  INVITATION_TYPES
} from '~/utils/constants'
import { pickUser } from '~/utils/formatters'
import { getBoardUserIds } from '~/utils/boardPermissions'
import { WITH_TRANSACTION } from '~/config/mongodb'
import { activityService } from '~/services/activityService'

const createNewBoardInvitation = async (reqBody, inviterId) => {
  try {
    // Người đi mời: chính là người đang request, nên chúng ta tìm theo id lấy từ token
    const inviter = await userModel.findOneById(inviterId)
    // Người được mời: lấy theo email nhận từ phía FE
    const invitee = await userModel.findOneByEmail(reqBody.inviteeEmail)
    if (!inviter || !invitee) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        'Inviter or invitee not found!'
      )
    }

    return await WITH_TRANSACTION(async (session) => {
      const board = await boardModel.findOneById(reqBody.boardId, session)
      if (!board)
        throw new ApiError(StatusCodes.NOT_FOUND, 'Board not found!')

      if (getBoardUserIds(board).includes(invitee._id.toString())) {
        throw new ApiError(
          StatusCodes.CONFLICT,
          'This user is already a member of the board.'
        )
      }

      const newInvitationData = {
        inviterId,
        inviteeId: invitee._id.toString(),
        type: INVITATION_TYPES.BOARD_INVITATION,
        boardInvitation: {
          boardId: board._id.toString(),
          status: BOARD_INVITATION_STATUS.PENDING
        }
      }
      const createdInvitation =
        await invitationModel.createNewBoardInvitation(
          newInvitationData,
          session
        )
      const invitation = await invitationModel.findOneById(
        createdInvitation.insertedId,
        session
      )
      await activityService.createNew(
        {
          boardId: board._id.toString(),
          actorId: inviterId,
          action: ACTIVITY_ACTIONS.INVITATION_CREATED,
          entityType: ACTIVITY_ENTITY_TYPES.INVITATION,
          entityId: invitation._id.toString(),
          metadata: { inviteeId: invitee._id.toString() }
        },
        session
      )

      return {
        ...invitation,
        board,
        invitee: pickUser(invitee),
        inviter: pickUser(inviter)
      }
    })
  } catch (error) {
    throw error
  }
}

const getInvitations = async (userId) => {
  try {
    const getInvitations = await invitationModel.findByUser(userId)

    // Vì các dữ liệu inviter, invitee và board ở giá trị mảng một phần tử nên chuyển về Json object
    const resInvitations = getInvitations.map((i) => {
      return {
        ...i,
        inviter: i.inviter[0] || {},
        invitee: i.invitee[0] || {},
        board: i.board[0] || {}
      }
    })

    return resInvitations
  } catch (error) {
    throw error
  }
}

const updateBoardInvitation = async (userId, invitationId, status) => {
  try {
    return await WITH_TRANSACTION(async (session) => {
      const invitation = await invitationModel.findOneById(
        invitationId,
        session
      )
      if (!invitation)
        throw new ApiError(StatusCodes.NOT_FOUND, 'Invitation not found! ')

      if (invitation.inviteeId.toString() !== userId) {
        throw new ApiError(
          StatusCodes.FORBIDDEN,
          'You cannot update another user\'s invitation.'
        )
      }
      if (
        invitation.boardInvitation.status !== BOARD_INVITATION_STATUS.PENDING
      ) {
        throw new ApiError(
          StatusCodes.CONFLICT,
          'This invitation has already been resolved.'
        )
      }

      const boardId = invitation.boardInvitation.boardId.toString()
      const board = await boardModel.findOneById(boardId, session)
      if (!board)
        throw new ApiError(StatusCodes.NOT_FOUND, 'Board not found! ')

      if (
        status === BOARD_INVITATION_STATUS.ACCEPTED &&
        getBoardUserIds(board).includes(userId)
      ) {
        throw new ApiError(
          StatusCodes.NOT_ACCEPTABLE,
          'You are already a member of this board!'
        )
      }

      const updatedInvitation = await invitationModel.update(
        invitationId,
        {
          boardInvitation: {
            ...invitation.boardInvitation,
            status
          }
        },
        session
      )
      if (status === BOARD_INVITATION_STATUS.ACCEPTED) {
        const updatedBoard = await boardModel.pushMembersIds(
          boardId,
          userId,
          session
        )
        if (!updatedBoard)
          throw new ApiError(StatusCodes.NOT_FOUND, 'Board not found!')
      }

      await activityService.createNew(
        {
          boardId,
          actorId: userId,
          action:
            status === BOARD_INVITATION_STATUS.ACCEPTED
              ? ACTIVITY_ACTIONS.INVITATION_ACCEPTED
              : ACTIVITY_ACTIONS.INVITATION_REJECTED,
          entityType: ACTIVITY_ENTITY_TYPES.INVITATION,
          entityId: invitationId
        },
        session
      )

      return updatedInvitation
    })
  } catch (error) {
    throw error
  }
}

export const invitationService = {
  createNewBoardInvitation,
  getInvitations,
  updateBoardInvitation
}
