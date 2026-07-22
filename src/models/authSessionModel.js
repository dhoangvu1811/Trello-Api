import { ObjectId } from 'mongodb'
import { GET_DB } from '~/config/mongodb'

const AUTH_SESSION_COLLECTION_NAME = 'authSessions'

const createNew = async (session) =>
  await GET_DB().collection(AUTH_SESSION_COLLECTION_NAME).insertOne({
    ...session,
    userId: new ObjectId(session.userId),
    expiresAt: new Date(session.expiresAt),
    previousRefreshTokenHash: null,
    revokedAt: null,
    createdAt: Date.now(),
    updatedAt: null
  })

const findActiveById = async (sessionId, now = new Date()) =>
  await GET_DB().collection(AUTH_SESSION_COLLECTION_NAME).findOne({
    _id: sessionId,
    revokedAt: null,
    expiresAt: { $gt: now }
  })

const rotateRefreshToken = async (
  sessionId,
  presentedTokenHash,
  nextTokenHash,
  now = new Date()
) =>
  await GET_DB()
    .collection(AUTH_SESSION_COLLECTION_NAME)
    .findOneAndUpdate(
      {
        _id: sessionId,
        revokedAt: null,
        expiresAt: { $gt: now },
        $or: [
          { refreshTokenHash: presentedTokenHash },
          { previousRefreshTokenHash: presentedTokenHash }
        ]
      },
      [
        {
          $set: {
            previousRefreshTokenHash: '$refreshTokenHash',
            refreshTokenHash: nextTokenHash,
            updatedAt: Date.now()
          }
        }
      ],
      { returnDocument: 'after' }
    )

const revoke = async (sessionId) =>
  await GET_DB().collection(AUTH_SESSION_COLLECTION_NAME).updateOne(
    { _id: sessionId, revokedAt: null },
    { $set: { revokedAt: Date.now(), updatedAt: Date.now() } }
  )

const revokeAllForUser = async (userId) =>
  await GET_DB().collection(AUTH_SESSION_COLLECTION_NAME).updateMany(
    { userId: new ObjectId(userId), revokedAt: null },
    { $set: { revokedAt: Date.now(), updatedAt: Date.now() } }
  )

export const authSessionModel = {
  AUTH_SESSION_COLLECTION_NAME,
  createNew,
  findActiveById,
  rotateRefreshToken,
  revoke,
  revokeAllForUser
}
