const test = require('node:test')
const assert = require('node:assert/strict')
const {
  canAccessBoard,
  getBoardUserIds,
  isBoardMember,
  isBoardOwner
} = require('../build/src/utils/boardPermissions')
const { hasSameIds } = require('../build/src/utils/resourceOrder')

const objectIdLike = (value) => ({ toString: () => value })

const board = {
  ownerIds: [objectIdLike('owner-id')],
  memberIds: [objectIdLike('member-id')]
}

test('normalizes board user ids', () => {
  assert.deepEqual(getBoardUserIds(board), ['owner-id', 'member-id'])
})

test('recognizes owners and members without granting outsiders access', () => {
  assert.equal(isBoardOwner(board, 'owner-id'), true)
  assert.equal(isBoardMember(board, 'member-id'), true)
  assert.equal(canAccessBoard(board, 'owner-id'), true)
  assert.equal(canAccessBoard(board, objectIdLike('owner-id')), true)
  assert.equal(canAccessBoard(board, 'member-id'), true)
  assert.equal(canAccessBoard(board, 'outsider-id'), false)
})

test('accepts reordered ids but rejects missing or duplicated resources', () => {
  assert.equal(hasSameIds(['a', 'b'], ['b', 'a']), true)
  assert.equal(hasSameIds(['a', 'b'], ['a']), false)
  assert.equal(hasSameIds(['a', 'b'], ['a', 'a']), false)
})
