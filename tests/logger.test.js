const test = require('node:test')
const assert = require('node:assert/strict')
const { logger } = require('../build/src/utils/logger')

test('writes structured JSON log entries with context', () => {
  const originalLog = console.log
  let output
  console.log = (entry) => {
    output = entry
  }
  try {
    logger.info('Phase Zero verification', { requestId: 'request-1' })
  } finally {
    console.log = originalLog
  }

  const entry = JSON.parse(output)
  assert.equal(entry.level, 'info')
  assert.equal(entry.message, 'Phase Zero verification')
  assert.equal(entry.requestId, 'request-1')
  assert.ok(!Number.isNaN(Date.parse(entry.timestamp)))
})
