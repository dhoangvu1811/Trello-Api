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

export const canAccessBoard = (board, userId) => {
  return isBoardOwner(board, userId) || isBoardMember(board, userId)
}
