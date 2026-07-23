import { ObjectId } from 'mongodb'

export const normalizeLegacyCardComments = (
  comments = [],
  createId = () => new ObjectId().toString()
) => comments.map((comment) => ({
  ...comment,
  _id: comment._id || createId(),
  editedAt: comment.editedAt ?? null,
  reactions: comment.reactions || []
}))

export const ENSURE_CARD_PHASE_ONE_DATA = async (database) => {
  const cursor = database.collection('cards').find(
    { comments: { $elemMatch: { _id: { $exists: false } } } },
    { projection: { comments: 1 } }
  )
  let operations = []

  const flush = async () => {
    if (!operations.length) return
    await database.collection('cards').bulkWrite(operations, {
      ordered: false
    })
    operations = []
  }

  for await (const card of cursor) {
    operations.push({
      updateOne: {
        filter: { _id: card._id },
        update: {
          $set: {
            comments: normalizeLegacyCardComments(card.comments)
          }
        }
      }
    })
    if (operations.length === 500) await flush()
  }
  await flush()
}
