const test = require('node:test')
const assert = require('node:assert/strict')
const {
  paginationValidation
} = require('../build/src/validations/paginationValidation')

const runMiddleware = async (middleware, query) => {
  const req = { query }
  let nextValue
  await middleware(req, {}, (value) => {
    nextValue = value
  })
  return { req, nextValue }
}

test('normalizes valid pagination values and board filters', async () => {
  const { req, nextValue } = await runMiddleware(
    paginationValidation.boards,
    { page: '2', itemsPerPage: '25', q: { title: 'Roadmap' } }
  )

  assert.equal(nextValue, undefined)
  assert.deepEqual(req.query, {
    page: 2,
    itemsPerPage: 25,
    q: { title: 'Roadmap' }
  })
})

test('rejects invalid and excessive pagination values', async () => {
  const { nextValue } = await runMiddleware(
    paginationValidation.activities,
    { page: '0', itemsPerPage: '101' }
  )

  assert.equal(nextValue.statusCode, 422)
})
