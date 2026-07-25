const test = require('node:test')
const assert = require('node:assert/strict')
const {
  BOARD_UPDATED_EVENT,
  CARD_NOTIFICATIONS_UPDATED_EVENT,
  emitBoardUpdated,
  emitCardNotificationsUpdated
} = require('../build/src/sockets/boardEvents')

const createRequest = () => {
  const emitted = []
  const io = {
    to: (room) => ({
      emit: (event, payload) => emitted.push({ room, event, payload })
    })
  }
  return {
    req: {
      authorizedBoard: { _id: 'board-1' },
      app: { get: () => io }
    },
    emitted
  }
}

test('emits a board refresh only to the board room', () => {
  const { req, emitted } = createRequest()
  emitBoardUpdated(req)

  assert.deepEqual(emitted, [{
    room: 'board:board-1',
    event: BOARD_UPDATED_EVENT,
    payload: { boardId: 'board-1' }
  }])
})

test('emits one notification refresh per unique user room', () => {
  const { req, emitted } = createRequest()
  emitCardNotificationsUpdated(req, ['user-1', 'user-1', 'user-2'])

  assert.deepEqual(emitted, [
    {
      room: 'user:user-1',
      event: CARD_NOTIFICATIONS_UPDATED_EVENT,
      payload: { boardId: 'board-1' }
    },
    {
      room: 'user:user-2',
      event: CARD_NOTIFICATIONS_UPDATED_EVENT,
      payload: { boardId: 'board-1' }
    }
  ])
})
