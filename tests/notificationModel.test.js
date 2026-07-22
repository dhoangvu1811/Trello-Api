const test = require('node:test')
const assert = require('node:assert/strict')
const { ObjectId } = require('mongodb')
const {
  notificationModel
} = require('../build/src/models/notificationModel')

test('accepts a card notification with a stable dedupe key', async () => {
  const value = await notificationModel.NOTIFICATION_SCHEMA.validateAsync({
    userId: new ObjectId().toString(),
    actorId: new ObjectId().toString(),
    boardId: new ObjectId().toString(),
    cardId: new ObjectId().toString(),
    type: 'CARD_ASSIGNED',
    message: 'You were assigned to a card.',
    dedupeKey: 'CARD_ASSIGNED:card:event:user'
  })

  assert.equal(value.readAt, null)
  assert.equal(typeof value.createdAt, 'number')
})

test('rejects unsupported notification types', async () => {
  await assert.rejects(
    notificationModel.NOTIFICATION_SCHEMA.validateAsync({
      userId: new ObjectId().toString(),
      boardId: new ObjectId().toString(),
      cardId: new ObjectId().toString(),
      type: 'UNKNOWN',
      message: 'Invalid',
      dedupeKey: 'invalid'
    }),
    /type/
  )
})
