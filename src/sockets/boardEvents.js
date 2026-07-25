export const BOARD_UPDATED_EVENT = 'BE_BOARD_UPDATED'
export const CARD_NOTIFICATIONS_UPDATED_EVENT =
  'BE_CARD_NOTIFICATIONS_UPDATED'

export const emitBoardUpdated = (req, boardId = req.authorizedBoard?._id) => {
  const normalizedBoardId = boardId.toString()

  req.app
    .get('io')
    .to(`board:${normalizedBoardId}`)
    .emit(BOARD_UPDATED_EVENT, { boardId: normalizedBoardId })
}

export const emitCardNotificationsUpdated = (
  req,
  userIds,
  boardId = req.authorizedBoard?._id
) => {
  const io = req.app.get('io')
  const payload = { boardId: boardId.toString() }
  const uniqueUserIds = [...new Set(userIds.map(String))]

  uniqueUserIds.forEach((userId) => {
    io.to(`user:${userId}`).emit(CARD_NOTIFICATIONS_UPDATED_EVENT, payload)
  })
}
