import { ObjectId } from 'mongodb'
import { GET_DB } from '~/config/mongodb'
import { notificationModel } from '~/models/notificationModel'
import { NOTIFICATION_TYPES } from '~/utils/constants'

const create = async (data, session) =>
  await notificationModel.create(data, session)

const createForUsers = async (userIds, data, session) => {
  const uniqueUserIds = [...new Set(userIds.map(String))]
  for (const userId of uniqueUserIds) {
    await create({
      ...data,
      userId,
      dedupeKey: `${data.dedupeKey}:${userId}`
    }, session)
  }
}

export const getDueNotificationType = (dueDate, now = Date.now()) =>
  new Date(dueDate).getTime() < now
    ? NOTIFICATION_TYPES.CARD_OVERDUE
    : NOTIFICATION_TYPES.CARD_DUE_SOON

const syncDueDateNotifications = async (userId) => {
  const now = Date.now()
  const dueSoon = now + 24 * 60 * 60 * 1000
  const cards = await GET_DB()
    .collection('cards')
    .find({
      $and: [
        {
          $or: [
            { memberIds: new ObjectId(userId) },
            { watcherIds: new ObjectId(userId) },
            { watcherIds: userId }
          ]
        },
        {
          $or: [
            { dueDate: { $ne: null, $lte: dueSoon } },
            { dueDate: { $ne: null, $lte: new Date(dueSoon) } }
          ]
        }
      ],
      completedAt: null,
      archivedAt: null,
      _destroy: false
    })
    .limit(500)
    .toArray()

  await Promise.all(cards.map((card) => {
    const type = getDueNotificationType(card.dueDate, now)
    const dueBucket = new Date(card.dueDate).toISOString().slice(0, 10)
    return create({
      userId,
      actorId: null,
      boardId: card.boardId.toString(),
      cardId: card._id.toString(),
      type,
      message: type === NOTIFICATION_TYPES.CARD_OVERDUE
        ? `Card “${card.title}” is overdue.`
        : `Card “${card.title}” is due within 24 hours.`,
      dedupeKey: `${type}:${card._id}:${dueBucket}:${userId}`
    })
  }))
}

const getByUserId = async (userId) => {
  await syncDueDateNotifications(userId)
  return await notificationModel.findByUserId(userId)
}

const markRead = async (notificationId, userId) =>
  await notificationModel.markRead(notificationId, userId)

const markAllRead = async (userId) =>
  await notificationModel.markAllRead(userId)

export const notificationService = {
  create,
  createForUsers,
  getByUserId,
  markRead,
  markAllRead
}
