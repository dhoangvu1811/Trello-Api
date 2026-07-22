const test = require('node:test')
const assert = require('node:assert/strict')
const {
  activityModel
} = require('../build/src/models/activityModel')
const {
  ACTIVITY_ACTIONS,
  ACTIVITY_ENTITY_TYPES
} = require('../build/src/utils/constants')

const validActivity = {
  boardId: '507f1f77bcf86cd799439011',
  actorId: '507f1f77bcf86cd799439012',
  action: ACTIVITY_ACTIONS.CARD_MOVED,
  entityType: ACTIVITY_ENTITY_TYPES.CARD,
  entityId: '507f1f77bcf86cd799439013',
  metadata: { fromColumnId: 'previous', toColumnId: 'next' }
}

test('accepts a valid activity record', () => {
  const { error, value } =
    activityModel.ACTIVITY_COLLECTION_SCHEMA.validate(validActivity)

  assert.equal(error, undefined)
  assert.deepEqual(value.metadata, validActivity.metadata)
  assert.equal(typeof value.createdAt, 'number')
})

test('rejects unknown activity actions and malformed ids', () => {
  const { error } = activityModel.ACTIVITY_COLLECTION_SCHEMA.validate(
    {
      ...validActivity,
      boardId: 'invalid-id',
      action: 'UNKNOWN_ACTION'
    },
    { abortEarly: false }
  )

  assert.ok(error)
  assert.deepEqual(
    error.details.map((detail) => detail.path[0]),
    ['boardId', 'action']
  )
})
