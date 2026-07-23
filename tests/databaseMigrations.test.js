const test = require('node:test')
const assert = require('node:assert/strict')
const { ObjectId } = require('mongodb')
const {
  ENSURE_CARD_PHASE_ONE_DATA,
  normalizeLegacyCardComments
} = require('../build/src/config/databaseMigrations')

test('adds phase one metadata to legacy comments without changing content', () => {
  const ids = [
    new ObjectId().toString(),
    new ObjectId().toString()
  ]
  let nextId = 0
  const result = normalizeLegacyCardComments(
    [
      {
        userId: new ObjectId().toString(),
        content: 'Legacy comment',
        commentedAt: 1_700_000_000_000
      },
      {
        _id: 'existing-id',
        content: 'Current comment',
        editedAt: 1_700_000_000_001,
        reactions: [{ emoji: '👍', userIds: [] }]
      }
    ],
    () => ids[nextId++]
  )

  assert.equal(result[0]._id, ids[0])
  assert.equal(result[0].content, 'Legacy comment')
  assert.equal(result[0].editedAt, null)
  assert.deepEqual(result[0].reactions, [])
  assert.equal(result[1]._id, 'existing-id')
  assert.equal(result[1].editedAt, 1_700_000_000_001)
  assert.deepEqual(result[1].reactions, [{ emoji: '👍', userIds: [] }])
  assert.equal(nextId, 1)
})

test('migrates only cards returned by the legacy comment query', async () => {
  const cardId = new ObjectId()
  const bulkWrites = []
  const cardsCollection = {
    find: (query, options) => {
      assert.deepEqual(query, {
        comments: { $elemMatch: { _id: { $exists: false } } }
      })
      assert.deepEqual(options, { projection: { comments: 1 } })
      return {
        async *[Symbol.asyncIterator]() {
          yield {
            _id: cardId,
            comments: [{ content: 'Legacy comment' }]
          }
        }
      }
    },
    bulkWrite: async (operations, options) => {
      bulkWrites.push({ operations, options })
    }
  }
  await ENSURE_CARD_PHASE_ONE_DATA({
    collection: (name) => {
      assert.equal(name, 'cards')
      return cardsCollection
    }
  })

  assert.equal(bulkWrites.length, 1)
  assert.equal(
    bulkWrites[0].operations[0].updateOne.filter._id,
    cardId
  )
  const migratedComment =
    bulkWrites[0].operations[0].updateOne.update.$set.comments[0]
  assert.equal(ObjectId.isValid(migratedComment._id), true)
  assert.equal(migratedComment.editedAt, null)
  assert.deepEqual(migratedComment.reactions, [])
  assert.deepEqual(bulkWrites[0].options, { ordered: false })
})
