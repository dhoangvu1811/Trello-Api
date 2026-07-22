const { MongoClient, ObjectId } = require('mongodb')
const bcrypt = require('bcryptjs')

const uri = process.env.MONGODB_TEST_URI
const databaseName = process.env.MONGODB_TEST_DATABASE
if (!uri || !databaseName?.startsWith('trello_phase0_test_')) {
  throw new Error(
    'E2E seeding requires MONGODB_TEST_URI and a trello_phase0_test_ database.'
  )
}

const ids = {
  owner: new ObjectId('700000000000000000000001'),
  viewer: new ObjectId('700000000000000000000002'),
  invitee: new ObjectId('700000000000000000000003'),
  board: new ObjectId('700000000000000000000010'),
  backlog: new ObjectId('700000000000000000000020'),
  done: new ObjectId('700000000000000000000021'),
  card: new ObjectId('700000000000000000000030')
}

const collectionNames = [
  'activities',
  'authSessions',
  'boards',
  'cards',
  'columns',
  'invitations',
  'rateLimits',
  'users'
]

const run = async () => {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 })
  await client.connect()
  const database = client.db(databaseName)
  try {
    if (process.argv.includes('--cleanup')) {
      await Promise.all(
        collectionNames.map((name) => database.collection(name).deleteMany({}))
      )
      return
    }

    await Promise.all(
      collectionNames.map((name) => database.collection(name).deleteMany({}))
    )
    const password = bcrypt.hashSync('Phase0Test1!', 8)
    const now = Date.now()
    await database.collection('users').insertMany(
      [
        [ids.owner, 'owner@phase0.test', 'Phase Zero Owner'],
        [ids.viewer, 'viewer@phase0.test', 'Phase Zero Viewer'],
        [ids.invitee, 'invitee@phase0.test', 'Phase Zero Invitee']
      ].map(([_id, email, displayName]) => ({
        _id,
        email,
        password,
        userName: email.split('@')[0],
        displayName,
        avatar: null,
        role: 'client',
        isActive: true,
        verifyToken: null,
        createdAt: now,
        updatedAt: null,
        _destroy: false
      }))
    )
    await database.collection('boards').insertOne({
      _id: ids.board,
      title: 'Phase Zero E2E Board',
      slug: 'phase-zero-e2e-board',
      description: 'Real browser coverage for Phase Zero',
      type: 'private',
      columnOrderIds: [ids.backlog, ids.done],
      ownerIds: [ids.owner],
      memberIds: [ids.viewer],
      memberRoles: [{ userId: ids.viewer, role: 'VIEWER' }],
      createdAt: now,
      updatedAt: null,
      _destroy: false
    })
    await database.collection('columns').insertMany([
      {
        _id: ids.backlog,
        boardId: ids.board,
        title: 'Backlog',
        cardOrderIds: [ids.card],
        createdAt: now,
        updatedAt: null,
        _destroy: false
      },
      {
        _id: ids.done,
        boardId: ids.board,
        title: 'Done',
        cardOrderIds: [],
        createdAt: now,
        updatedAt: null,
        _destroy: false
      }
    ])
    await database.collection('cards').insertOne({
      _id: ids.card,
      boardId: ids.board,
      columnId: ids.backlog,
      title: 'Drag me safely',
      description: null,
      cover: null,
      memberIds: [],
      comments: [],
      createdAt: now,
      updatedAt: null,
      _destroy: false
    })
  } finally {
    await client.close()
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
