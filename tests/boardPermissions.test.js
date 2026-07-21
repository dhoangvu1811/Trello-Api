const test = require('node:test')
const assert = require('node:assert/strict')
const {
  canAccessBoard,
  canEditBoardContent,
  canManageBoard,
  getBoardRole,
  getBoardUserIds,
  isBoardMember,
  isBoardOwner
} = require('../build/src/utils/boardPermissions')
const { hasSameIds } = require('../build/src/utils/resourceOrder')
const { BOARD_ROLES } = require('../build/src/utils/constants')

const objectIdLike = (value) => ({ toString: () => value })

const board = {
  ownerIds: [objectIdLike('owner-id')],
  memberIds: [
    objectIdLike('admin-id'),
    objectIdLike('member-id'),
    objectIdLike('viewer-id'),
    objectIdLike('legacy-member-id')
  ],
  memberRoles: [
    { userId: objectIdLike('admin-id'), role: BOARD_ROLES.ADMIN },
    { userId: objectIdLike('member-id'), role: BOARD_ROLES.MEMBER },
    { userId: objectIdLike('viewer-id'), role: BOARD_ROLES.VIEWER }
  ]
}

test('normalizes board user ids', () => {
  assert.deepEqual(getBoardUserIds(board), [
    'owner-id',
    'admin-id',
    'member-id',
    'viewer-id',
    'legacy-member-id'
  ])
})

test('recognizes owners and members without granting outsiders access', () => {
  assert.equal(isBoardOwner(board, 'owner-id'), true)
  assert.equal(isBoardMember(board, 'member-id'), true)
  assert.equal(canAccessBoard(board, 'owner-id'), true)
  assert.equal(canAccessBoard(board, objectIdLike('owner-id')), true)
  assert.equal(canAccessBoard(board, 'member-id'), true)
  assert.equal(canAccessBoard(board, 'outsider-id'), false)
})

test('does not grant access from a stale member role record', () => {
  const staleBoard = {
    ...board,
    memberRoles: [
      ...board.memberRoles,
      { userId: objectIdLike('removed-id'), role: BOARD_ROLES.ADMIN }
    ]
  }

  assert.equal(getBoardRole(staleBoard, 'removed-id'), null)
  assert.equal(canAccessBoard(staleBoard, 'removed-id'), false)
})

test('enforces the board role hierarchy and defaults legacy members', () => {
  assert.equal(getBoardRole(board, 'owner-id'), BOARD_ROLES.OWNER)
  assert.equal(getBoardRole(board, 'admin-id'), BOARD_ROLES.ADMIN)
  assert.equal(getBoardRole(board, 'member-id'), BOARD_ROLES.MEMBER)
  assert.equal(getBoardRole(board, 'viewer-id'), BOARD_ROLES.VIEWER)
  assert.equal(
    getBoardRole(board, 'legacy-member-id'),
    BOARD_ROLES.MEMBER
  )
  assert.equal(canManageBoard(board, 'owner-id'), true)
  assert.equal(canManageBoard(board, 'admin-id'), true)
  assert.equal(canManageBoard(board, 'member-id'), false)
  assert.equal(canEditBoardContent(board, 'member-id'), true)
  assert.equal(canEditBoardContent(board, 'viewer-id'), false)
})

test('accepts reordered ids but rejects missing or duplicated resources', () => {
  assert.equal(hasSameIds(['a', 'b'], ['b', 'a']), true)
  assert.equal(hasSameIds(['a', 'b'], ['a']), false)
  assert.equal(hasSameIds(['a', 'b'], ['a', 'a']), false)
})
