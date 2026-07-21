export const BOARD_UPDATED_EVENT = 'BE_BOARD_UPDATED'

export const emitBoardUpdated = (req, boardId = req.authorizedBoard?._id) => {
  const normalizedBoardId = boardId.toString()

  req.app
    .get('io')
    .to(`board:${normalizedBoardId}`)
    .emit(BOARD_UPDATED_EVENT, { boardId: normalizedBoardId })
}
