const test = require('node:test')
const assert = require('node:assert/strict')
const { ObjectId } = require('mongodb')
const {
  CARD_UPDATE_SCHEMA
} = require('../build/src/validations/cardValidation')

test('accepts every supported phase one card detail', async () => {
  const value = await CARD_UPDATE_SCHEMA.validateAsync({
    priority: 'HIGH',
    startDate: Date.now(),
    dueDate: Date.now() + 60_000,
    completedAt: null,
    labels: [{ name: 'Release', color: '#0C66E4' }],
    checklist: [{ title: 'Test release', isCompleted: false }],
    watcherIds: [new ObjectId().toString()]
  })

  assert.equal(value.priority, 'HIGH')
  assert.equal(value.labels.length, 1)
  assert.equal(value.checklist.length, 1)
})

test('rejects duplicate persisted label and checklist ids', async () => {
  const labelId = new ObjectId().toString()
  const checklistId = new ObjectId().toString()

  await assert.rejects(
    CARD_UPDATE_SCHEMA.validateAsync({
      labels: [
        { _id: labelId, name: 'One', color: '#0C66E4' },
        { _id: labelId, name: 'Two', color: '#FF0000' }
      ]
    }),
    /duplicate value/
  )
  await assert.rejects(
    CARD_UPDATE_SCHEMA.validateAsync({
      checklist: [
        { _id: checklistId, title: 'One', isCompleted: false },
        { _id: checklistId, title: 'Two', isCompleted: true }
      ]
    }),
    /duplicate value/
  )
})

test('enforces phase one limits and field formats', async () => {
  await assert.rejects(
    CARD_UPDATE_SCHEMA.validateAsync({
      labels: [{ name: 'Invalid color', color: 'blue' }]
    }),
    /color/
  )
  await assert.rejects(
    CARD_UPDATE_SCHEMA.validateAsync({
      checklist: Array.from({ length: 101 }, (_, index) => ({
        title: `Item ${index}`,
        isCompleted: false
      }))
    }),
    /less than or equal to 100/
  )
  await assert.rejects(
    CARD_UPDATE_SCHEMA.validateAsync({ priority: 'CRITICAL' }),
    /priority/
  )
})
