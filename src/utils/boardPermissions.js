import { BOARD_ROLES } from '~/utils/constants'

export const getBoardUserIds = (board) => {
  return [...board.ownerIds, ...board.memberIds].map((id) => id.toString())
}

export const isBoardOwner = (board, userId) => {
  const normalizedUserId = userId.toString()
  return board.ownerIds.some((id) => id.toString() === normalizedUserId)
}

export const isBoardMember = (board, userId) => {
  const normalizedUserId = userId.toString()
  return board.memberIds.some((id) => id.toString() === normalizedUserId)
}

export const getBoardRole = (board, userId) => {
  if (isBoardOwner(board, userId)) return BOARD_ROLES.OWNER

  if (!isBoardMember(board, userId)) return null

  const normalizedUserId = userId.toString()
  const configuredRole = board.memberRoles?.find(
    (memberRole) => memberRole.userId.toString() === normalizedUserId
  )?.role

  return configuredRole || BOARD_ROLES.MEMBER
}

export const canAccessBoard = (board, userId) => {
  return getBoardRole(board, userId) !== null
}

export const canManageBoard = (board, userId) =>
  [BOARD_ROLES.OWNER, BOARD_ROLES.ADMIN].includes(
    getBoardRole(board, userId)
  )

export const canEditBoardContent = (board, userId) =>
  [BOARD_ROLES.OWNER, BOARD_ROLES.ADMIN, BOARD_ROLES.MEMBER].includes(
    getBoardRole(board, userId)
  )
