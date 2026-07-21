import { parse } from 'cookie'
import { ObjectId } from 'mongodb'
import { env } from '~/config/environment'
import { boardModel } from '~/models/boardModel'
import { JwtProvider } from '~/providers/JwtProvider'
import { canAccessBoard } from '~/utils/boardPermissions'

export const authenticateSocket = async (socket, next) => {
  try {
    const cookies = parse(socket.request.headers.cookie || '')
    const accessToken = cookies.accessToken
    if (!accessToken) {
      next(new Error('Unauthorized socket connection.'))
      return
    }

    const user = await JwtProvider.verifyToken(
      accessToken,
      env.ACCESS_TOKEN_SECRET_SIGNATURE
    )
    socket.data.user = user
    socket.join(`user:${user._id}`)
    next()
  } catch (_error) {
    next(new Error('Unauthorized socket connection.'))
  }
}

export const registerBoardSocket = (socket) => {
  socket.on('FE_JOIN_BOARD', async (boardId) => {
    try {
      if (!ObjectId.isValid(boardId)) return

      const board = await boardModel.findOneById(boardId)
      if (!board || board._destroy) return

      if (canAccessBoard(board, socket.data.user._id)) {
        socket.join(`board:${boardId}`)
      }
    } catch (_error) {
      socket.emit('BE_SOCKET_ERROR', {
        message: 'Unable to join the requested board.'
      })
    }
  })

  socket.on('FE_LEAVE_BOARD', (boardId) => {
    if (ObjectId.isValid(boardId)) {
      socket.leave(`board:${boardId}`)
    }
  })
}
