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

test('preserves completion metadata when an existing item stays completed', () => {
  const itemId = new ObjectId().toString()
  const originalCompletedAt = 1_700_000_000_000
  const originalCompletedBy = memberId.toString()
  const result = normalizeCardDetails(
    {
      startDate: null,
      dueDate: null,
      checklist: [{
        _id: itemId,
        title: 'Already done',
        isCompleted: true,
        completedAt: originalCompletedAt,
        completedBy: originalCompletedBy
      }]
    },
    {
      checklist: [{
        _id: itemId,
        title: 'Renamed but still done',
        isCompleted: true,
        completedAt: Date.now(),
        completedBy: ownerId.toString()
      }]
    },
    userInfo,
    board
  )

  assert.equal(result.checklist[0].completedAt, originalCompletedAt)
  assert.equal(result.checklist[0].completedBy, originalCompletedBy)
})

test('records only a new completion transition and clears an uncompleted item', () => {
  const newlyCompletedId = new ObjectId().toString()
  const reopenedId = new ObjectId().toString()
  const result = normalizeCardDetails(
    {
      startDate: null,
      dueDate: null,
      checklist: [
        {
          _id: newlyCompletedId,
          title: 'Complete now',
          isCompleted: false,
          completedAt: null,
          completedBy: null
        },
        {
          _id: reopenedId,
          title: 'Reopen now',
          isCompleted: true,
          completedAt: 1_700_000_000_000,
          completedBy: memberId.toString()
        }
      ]
    },
    {
      checklist: [
        {
          _id: newlyCompletedId,
          title: 'Complete now',
          isCompleted: true
        },
        {
          _id: reopenedId,
          title: 'Reopen now',
          isCompleted: false
        }
      ]
    },
    userInfo,
    board
  )

  assert.equal(result.checklist[0].completedBy, ownerId.toString())
  assert.equal(typeof result.checklist[0].completedAt, 'number')
  assert.equal(result.checklist[1].completedBy, null)
  assert.equal(result.checklist[1].completedAt, null)
})
