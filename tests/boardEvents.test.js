const test = require('node:test')
const assert = require('node:assert/strict')

const { emitBoardUpdated } = require('../build/src/sockets/boardEvents')

test('broadcasts a normalized board update to the matching room', () => {
  const emissions = []
  const io = {
    to(room) {
      return {
        emit(event, payload) {
          emissions.push({ room, event, payload })
        }
      }
    }
  }
  const req = {
    app: { get: () => io },
    authorizedBoard: { _id: { toString: () => 'board-id' } }
  }

  emitBoardUpdated(req)

  assert.deepEqual(emissions, [
    {
      room: 'board:board-id',
      event: 'BE_BOARD_UPDATED',
      payload: { boardId: 'board-id' }
    }
  ])
})
