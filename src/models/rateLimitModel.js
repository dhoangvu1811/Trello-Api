import { GET_DB } from '~/config/mongodb'

const RATE_LIMIT_COLLECTION_NAME = 'rateLimits'

const consume = async (key, windowMs, now = Date.now()) => {
  const windowStart = now - (now % windowMs)
  const expiresAt = new Date(windowStart + windowMs * 2)
  const bucketId = `${key}:${windowStart}`

  return await GET_DB()
    .collection(RATE_LIMIT_COLLECTION_NAME)
    .findOneAndUpdate(
      { _id: bucketId },
      {
        $inc: { count: 1 },
        $setOnInsert: { windowStart, expiresAt }
      },
      { upsert: true, returnDocument: 'after' }
    )
}

export const rateLimitModel = {
  RATE_LIMIT_COLLECTION_NAME,
  consume
}
