const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const bcrypt = require('bcryptjs')
const { ObjectId } = require('mongodb')
const { io: createSocketClient } = require('socket.io-client')

const mongoUri = process.env.MONGODB_TEST_URI
if (process.env.REQUIRE_PHASE0_INTEGRATION === '1' && !mongoUri) {
  throw new Error('MONGODB_TEST_URI is required for the integration quality gate.')
}
const databaseName =
  process.env.MONGODB_TEST_DATABASE ||
  `trello_phase0_test_${crypto.randomUUID().replaceAll('-', '')}`
const skipReason = mongoUri
  ? false
  : 'Set MONGODB_TEST_URI to a disposable MongoDB replica set.'

process.env.MONGODB_URI = mongoUri || 'mongodb://127.0.0.1:27017'
process.env.DATABASE_NAME = databaseName
process.env.BUILD_MODE = 'test'
process.env.HOST = '127.0.0.1'
process.env.PORT = '8017'
process.env.WEBSITE_DOMAIN = 'http://127.0.0.1:5173'
process.env.WHITELIST_DOMAINS = 'http://127.0.0.1:5173'
process.env.ACCESS_TOKEN_SECRET_SIGNATURE = 'phase0-access-secret'
process.env.ACCESS_TOKEN_LIFE = '1h'
process.env.REFRESH_TOKEN_SECRET_SIGNATURE = 'phase0-refresh-secret'
process.env.REFRESH_TOKEN_LIFE = '14 days'

const { AUTH_COOKIE_NAMES } = require('../build/src/config/authCookie')

const collections = [
  'activities',
  'authSessions',
  'boards',
  'cards',
  'columns',
  'invitations',
  'notifications',
  'rateLimits',
  'users'
]

let api
let database
let server
let io
let baseUrl
let modules

const request = async (path, { token, cookies, method = 'GET', body } = {}) => {
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  const response = await fetch(`${baseUrl}/V1${path}`, {
    method,
    headers: {
      ...(cookies || token
        ? { Cookie: cookies || `${AUTH_COOKIE_NAMES.access}=${token}` }
        : {}),
      ...(body && !isFormData ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined
  })
  const text = await response.text()
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
    headers: response.headers
  }
}

const createToken = async (user) => {
  const sessionId = crypto.randomUUID()
  await database.collection('authSessions').insertOne({
    _id: sessionId,
    userId: user._id,
    refreshTokenHash: crypto.randomBytes(32).toString('hex'),
    previousRefreshTokenHash: null,
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    revokedAt: null,
    createdAt: Date.now(),
    updatedAt: null
  })
  return modules.JwtProvider.generateToken(
    { _id: user._id.toString(), email: user.email, sessionId },
    process.env.ACCESS_TOKEN_SECRET_SIGNATURE,
    process.env.ACCESS_TOKEN_LIFE
  )
}

const resetFixture = async () => {
  await Promise.all(collections.map((name) => database.collection(name).deleteMany({})))

  const ids = {
    owner: new ObjectId(),
    admin: new ObjectId(),
    member: new ObjectId(),
    viewer: new ObjectId(),
    outsider: new ObjectId(),
    rejectee: new ObjectId()
  }
  const password = 'ValidPassword1!'
  const passwordHash = bcrypt.hashSync(password, 8)
  const users = Object.entries(ids).map(([name, _id]) => ({
    _id,
    email: `${name}@phase0.test`,
    password: passwordHash,
    userName: name,
    displayName: name,
    avatar: null,
    role: 'client',
    isActive: true,
    verifyToken: null,
    createdAt: Date.now(),
    updatedAt: null,
    _destroy: false
  }))
  await database.collection('users').insertMany(users)

  const byName = Object.fromEntries(
    await Promise.all(
      users.map(async (user) => [
        user.userName,
        { ...user, token: await createToken(user) }
      ])
    )
  )
  const createdBoard = await request('/boards', {
    token: byName.owner.token,
    method: 'POST',
    body: {
      title: 'Phase Zero Board',
      description: 'Board used by the Phase Zero integration suite',
      type: 'private'
    }
  })
  assert.equal(createdBoard.status, 201)
  const boardId = createdBoard.body._id

  await database.collection('boards').updateOne(
    { _id: new ObjectId(boardId) },
    {
      $set: {
        memberIds: [ids.admin, ids.member, ids.viewer],
        memberRoles: [
          { userId: ids.admin, role: 'ADMIN' },
          { userId: ids.member, role: 'MEMBER' },
          { userId: ids.viewer, role: 'VIEWER' }
        ]
      }
    }
  )

  return { users: byName, ids, boardId, password }
}

const createColumn = async (fixture, title = 'Backlog') => {
  const response = await request('/columns', {
    token: fixture.users.member.token,
    method: 'POST',
    body: { boardId: fixture.boardId, title }
  })
  assert.equal(response.status, 201)
  return response.body
}

test.before(async () => {
  if (skipReason) return

  const mongodb = require('../build/src/config/mongodb')
  const { CREATE_HTTP_SERVER } = require('../build/src/server_core')
  const { JwtProvider } = require('../build/src/providers/JwtProvider')
  const { boardService } = require('../build/src/services/boardService')
  const { cardModel } = require('../build/src/models/cardModel')
  const {
    CloudinaryProvider
  } = require('../build/src/providers/CloudinaryProvider')
  modules = { JwtProvider, boardService, cardModel, CloudinaryProvider }

  await mongodb.CONNECT_DB()
  database = mongodb.GET_DB()
  const created = CREATE_HTTP_SERVER()
  server = created.server
  io = created.io
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  baseUrl = `http://127.0.0.1:${server.address().port}`
  api = mongodb
})

test.after(async () => {
  if (skipReason) return
  if (!database) return
  if (!databaseName.startsWith('trello_phase0_test_')) {
    throw new Error('Refusing to clean a database outside the Phase Zero test namespace.')
  }
  try {
    await Promise.all(
      collections.map((name) => database.collection(name).deleteMany({}))
    )
  } finally {
    if (io) await new Promise((resolve) => io.close(resolve))
    if (api) await api.CLOSE_DB()
  }
})

test('enforces the complete board role hierarchy over HTTP', { skip: skipReason }, async () => {
  const fixture = await resetFixture()
  const viewerCreate = await request('/columns', {
    token: fixture.users.viewer.token,
    method: 'POST',
    body: { boardId: fixture.boardId, title: 'Viewer column' }
  })
  assert.equal(viewerCreate.status, 403)

  const outsiderCreate = await request('/columns', {
    token: fixture.users.outsider.token,
    method: 'POST',
    body: { boardId: fixture.boardId, title: 'Outsider column' }
  })
  assert.equal(outsiderCreate.status, 403)

  const column = await createColumn(fixture)
  const card = await request('/cards', {
    token: fixture.users.member.token,
    method: 'POST',
    body: {
      boardId: fixture.boardId,
      columnId: column._id,
      title: 'Protected card'
    }
  })
  assert.equal(card.status, 201)

  const viewerEdit = await request(`/cards/${card.body._id}`, {
    token: fixture.users.viewer.token,
    method: 'PUT',
    body: { title: 'Forbidden edit' }
  })
  assert.equal(viewerEdit.status, 403)

  const adminBoardEdit = await request(`/boards/${fixture.boardId}`, {
    token: fixture.users.admin.token,
    method: 'PUT',
    body: { title: 'Admin managed board' }
  })
  assert.equal(adminBoardEdit.status, 200)

  const memberBoardEdit = await request(`/boards/${fixture.boardId}`, {
    token: fixture.users.member.token,
    method: 'PUT',
    body: { title: 'Member managed board' }
  })
  assert.equal(memberBoardEdit.status, 403)

  const adminRoleEdit = await request(
    `/boards/${fixture.boardId}/members/${fixture.ids.viewer}/role`,
    {
      token: fixture.users.admin.token,
      method: 'PUT',
      body: { role: 'MEMBER' }
    }
  )
  assert.equal(adminRoleEdit.status, 403)

  const ownerRoleEdit = await request(
    `/boards/${fixture.boardId}/members/${fixture.ids.viewer}/role`,
    {
      token: fixture.users.owner.token,
      method: 'PUT',
      body: { role: 'MEMBER' }
    }
  )
  assert.equal(ownerRoleEdit.status, 200)

  const outsiderActivities = await request(
    `/boards/${fixture.boardId}/activities`,
    { token: fixture.users.outsider.token }
  )
  assert.equal(outsiderActivities.status, 403)
})

test('supports the complete card lifecycle and notifications', { skip: skipReason }, async () => {
  const fixture = await resetFixture()
  const backlog = await createColumn(fixture, 'Backlog')
  const done = await createColumn(fixture, 'Done')
  const created = await request('/cards', {
    token: fixture.users.member.token,
    method: 'POST',
    body: {
      boardId: fixture.boardId,
      columnId: backlog._id,
      title: 'Phase One Card'
    }
  })
  assert.equal(created.status, 201)
  const cardId = created.body._id

  const updated = await request(`/cards/${cardId}`, {
    token: fixture.users.member.token,
    method: 'PUT',
    body: {
      priority: 'URGENT',
      startDate: Date.now(),
      dueDate: Date.now() + 60 * 60 * 1000,
      labels: [{ name: 'Release', color: '#0C66E4' }],
      checklist: [{ title: 'Verify release', isCompleted: true }],
      watcherIds: [fixture.ids.admin.toString()]
    }
  })
  assert.equal(updated.status, 200)
  assert.equal(updated.body.priority, 'URGENT')
  assert.equal(updated.body.checklist[0].isCompleted, true)
  assert.equal(ObjectId.isValid(updated.body.labels[0]._id), true)

  const assigned = await request(`/cards/${cardId}`, {
    token: fixture.users.member.token,
    method: 'PUT',
    body: {
      incommingMemberInfo: {
        userId: fixture.ids.admin.toString(),
        action: 'ADD'
      }
    }
  })
  assert.equal(assigned.status, 200)

  const comment = await request(`/cards/${cardId}`, {
    token: fixture.users.member.token,
    method: 'PUT',
    body: { commentToAdd: { content: 'Please review @admin@phase0.test' } }
  })
  assert.equal(comment.status, 200)
  assert.equal(ObjectId.isValid(comment.body.comments[0]._id), true)

  const moved = await request(`/cards/${cardId}/move`, {
    token: fixture.users.member.token,
    method: 'PUT',
    body: { targetColumnId: done._id }
  })
  assert.equal(moved.status, 200)
  assert.equal(moved.body.columnId, done._id)

  const copied = await request(`/cards/${cardId}/copy`, {
    token: fixture.users.member.token,
    method: 'POST',
    body: { targetColumnId: backlog._id }
  })
  assert.equal(copied.status, 201)
  assert.equal(copied.body.columnId, backlog._id)

  const archived = await request(`/cards/${cardId}/archive`, {
    token: fixture.users.member.token,
    method: 'PUT',
    body: { archived: true }
  })
  assert.equal(archived.status, 200)
  assert.equal(typeof archived.body.archivedAt, 'number')

  const archive = await request(`/cards/archived/board/${fixture.boardId}`, {
    token: fixture.users.member.token
  })
  assert.equal(archive.status, 200)
  assert.equal(archive.body.some((card) => card._id === cardId), true)

  const restored = await request(`/cards/${cardId}/archive`, {
    token: fixture.users.member.token,
    method: 'PUT',
    body: { archived: false }
  })
  assert.equal(restored.status, 200)
  assert.equal(restored.body.archivedAt, null)

  const notifications = await request('/notifications', {
    token: fixture.users.admin.token
  })
  assert.equal(notifications.status, 200)
  assert.equal(
    notifications.body.some((item) => item.type === 'CARD_ASSIGNED'),
    true
  )
  assert.equal(
    notifications.body.some((item) => item.type === 'CARD_MENTIONED'),
    true
  )
  assert.equal(
    notifications.body.some((item) => item.type === 'CARD_MOVED'),
    true
  )
})

test('validates phase one card invariants and attachment lifecycle', {
  skip: skipReason
}, async () => {
  const fixture = await resetFixture()
  const backlog = await createColumn(fixture, 'Phase One Backlog')
  const done = await createColumn(fixture, 'Phase One Done')
  const created = await request('/cards', {
    token: fixture.users.member.token,
    method: 'POST',
    body: {
      boardId: fixture.boardId,
      columnId: backlog._id,
      title: 'Phase One Invariants'
    }
  })
  assert.equal(created.status, 201)
  const cardId = created.body._id

  const invalidDates = await request(`/cards/${cardId}`, {
    token: fixture.users.member.token,
    method: 'PUT',
    body: { startDate: Date.now() + 60_000, dueDate: Date.now() }
  })
  assert.equal(invalidDates.status, 422)

  const invalidWatcher = await request(`/cards/${cardId}`, {
    token: fixture.users.member.token,
    method: 'PUT',
    body: { watcherIds: [fixture.ids.outsider.toString()] }
  })
  assert.equal(invalidWatcher.status, 422)

  const watched = await request(`/cards/${cardId}`, {
    token: fixture.users.member.token,
    method: 'PUT',
    body: { watcherIds: [fixture.ids.admin.toString()] }
  })
  assert.equal(watched.status, 200)

  const completedChecklist = await request(`/cards/${cardId}`, {
    token: fixture.users.member.token,
    method: 'PUT',
    body: {
      checklist: [{ title: 'Preserve completion author', isCompleted: true }]
    }
  })
  assert.equal(completedChecklist.status, 200)
  const checklistItem = completedChecklist.body.checklist[0]
  assert.equal(checklistItem.completedBy, fixture.ids.member.toString())

  const renamedChecklist = await request(`/cards/${cardId}`, {
    token: fixture.users.admin.token,
    method: 'PUT',
    body: {
      checklist: [{
        ...checklistItem,
        title: 'Renamed by another user',
        completedBy: fixture.ids.admin.toString(),
        completedAt: Date.now()
      }]
    }
  })
  assert.equal(renamedChecklist.status, 200)
  assert.equal(
    renamedChecklist.body.checklist[0].completedBy,
    fixture.ids.member.toString()
  )
  assert.equal(
    new Date(renamedChecklist.body.checklist[0].completedAt).getTime(),
    new Date(checklistItem.completedAt).getTime()
  )
  const checklistNotifications = await request('/notifications', {
    token: fixture.users.admin.token
  })
  assert.equal(
    checklistNotifications.body.some(
      (item) => item.type === 'CARD_CHECKLIST_COMPLETED'
    ),
    true
  )

  const commentAdded = await request(`/cards/${cardId}`, {
    token: fixture.users.member.token,
    method: 'PUT',
    body: { commentToAdd: { content: 'Original comment' } }
  })
  const commentId = commentAdded.body.comments[0]._id
  const foreignEdit = await request(`/cards/${cardId}`, {
    token: fixture.users.admin.token,
    method: 'PUT',
    body: {
      commentToUpdate: { commentId, content: 'Unauthorized edit' }
    }
  })
  assert.equal(foreignEdit.status, 403)

  const reaction = await request(`/cards/${cardId}`, {
    token: fixture.users.admin.token,
    method: 'PUT',
    body: { commentReaction: { commentId, emoji: '👍' } }
  })
  assert.equal(reaction.status, 200)
  assert.deepEqual(
    reaction.body.comments[0].reactions[0].userIds,
    [fixture.ids.admin.toString()]
  )

  const edited = await request(`/cards/${cardId}`, {
    token: fixture.users.member.token,
    method: 'PUT',
    body: { commentToUpdate: { commentId, content: 'Edited comment' } }
  })
  assert.equal(edited.status, 200)
  assert.equal(edited.body.comments[0].content, 'Edited comment')
  assert.equal(typeof edited.body.comments[0].editedAt, 'number')

  const originalUpload = modules.CloudinaryProvider.streamUpload
  const originalDestroy = modules.CloudinaryProvider.destroy
  const destroyed = []
  modules.CloudinaryProvider.streamUpload = async () => ({
    secure_url: 'https://res.cloudinary.com/test/raw/upload/test.txt',
    public_id: 'card-attachments/test',
    resource_type: 'raw'
  })
  modules.CloudinaryProvider.destroy = async (...args) => {
    destroyed.push(args)
    return { result: 'ok' }
  }
  try {
    const form = new FormData()
    form.append(
      'attachment',
      new Blob(['phase one attachment'], { type: 'text/plain' }),
      'phase-one.txt'
    )
    const uploaded = await request(`/cards/${cardId}/attachments`, {
      token: fixture.users.member.token,
      method: 'POST',
      body: form
    })
    assert.equal(uploaded.status, 201)
    const attachment = uploaded.body.attachments[0]
    assert.equal(attachment.name, 'phase-one.txt')
    assert.equal(attachment.mimeType, 'text/plain')
    assert.equal(attachment.uploadedBy, fixture.ids.member.toString())

    const removed = await request(
      `/cards/${cardId}/attachments/${attachment._id}`,
      {
        token: fixture.users.member.token,
        method: 'DELETE'
      }
    )
    assert.equal(removed.status, 200)
    assert.deepEqual(removed.body.attachments, [])
    assert.deepEqual(destroyed, [['card-attachments/test', 'raw']])
  } finally {
    modules.CloudinaryProvider.streamUpload = originalUpload
    modules.CloudinaryProvider.destroy = originalDestroy
  }

  const copied = await request(`/cards/${cardId}/copy`, {
    token: fixture.users.member.token,
    method: 'POST',
    body: { targetColumnId: done._id }
  })
  assert.equal(copied.status, 201)
  assert.equal(copied.body.completedAt, null)
  assert.deepEqual(copied.body.attachments, [])
  assert.deepEqual(copied.body.comments, [])
  assert.equal(copied.body.checklist[0].isCompleted, false)
  assert.equal(copied.body.checklist[0].completedBy, null)

  const deleted = await request(`/cards/${cardId}`, {
    token: fixture.users.member.token,
    method: 'PUT',
    body: { commentToDelete: { commentId } }
  })
  assert.equal(deleted.status, 200)
  assert.deepEqual(deleted.body.comments, [])
})

test('covers phase one due notifications, archive ordering, and board boundaries', {
  skip: skipReason
}, async () => {
  const fixture = await resetFixture()
  const backlog = await createColumn(fixture, 'Boundary Backlog')
  const cardResponse = await request('/cards', {
    token: fixture.users.member.token,
    method: 'POST',
    body: {
      boardId: fixture.boardId,
      columnId: backlog._id,
      title: 'Boundary Card'
    }
  })
  const cardId = cardResponse.body._id
  const dueDate = Date.now() + 60 * 60 * 1000
  const watched = await request(`/cards/${cardId}`, {
    token: fixture.users.member.token,
    method: 'PUT',
    body: {
      dueDate,
      watcherIds: [fixture.ids.admin.toString()]
    }
  })
  assert.equal(watched.status, 200)

  const dueSoon = await request('/notifications', {
    token: fixture.users.admin.token
  })
  assert.equal(
    dueSoon.body.some((item) =>
      item.cardId === cardId && item.type === 'CARD_DUE_SOON'
    ),
    true
  )
  const dueSoonNotification = dueSoon.body.find(
    (item) => item.cardId === cardId && item.type === 'CARD_DUE_SOON'
  )
  const cannotReadAnotherUsersNotification = await request(
    `/notifications/${dueSoonNotification._id}/read`,
    { token: fixture.users.member.token, method: 'PUT' }
  )
  assert.equal(cannotReadAnotherUsersNotification.status, 404)
  const markedRead = await request(
    `/notifications/${dueSoonNotification._id}/read`,
    { token: fixture.users.admin.token, method: 'PUT' }
  )
  assert.equal(markedRead.status, 200)
  assert.equal(typeof markedRead.body.readAt, 'number')

  await database.collection('cards').updateOne(
    { _id: new ObjectId(cardId) },
    { $set: { dueDate: new Date(Date.now() - 60_000) } }
  )
  const overdue = await request('/notifications', {
    token: fixture.users.admin.token
  })
  assert.equal(
    overdue.body.some((item) =>
      item.cardId === cardId && item.type === 'CARD_OVERDUE'
    ),
    true
  )

  const archived = await request(`/cards/${cardId}/archive`, {
    token: fixture.users.member.token,
    method: 'PUT',
    body: { archived: true }
  })
  assert.equal(archived.status, 200)
  const archivedColumn = await database.collection('columns').findOne({
    _id: new ObjectId(backlog._id)
  })
  assert.equal(archivedColumn.cardOrderIds.map(String).includes(cardId), false)

  const restored = await request(`/cards/${cardId}/archive`, {
    token: fixture.users.member.token,
    method: 'PUT',
    body: { archived: false }
  })
  assert.equal(restored.status, 200)
  const restoredColumn = await database.collection('columns').findOne({
    _id: new ObjectId(backlog._id)
  })
  assert.equal(restoredColumn.cardOrderIds.map(String).includes(cardId), true)

  const secondBoard = await request('/boards', {
    token: fixture.users.owner.token,
    method: 'POST',
    body: {
      title: 'Second Board',
      description: 'Cross-board target',
      type: 'private'
    }
  })
  const secondColumn = await request('/columns', {
    token: fixture.users.owner.token,
    method: 'POST',
    body: { boardId: secondBoard.body._id, title: 'Foreign column' }
  })
  const crossBoardMove = await request(`/cards/${cardId}/move`, {
    token: fixture.users.owner.token,
    method: 'PUT',
    body: { targetColumnId: secondColumn.body._id }
  })
  assert.equal(crossBoardMove.status, 422)
  const crossBoardCopy = await request(`/cards/${cardId}/copy`, {
    token: fixture.users.owner.token,
    method: 'POST',
    body: { targetColumnId: secondColumn.body._id }
  })
  assert.equal(crossBoardCopy.status, 422)
})

test('keeps cross-column moves atomic and records precise activity', { skip: skipReason }, async () => {
  const fixture = await resetFixture()
  const previous = await createColumn(fixture, 'Previous')
  const next = await createColumn(fixture, 'Next')
  const cardResponse = await request('/cards', {
    token: fixture.users.member.token,
    method: 'POST',
    body: {
      boardId: fixture.boardId,
      columnId: previous._id,
      title: 'Atomic card'
    }
  })
  assert.equal(cardResponse.status, 201)
  const cardId = cardResponse.body._id

  const originalUpdate = modules.cardModel.update
  modules.cardModel.update = async () => {
    throw new Error('Injected card update failure')
  }
  try {
    await assert.rejects(
      modules.boardService.moveCardToDifferentColumn(
        {
          curentCardId: cardId,
          prevColumnId: previous._id,
          prevCardOderIds: [],
          nextColumnId: next._id,
          nextCardOrderIds: [cardId]
        },
        fixture.ids.member.toString()
      ),
      /Injected card update failure/
    )
  } finally {
    modules.cardModel.update = originalUpdate
  }

  const [storedPrevious, storedNext, storedCard] = await Promise.all([
    database.collection('columns').findOne({ _id: new ObjectId(previous._id) }),
    database.collection('columns').findOne({ _id: new ObjectId(next._id) }),
    database.collection('cards').findOne({ _id: new ObjectId(cardId) })
  ])
  assert.deepEqual(storedPrevious.cardOrderIds.map(String), [cardId])
  assert.deepEqual(storedNext.cardOrderIds.map(String), [])
  assert.equal(storedCard.columnId.toString(), previous._id)

  const move = await request('/boards/supports/moving_card', {
    token: fixture.users.member.token,
    method: 'PUT',
    body: {
      curentCardId: cardId,
      prevColumnId: previous._id,
      prevCardOderIds: [],
      nextColumnId: next._id,
      nextCardOrderIds: [cardId]
    }
  })
  assert.equal(move.status, 200)
  const activity = await database.collection('activities').findOne({
    boardId: new ObjectId(fixture.boardId),
    action: 'CARD_MOVED',
    entityId: new ObjectId(cardId)
  })
  assert.deepEqual(activity.metadata, {
    fromColumnId: previous._id,
    toColumnId: next._id
  })
})

test('authenticates sockets and isolates user and board rooms', {
  skip: skipReason,
  timeout: 15_000
}, async (t) => {
  const fixture = await resetFixture()
  const connect = (token) =>
    createSocketClient(baseUrl, {
      transports: ['websocket'],
      forceNew: true,
      autoConnect: false,
      extraHeaders: token
        ? { Cookie: `${AUTH_COOKIE_NAMES.access}=${token}` }
        : {}
    })
  const memberSocket = connect(fixture.users.member.token)
  const viewerSocket = connect(fixture.users.viewer.token)
  const outsiderSocket = connect(fixture.users.outsider.token)
  const unauthenticatedSocket = connect()
  t.after(() => {
    memberSocket.disconnect()
    viewerSocket.disconnect()
    outsiderSocket.disconnect()
    unauthenticatedSocket.disconnect()
  })

  const waitForConnect = (socket) =>
    new Promise((resolve, reject) => {
      socket.once('connect', resolve)
      socket.once('connect_error', reject)
      socket.connect()
    })
  await Promise.all([
    waitForConnect(memberSocket),
    waitForConnect(viewerSocket),
    waitForConnect(outsiderSocket)
  ])
  const rejected = await new Promise((resolve) => {
    unauthenticatedSocket.once('connect_error', (error) => resolve(error.message))
    unauthenticatedSocket.connect()
  })
  assert.equal(rejected, 'Unauthorized socket connection.')

  const join = (socket) =>
    new Promise((resolve) => socket.emit('FE_JOIN_BOARD', fixture.boardId, resolve))
  assert.deepEqual(await join(memberSocket), { joined: true })
  assert.deepEqual(await join(viewerSocket), { joined: true })
  assert.deepEqual(await join(outsiderSocket), { joined: false })

  const boardUpdatedEvent = new Promise((resolve) =>
    viewerSocket.once('BE_BOARD_UPDATED', resolve)
  )
  await createColumn(fixture, 'Realtime column')
  assert.deepEqual(await boardUpdatedEvent, { boardId: fixture.boardId })

  const invitationEvent = new Promise((resolve) =>
    outsiderSocket.once('BE_USER_INVITED_TO_BOARD', resolve)
  )
  const forbiddenInvitation = await request('/invitations/board', {
    token: fixture.users.member.token,
    method: 'POST',
    body: {
      boardId: fixture.boardId,
      inviteeEmail: fixture.users.outsider.email,
      role: 'VIEWER'
    }
  })
  assert.equal(forbiddenInvitation.status, 403)

  const invitation = await request('/invitations/board', {
    token: fixture.users.admin.token,
    method: 'POST',
    body: {
      boardId: fixture.boardId,
      inviteeEmail: fixture.users.outsider.email,
      role: 'VIEWER'
    }
  })
  assert.equal(invitation.status, 201)
  const delivered = await invitationEvent
  assert.equal(delivered.inviteeId, fixture.ids.outsider.toString())
  assert.equal(delivered.boardInvitation.role, 'VIEWER')

})

test('rotates and revokes browser sessions', { skip: skipReason }, async () => {
  const fixture = await resetFixture()
  const login = await request('/users/login', {
    method: 'POST',
    body: {
      email: fixture.users.owner.email,
      password: fixture.password
    }
  })
  assert.equal(login.status, 200)
  assert.equal('accessToken' in login.body, false)
  assert.equal('refreshToken' in login.body, false)
  assert.equal(login.body.user.email, fixture.users.owner.email)

  const setCookies = login.headers.getSetCookie()
  const accessCookie = setCookies.find((cookie) =>
    cookie.startsWith(`${AUTH_COOKIE_NAMES.access}=`)
  )
  const refreshCookie = setCookies.find((cookie) =>
    cookie.startsWith(`${AUTH_COOKIE_NAMES.refresh}=`)
  )
  for (const cookie of [accessCookie, refreshCookie]) {
    assert.match(cookie, /HttpOnly/i)
    assert.doesNotMatch(cookie, /;\s*Secure/i)
    assert.match(cookie, /SameSite=Lax/i)
    assert.match(cookie, /Path=\//i)
  }
  const accessToken = accessCookie.split('=', 2)[1].split(';', 1)[0]
  const firstRefreshToken = refreshCookie.split('=', 2)[1].split(';', 1)[0]

  const activeSession = await request('/users/session', { token: accessToken })
  assert.equal(activeSession.status, 200)
  assert.equal(activeSession.body.user.email, fixture.users.owner.email)

  const firstRefresh = await request('/users/refresh_token', {
    method: 'POST',
    cookies: `${AUTH_COOKIE_NAMES.refresh}=${firstRefreshToken}`
  })
  assert.equal(firstRefresh.status, 200)
  assert.equal('accessToken' in firstRefresh.body, false)
  assert.equal('refreshToken' in firstRefresh.body, false)
  const firstRotatedToken = firstRefresh.headers
    .getSetCookie()
    .find((cookie) =>
      cookie.startsWith(`${AUTH_COOKIE_NAMES.refresh}=`)
    )
    .split('=', 2)[1]
    .split(';', 1)[0]
  assert.notEqual(firstRotatedToken, firstRefreshToken)

  const concurrentRefresh = await request('/users/refresh_token', {
    method: 'POST',
    cookies: `${AUTH_COOKIE_NAMES.refresh}=${firstRefreshToken}`
  })
  assert.equal(concurrentRefresh.status, 200)
  const latestRefreshToken = concurrentRefresh.headers
    .getSetCookie()
    .find((cookie) =>
      cookie.startsWith(`${AUTH_COOKIE_NAMES.refresh}=`)
    )
    .split('=', 2)[1]
    .split(';', 1)[0]

  const replay = await request('/users/refresh_token', {
    method: 'POST',
    cookies: `${AUTH_COOKIE_NAMES.refresh}=${firstRefreshToken}`
  })
  assert.equal(replay.status, 401)

  const logout = await request('/users/logout', {
    method: 'DELETE',
    cookies: `${AUTH_COOKIE_NAMES.refresh}=${latestRefreshToken}`
  })
  assert.equal(logout.status, 200)
  const revokedAccessToken = concurrentRefresh.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith(`${AUTH_COOKIE_NAMES.access}=`))
    .split('=', 2)[1]
    .split(';', 1)[0]
  const revokedSession = await request('/users/session', {
    token: revokedAccessToken
  })
  assert.equal(revokedSession.status, 401)
})

test('records every current mutation and creates the required indexes', { skip: skipReason }, async () => {
  const fixture = await resetFixture()
  const column = await createColumn(fixture, 'Activity column')
  const updatedColumn = await request(`/columns/${column._id}`, {
    token: fixture.users.member.token,
    method: 'PUT',
    body: { title: 'Updated activity column' }
  })
  assert.equal(updatedColumn.status, 200)

  const card = await request('/cards', {
    token: fixture.users.member.token,
    method: 'POST',
    body: {
      boardId: fixture.boardId,
      columnId: column._id,
      title: 'Activity card'
    }
  })
  assert.equal(card.status, 201)
  const cardId = card.body._id

  for (const body of [
    { title: 'Updated activity card' },
    { commentToAdd: { content: 'Activity comment' } },
    {
      incommingMemberInfo: {
        userId: fixture.ids.viewer.toString(),
        action: 'ADD'
      }
    },
    {
      incommingMemberInfo: {
        userId: fixture.ids.viewer.toString(),
        action: 'REMOVE'
      }
    }
  ]) {
    const update = await request(`/cards/${cardId}`, {
      token: fixture.users.member.token,
      method: 'PUT',
      body
    })
    assert.equal(update.status, 200)
  }

  const boardUpdate = await request(`/boards/${fixture.boardId}`, {
    token: fixture.users.admin.token,
    method: 'PUT',
    body: { description: 'Updated activity board description' }
  })
  assert.equal(boardUpdate.status, 200)
  const roleUpdate = await request(
    `/boards/${fixture.boardId}/members/${fixture.ids.viewer}/role`,
    {
      token: fixture.users.owner.token,
      method: 'PUT',
      body: { role: 'ADMIN' }
    }
  )
  assert.equal(roleUpdate.status, 200)

  const invitation = await request('/invitations/board', {
    token: fixture.users.admin.token,
    method: 'POST',
    body: {
      boardId: fixture.boardId,
      inviteeEmail: fixture.users.outsider.email,
      role: 'VIEWER'
    }
  })
  assert.equal(invitation.status, 201)
  const forbiddenResolution = await request(
    `/invitations/board/${invitation.body._id}`,
    {
      token: fixture.users.member.token,
      method: 'PUT',
      body: { status: 'ACCEPTED' }
    }
  )
  assert.equal(forbiddenResolution.status, 403)
  const accepted = await request(`/invitations/board/${invitation.body._id}`, {
    token: fixture.users.outsider.token,
    method: 'PUT',
    body: { status: 'ACCEPTED' }
  })
  assert.equal(accepted.status, 200)

  const rejectedInvitation = await request('/invitations/board', {
    token: fixture.users.admin.token,
    method: 'POST',
    body: {
      boardId: fixture.boardId,
      inviteeEmail: fixture.users.rejectee.email,
      role: 'MEMBER'
    }
  })
  assert.equal(rejectedInvitation.status, 201)
  const rejected = await request(
    `/invitations/board/${rejectedInvitation.body._id}`,
    {
      token: fixture.users.rejectee.token,
      method: 'PUT',
      body: { status: 'REJECTED' }
    }
  )
  assert.equal(rejected.status, 200)

  const disposableColumn = await createColumn(fixture, 'Disposable')
  const deleted = await request(`/columns/${disposableColumn._id}`, {
    token: fixture.users.member.token,
    method: 'DELETE'
  })
  assert.equal(deleted.status, 200)

  const activityDocuments = await database
    .collection('activities')
    .find(
      { boardId: new ObjectId(fixture.boardId) },
      { projection: { action: 1 } }
    )
    .toArray()
  const actions = new Set(activityDocuments.map((activity) => activity.action))
  for (const expected of [
    'BOARD_CREATED',
    'BOARD_UPDATED',
    'BOARD_MEMBER_ROLE_CHANGED',
    'COLUMN_CREATED',
    'COLUMN_UPDATED',
    'COLUMN_DELETED',
    'CARD_CREATED',
    'CARD_UPDATED',
    'CARD_COMMENTED',
    'CARD_MEMBER_ADDED',
    'CARD_MEMBER_REMOVED',
    'INVITATION_CREATED',
    'INVITATION_ACCEPTED',
    'INVITATION_REJECTED'
  ]) {
    assert.ok(actions.has(expected), `Missing activity action ${expected}`)
  }

  const indexExpectations = {
    users: ['users_email_unique', 'users_password_reset_token_unique'],
    boards: ['boards_owner_active', 'boards_member_active'],
    cards: ['cards_board_column', 'cards_member_due_date'],
    columns: ['columns_board_active'],
    activities: ['activities_board_created_at', 'activities_entity_created_at'],
    invitations: [
      'invitations_invitee_created_at',
      'invitations_board_invitee_status'
    ],
    rateLimits: ['rate_limits_expiry'],
    authSessions: ['auth_sessions_expiry', 'auth_sessions_user_active']
  }
  for (const [collectionName, expectedNames] of Object.entries(indexExpectations)) {
    const names = new Set(
      (await database.collection(collectionName).listIndexes().toArray()).map(
        (index) => index.name
      )
    )
    for (const expectedName of expectedNames) {
      assert.ok(names.has(expectedName), `Missing index ${expectedName}`)
    }
  }
})

test('validates pagination, password reset, and persistent rate limits', { skip: skipReason }, async () => {
  const fixture = await resetFixture()
  const invalidPage = await request('/boards?page=0&itemsPerPage=101', {
    token: fixture.users.owner.token
  })
  assert.equal(invalidPage.status, 422)

  const activities = await request(
    `/boards/${fixture.boardId}/activities?page=1&itemsPerPage=1`,
    { token: fixture.users.viewer.token }
  )
  assert.equal(activities.status, 200)
  assert.equal(activities.body.activities.length, 1)
  assert.ok(activities.body.totalActivities >= 1)

  const resetToken = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex')
  await database.collection('users').updateOne(
    { _id: fixture.ids.member },
    {
      $set: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: Date.now() + 60_000
      }
    }
  )
  const reset = await request('/users/reset-password', {
    method: 'PUT',
    body: { token: resetToken, password: 'NewValidPassword1!' }
  })
  assert.equal(reset.status, 200)
  const revokedAfterPasswordReset = await request('/boards', {
    token: fixture.users.member.token
  })
  assert.equal(revokedAfterPasswordReset.status, 401)
  const reuse = await request('/users/reset-password', {
    method: 'PUT',
    body: { token: resetToken, password: 'AnotherPassword1!' }
  })
  assert.equal(reuse.status, 422)

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const unknownForgot = await request('/users/forgot-password', {
      method: 'POST',
      body: { email: 'missing@phase0.test' }
    })
    assert.equal(unknownForgot.status, attempt <= 5 ? 200 : 429)
  }

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const registration = await request('/users/register', {
      method: 'POST',
      body: { email: 'invalid', password: 'invalid', password_confirmation: 'invalid' }
    })
    assert.equal(registration.status, attempt <= 5 ? 422 : 429)
  }

  for (let attempt = 1; attempt <= 11; attempt += 1) {
    const login = await request('/users/login', {
      method: 'POST',
      body: { email: fixture.users.owner.email, password: 'WrongPassword1!' }
    })
    assert.equal(login.status, attempt <= 10 ? 406 : 429)
  }

  for (let attempt = 1; attempt <= 21; attempt += 1) {
    const invitation = await request('/invitations/board', {
      token: fixture.users.admin.token,
      method: 'POST',
      body: {
        boardId: fixture.boardId,
        inviteeEmail: 'invalid',
        role: 'MEMBER'
      }
    })
    assert.equal(invitation.status, attempt <= 20 ? 422 : 429)
  }
})
