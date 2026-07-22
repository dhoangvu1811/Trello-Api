import { parse } from 'cookie'
import { ObjectId } from 'mongodb'
import { env } from '~/config/environment'
import { boardModel } from '~/models/boardModel'
import { JwtProvider } from '~/providers/JwtProvider'
import { canAccessBoard } from '~/utils/boardPermissions'
import { userService } from '~/services/userService'
import { AUTH_COOKIE_NAMES } from '~/config/authCookie'

export const authenticateSocket = async (socket, next) => {
  try {
    const cookies = parse(socket.request.headers.cookie || '')
    const accessToken = cookies[AUTH_COOKIE_NAMES.access]
    if (!accessToken) {
      next(new Error('Unauthorized socket connection.'))
      return
    }

    const user = await JwtProvider.verifyToken(
      accessToken,
      env.ACCESS_TOKEN_SECRET_SIGNATURE
    )
    const authContext = await userService.validateAccessSession(user)
    if (!authContext) {
      next(new Error('Unauthorized socket connection.'))
      return
    }
    socket.data.user = user
    socket.data.sessionExpiresAt = authContext.session.expiresAt.getTime()
    socket.join(`user:${user._id}`)
    socket.join(`session:${user.sessionId}`)
    const expiryTimer = setTimeout(
      () => socket.disconnect(true),
      Math.max(0, socket.data.sessionExpiresAt - Date.now())
    )
    expiryTimer.unref?.()
    socket.once('disconnect', () => clearTimeout(expiryTimer))
    next()
  } catch (_error) {
    next(new Error('Unauthorized socket connection.'))
  }
}

export const registerBoardSocket = (socket) => {
  socket.on('FE_JOIN_BOARD', async (boardId, acknowledge = () => {}) => {
    const respond =
      typeof acknowledge === 'function' ? acknowledge : () => {}
    try {
      if (!ObjectId.isValid(boardId)) {
        respond({ joined: false })
        return
      }

      const board = await boardModel.findOneById(boardId)
      if (!board || board._destroy) {
        respond({ joined: false })
        return
      }

      if (canAccessBoard(board, socket.data.user._id)) {
        socket.join(`board:${boardId}`)
        respond({ joined: true })
        return
      }

      respond({ joined: false })
    } catch (_error) {
      socket.emit('BE_SOCKET_ERROR', {
        message: 'Unable to join the requested board.'
      })
      respond({ joined: false })
    }
  })

  socket.on('FE_LEAVE_BOARD', (boardId) => {
    if (ObjectId.isValid(boardId)) {
      socket.leave(`board:${boardId}`)
    }
  })
}
