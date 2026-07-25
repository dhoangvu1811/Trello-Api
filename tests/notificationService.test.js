const test = require('node:test')
const assert = require('node:assert/strict')
const {
  getDueNotificationType
} = require('../build/src/services/notificationService')

test('classifies numeric and Date deadlines consistently', () => {
  const now = 1_800_000_000_000

  assert.equal(getDueNotificationType(now - 1, now), 'CARD_OVERDUE')
  assert.equal(
    getDueNotificationType(new Date(now - 1), now),
    'CARD_OVERDUE'
  )
  assert.equal(getDueNotificationType(now + 1, now), 'CARD_DUE_SOON')
  assert.equal(
    getDueNotificationType(new Date(now + 1), now),
    'CARD_DUE_SOON'
  )
})
