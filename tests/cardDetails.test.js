const test = require('node:test')
const assert = require('node:assert/strict')
const { ObjectId } = require('mongodb')
const {
  normalizeCardDetails
} = require('../build/src/services/cardService')

const ownerId = new ObjectId()
const memberId = new ObjectId()
const board = {
  ownerIds: [ownerId],
  memberIds: [memberId],
  memberRoles: []
}
const userInfo = { _id: ownerId.toString() }

test('normalizes labels and completed checklist metadata', () => {
  const result = normalizeCardDetails(
    { startDate: null, dueDate: null, checklist: [] },
    {
      labels: [{ name: 'Backend', color: '#0052CC' }],
      checklist: [{ title: 'Add tests', isCompleted: true }]
    },
    userInfo,
    board
  )

  assert.equal(ObjectId.isValid(result.labels[0]._id), true)
  assert.equal(ObjectId.isValid(result.checklist[0]._id), true)
  assert.equal(result.checklist[0].completedBy, ownerId.toString())
  assert.equal(typeof result.checklist[0].completedAt, 'number')
})

test('rejects an invalid date range', () => {
  assert.throws(
    () => normalizeCardDetails(
      { startDate: null, dueDate: null },
      { startDate: 2_000, dueDate: 1_000 },
      userInfo,
      board
    ),
    /Start date must not be later than due date/
  )
})

test('rejects watchers who are not board members', () => {
  assert.throws(
    () => normalizeCardDetails(
      { startDate: null, dueDate: null },
      { watcherIds: [new ObjectId().toString()] },
      userInfo,
      board
    ),
    /Only board members can watch a card/
  )
})
