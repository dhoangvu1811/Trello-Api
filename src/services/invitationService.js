/* eslint-disable no-useless-catch */
import { StatusCodes } from 'http-status-codes'
import { boardModel } from '~/models/boardModel'
import { invitationModel } from '~/models/invitationModel'
import { userModel } from '~/models/userModel'
import ApiError from '~/utils/ApiError'
import { BOARD_INVITATION_STATUS, INVITATION_TYPES } from '~/utils/constants'
import { pickUser } from '~/utils/formatters'

const createNewBoardInvitation = async (reqBody, inviterId) => {
  try {
    // Người đi mời: chính là người đang request, nên chúng ta tìm theo id lấy từ token
    const inviter = await userModel.findOneById(inviterId)
    // Người được mời: lấy theo email nhận từ phía FE
    const invitee = await userModel.findOneByEmail(reqBody.inviteeEmail)
    // Tìm luôn cái board ra để lấy data xửu lý
    const board = await boardModel.findOneById(reqBody.boardId)

    if (!inviter || !invitee || !board) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        'Inviter,Invitee or Board not found!'
      )
    }

    // Tạo data cần thiết để lưu vào DB
    const newInvitationData = {
      inviterId,
      inviteeId: invitee._id.toString(), // chuyển từ ObjectId -> string vì sang bên model có check lại
      type: INVITATION_TYPES.BOARD_INVITATION,
      boardInvitation: {
        boardId: board._id.toString(),
        status: BOARD_INVITATION_STATUS.PENDING
      }
    }

    // Gọi sang model để lưu vào DB
    const createInvitation = await invitationModel.createNewBoardInvitation(
      newInvitationData
    )
    const getInvitation = await invitationModel.findOneById(
      createInvitation.insertedId
    )

    // Ngoài thông tin của cái board invitation mới tạo thì trả về đủ cả luôn board, inviter, invitee cho FE xử lý

    const resInvitation = {
      ...getInvitation,
      board,
      invitee: pickUser(invitee),
      inviter: pickUser(inviter)
    }

    return resInvitation
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
    const getInvitation = await invitationModel.findOneById(invitationId)
    if (!getInvitation)
      throw new ApiError(StatusCodes.NOT_FOUND, 'Invitation not found! ')

    const boardId = getInvitation.boardInvitation.boardId
    const getBoard = await boardModel.findOneById(boardId)
    if (!getBoard)
      throw new ApiError(StatusCodes.NOT_FOUND, 'Board not found! ')

    // Kiểm tra xem nếu status là ACCEPTED join board mà user (invitee) đã là owner hoặc member của board r thì trả về lỗi
    // Lưu ý hai mảng ownerIds và memberIds đang ở dạng ObjectId nên chuyển về string để kiểm tra
    const boardOwnerAndMemberIds = [
      ...getBoard.ownerIds,
      ...getBoard.memberIds
    ].toString()

    if (
      status === BOARD_INVITATION_STATUS.ACCEPTED &&
      boardOwnerAndMemberIds.includes(userId)
    ) {
      throw new ApiError(
        StatusCodes.NOT_ACCEPTABLE,
        'You are already a member of this board!'
      )
    }

    // Tạo dữ liệu để update bản ghi Invitation
    const updateData = {
      boardInvitation: {
        ...getInvitation.boardInvitation,
        status: status
      }
    }

    // B1:Cập nhật lại status trong bản ghi Invitation
    const updatedInvitation = await invitationModel.update(
      invitationId,
      updateData
    )
    // B2: Nếu trường hợp Accept một lời mời thành công, thì cần phải thêm thông tin của thằng user vào bản ghi memberIds trong collection Board
    if (
      updatedInvitation.boardInvitation.status ===
      BOARD_INVITATION_STATUS.ACCEPTED
    ) {
      await boardModel.pushMembersIds(boardId, userId)
    }

    return updatedInvitation
  } catch (error) {
    throw error
  }
}

export const invitationService = {
  createNewBoardInvitation,
  getInvitations,
  updateBoardInvitation
}
