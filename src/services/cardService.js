/* eslint-disable no-useless-catch */
import { cardModel } from '~/models/cardModel'
import { columnModel } from '~/models/columnModel'
import { CloudinaryProvider } from '~/providers/CloudinaryProvider'
import { StatusCodes } from 'http-status-codes'
import ApiError from '~/utils/ApiError'
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ENTITY_TYPES,
  CARD_MEMBER_ACTIONS,
  NOTIFICATION_TYPES
} from '~/utils/constants'
import { getBoardUserIds } from '~/utils/boardPermissions'
import { userModel } from '~/models/userModel'
import { WITH_TRANSACTION } from '~/config/mongodb'
import { activityService } from '~/services/activityService'
import { ObjectId } from 'mongodb'
import { logger } from '~/utils/logger'
import { notificationService } from '~/services/notificationService'

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key)

export const normalizeCardDetails = (currentCard, reqBody, userInfo, board) => {
  const updateData = { ...reqBody }
  const startDate = hasOwn(reqBody, 'startDate')
    ? reqBody.startDate
    : currentCard.startDate
  const dueDate = hasOwn(reqBody, 'dueDate')
    ? reqBody.dueDate
    : currentCard.dueDate

  if (startDate !== null && dueDate !== null && startDate > dueDate) {
    throw new ApiError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      'Start date must not be later than due date.'
    )
  }

  if (reqBody.watcherIds) {
    const boardUserIds = new Set(getBoardUserIds(board))
    if (reqBody.watcherIds.some((userId) => !boardUserIds.has(userId))) {
      throw new ApiError(
        StatusCodes.UNPROCESSABLE_ENTITY,
        'Only board members can watch a card.'
      )
    }
  }

  if (reqBody.labels) {
    updateData.labels = reqBody.labels.map((label) => ({
      ...label,
      _id: label._id || new ObjectId().toString()
    }))
  }

  if (reqBody.checklist) {
    const currentChecklistById = new Map(
      (currentCard.checklist || [])
        .filter((item) => item._id)
        .map((item) => [item._id, item])
    )
    updateData.checklist = reqBody.checklist.map((item) => {
      const currentItem = currentChecklistById.get(item._id)
      const remainsCompleted = item.isCompleted && currentItem?.isCompleted

      return {
        ...item,
        _id: item._id || new ObjectId().toString(),
        completedAt: item.isCompleted
          ? (remainsCompleted
            ? currentItem.completedAt ?? Date.now()
            : Date.now())
          : null,
        completedBy: item.isCompleted
          ? (remainsCompleted
            ? currentItem.completedBy ?? userInfo._id
            : userInfo._id)
          : null
      }
    })
  }

  return updateData
}

const assertSingleCardCommand = (reqBody) => {
  const commandFields = [
    'commentToAdd',
    'commentToUpdate',
    'commentToDelete',
    'commentReaction',
    'incommingMemberInfo'
  ]
  const receivedCommands = commandFields.filter((field) => hasOwn(reqBody, field))
  if (receivedCommands.length > 1 ||
      (receivedCommands.length === 1 && Object.keys(reqBody).length !== 1)) {
    throw new ApiError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      'Card commands must be submitted one at a time.'
    )
  }
}

const createNew = async (reqBody, actorId) => {
  try {
    // Xử lý logic
    const newCard = {
      ...reqBody
    }

    return await WITH_TRANSACTION(async (session) => {
      const createdCard = await cardModel.createNew(newCard, session)
      const getNewCard = await cardModel.findOneById(
        createdCard.insertedId,
        session
      )

      const updatedColumn = await columnModel.pushCardOrderIds(
        getNewCard,
        session
      )
      if (!updatedColumn)
        throw new ApiError(StatusCodes.NOT_FOUND, 'Column not found!')
      await activityService.createNew(
        {
          boardId: getNewCard.boardId.toString(),
          actorId,
          action: ACTIVITY_ACTIONS.CARD_CREATED,
          entityType: ACTIVITY_ENTITY_TYPES.CARD,
          entityId: getNewCard._id.toString()
        },
        session
      )

      return getNewCard
    })
  } catch (error) {
    throw error
  }
}
const update = async (
  cardId,
  reqBody,
  cardCoverFile,
  userInfo,
  authorizedBoard
) => {
  try {
    assertSingleCardCommand(reqBody)
    const currentCard = await cardModel.findOneById(cardId)
    if (!currentCard) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Card not found!')
    }
    const normalizedDetails = normalizeCardDetails(
      currentCard,
      reqBody,
      userInfo,
      authorizedBoard
    )
    const updateData = {
      ...normalizedDetails,
      updatedAt: Date.now()
    }

    let cardMutation
    let notification
    let activityAction = reqBody.dueDate !== undefined
      ? ACTIVITY_ACTIONS.CARD_DUE_DATE_CHANGED
      : ACTIVITY_ACTIONS.CARD_UPDATED
    let activityMetadata = { fields: Object.keys(reqBody) }

    if (cardCoverFile) {
      const uploadResult = await CloudinaryProvider.streamUpload(
        cardCoverFile.buffer,
        'card-covers'
      )
      cardMutation = (session) =>
        cardModel.update(
          cardId,
          { cover: uploadResult.secure_url, updatedAt: Date.now() },
          session
        )
      activityMetadata = { fields: ['cover'] }
    } else if (updateData.commentToAdd) {
      const commentAuthor = await userModel.findOneById(userInfo._id)
      if (!commentAuthor) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Comment author not found!')
      }

      const commentData = {
        _id: new ObjectId().toString(),
        content: updateData.commentToAdd.content,
        commentedAt: Date.now(),
        editedAt: null,
        reactions: [],
        userEmail: commentAuthor.email,
        userId: commentAuthor._id.toString(),
        userAvatar: commentAuthor.avatar,
        userDisplayName: commentAuthor.displayName
      }

      cardMutation = (session) =>
        cardModel.unShiftNewComment(cardId, commentData, session)
      activityAction = ACTIVITY_ACTIONS.CARD_COMMENTED
      activityMetadata = {}
      const mentionedEmails = [
        ...new Set(
          [...commentData.content.matchAll(
            /@([\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/g
          )].map((match) => match[1].toLowerCase())
        )
      ]
      if (mentionedEmails.length > 20) {
        throw new ApiError(
          StatusCodes.UNPROCESSABLE_ENTITY,
          'A comment cannot mention more than 20 users.'
        )
      }
      const mentionedUsers = (await Promise.all(
        mentionedEmails.map((email) => userModel.findOneByEmail(email))
      )).filter(Boolean)
      const boardUserIds = new Set(getBoardUserIds(authorizedBoard))
      const mentionedUserIds = mentionedUsers
        .map((user) => user._id.toString())
        .filter((userId) => boardUserIds.has(userId) && userId !== userInfo._id)
      if (mentionedUserIds.length) {
        notification = {
          userIds: mentionedUserIds,
          type: NOTIFICATION_TYPES.CARD_MENTIONED,
          message: `You were mentioned on card “${currentCard.title}”.`
        }
      }
    } else if (updateData.commentToUpdate) {
      const comment = currentCard.comments?.find(
        (item) => item._id === updateData.commentToUpdate.commentId
      )
      if (!comment) throw new ApiError(StatusCodes.NOT_FOUND, 'Comment not found!')
      if (comment.userId !== userInfo._id) {
        throw new ApiError(StatusCodes.FORBIDDEN, 'Only the author can edit this comment.')
      }
      cardMutation = (session) => cardModel.updateComment(
        cardId,
        comment._id,
        {
          content: updateData.commentToUpdate.content,
          editedAt: Date.now(),
          reactions: comment.reactions || []
        },
        session
      )
      activityAction = ACTIVITY_ACTIONS.CARD_COMMENT_EDITED
      activityMetadata = { commentId: comment._id }
    } else if (updateData.commentToDelete) {
      const comment = currentCard.comments?.find(
        (item) => item._id === updateData.commentToDelete.commentId
      )
      if (!comment) throw new ApiError(StatusCodes.NOT_FOUND, 'Comment not found!')
      if (comment.userId !== userInfo._id) {
        throw new ApiError(StatusCodes.FORBIDDEN, 'Only the author can delete this comment.')
      }
      cardMutation = (session) => cardModel.removeComment(cardId, comment._id, session)
      activityAction = ACTIVITY_ACTIONS.CARD_COMMENT_DELETED
      activityMetadata = { commentId: comment._id }
    } else if (updateData.commentReaction) {
      const comment = currentCard.comments?.find(
        (item) => item._id === updateData.commentReaction.commentId
      )
      if (!comment) throw new ApiError(StatusCodes.NOT_FOUND, 'Comment not found!')
      const reactions = (comment.reactions || []).map((reaction) => ({
        ...reaction,
        userIds: [...reaction.userIds]
      }))
      const reaction = reactions.find(
        (item) => item.emoji === updateData.commentReaction.emoji
      )
      if (reaction) {
        reaction.userIds = reaction.userIds.includes(userInfo._id)
          ? reaction.userIds.filter((userId) => userId !== userInfo._id)
          : [...reaction.userIds, userInfo._id]
      } else {
        reactions.push({
          emoji: updateData.commentReaction.emoji,
          userIds: [userInfo._id]
        })
      }
      cardMutation = (session) => cardModel.updateComment(
        cardId,
        comment._id,
        { ...comment, reactions: reactions.filter((item) => item.userIds.length) },
        session
      )
      activityAction = ACTIVITY_ACTIONS.CARD_COMMENT_REACTED
      activityMetadata = { commentId: comment._id }
    } else if (updateData.incommingMemberInfo) {
      const targetUserId = updateData.incommingMemberInfo.userId
      const boardUserIds = getBoardUserIds(authorizedBoard)

      if (
        updateData.incommingMemberInfo.action === CARD_MEMBER_ACTIONS.ADD &&
        !boardUserIds.includes(targetUserId)
      ) {
        throw new ApiError(
          StatusCodes.UNPROCESSABLE_ENTITY,
          'Only board members can be assigned to a card.'
        )
      }

      cardMutation = (session) =>
        cardModel.updateMembers(
          cardId,
          updateData.incommingMemberInfo,
          session
        )
      activityAction =
        updateData.incommingMemberInfo.action === CARD_MEMBER_ACTIONS.ADD
          ? ACTIVITY_ACTIONS.CARD_MEMBER_ADDED
          : ACTIVITY_ACTIONS.CARD_MEMBER_REMOVED
      activityMetadata = { targetUserId }
      if (
        updateData.incommingMemberInfo.action === CARD_MEMBER_ACTIONS.ADD &&
        targetUserId !== userInfo._id
      ) {
        notification = {
          userIds: [targetUserId],
          type: NOTIFICATION_TYPES.CARD_ASSIGNED,
          message: `You were assigned to card “${currentCard.title}”.`
        }
      }
    } else {
      cardMutation = (session) => cardModel.update(cardId, updateData, session)
      const completedChecklist = updateData.checklist?.length > 0 &&
        updateData.checklist.every((item) => item.isCompleted)
      const wasChecklistCompleted = currentCard.checklist?.length > 0 &&
        currentCard.checklist.every((item) => item.isCompleted)
      if (reqBody.completedAt && !currentCard.completedAt) {
        activityAction = ACTIVITY_ACTIONS.CARD_COMPLETED
        notification = {
          userIds: [
            ...(currentCard.memberIds || []),
            ...(currentCard.watcherIds || [])
          ].map(String).filter((userId) => userId !== userInfo._id),
          type: NOTIFICATION_TYPES.CARD_COMPLETED,
          message: `Card “${currentCard.title}” was completed.`
        }
      } else if (completedChecklist && !wasChecklistCompleted) {
        activityAction = ACTIVITY_ACTIONS.CARD_CHECKLIST_COMPLETED
        notification = {
          userIds: [
            ...(currentCard.memberIds || []),
            ...(currentCard.watcherIds || [])
          ].map(String).filter((userId) => userId !== userInfo._id),
          type: NOTIFICATION_TYPES.CARD_CHECKLIST_COMPLETED,
          message: `Checklist completed on card “${currentCard.title}”.`
        }
      }
    }

    return await WITH_TRANSACTION(async (session) => {
      const updatedCard = await cardMutation(session)
      if (!updatedCard)
        throw new ApiError(StatusCodes.NOT_FOUND, 'Card not found!')

      await activityService.createNew(
        {
          boardId: authorizedBoard._id.toString(),
          actorId: userInfo._id,
          action: activityAction,
          entityType: ACTIVITY_ENTITY_TYPES.CARD,
          entityId: cardId,
          metadata: activityMetadata
        },
        session
      )
      if (notification?.userIds.length) {
        await notificationService.createForUsers(
          notification.userIds,
          {
            actorId: userInfo._id,
            boardId: authorizedBoard._id.toString(),
            cardId,
            type: notification.type,
            message: notification.message,
            dedupeKey: `${notification.type}:${cardId}:${new ObjectId()}`
          },
          session
        )
      }
      return updatedCard
    })
  } catch (error) {
    throw error
  }
}

const setArchived = async (cardId, archived, userInfo, authorizedBoard) => {
  return await WITH_TRANSACTION(async (session) => {
    const card = await cardModel.findOneById(cardId, session)
    if (!card || card.boardId.toString() !== authorizedBoard._id.toString()) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Card not found!')
    }
    if (Boolean(card.archivedAt) === archived) return card

    const archivedAt = archived ? Date.now() : null
    const archivedBy = archived ? userInfo._id : null
    const updatedCard = await cardModel.update(
      cardId,
      { archivedAt, archivedBy, updatedAt: Date.now() },
      session
    )
    const updatedColumn = archived
      ? await columnModel.removeCardOrderId(card.columnId, cardId, session)
      : await columnModel.addCardOrderId(card.columnId, cardId, session)
    if (!updatedCard || !updatedColumn) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Card or column not found!')
    }

    await activityService.createNew(
      {
        boardId: authorizedBoard._id.toString(),
        actorId: userInfo._id,
        action: archived
          ? ACTIVITY_ACTIONS.CARD_ARCHIVED
          : ACTIVITY_ACTIONS.CARD_RESTORED,
        entityType: ACTIVITY_ENTITY_TYPES.CARD,
        entityId: cardId
      },
      session
    )
    return updatedCard
  })
}

const copy = async (cardId, reqBody, userInfo, authorizedBoard) => {
  return await WITH_TRANSACTION(async (session) => {
    const sourceCard = await cardModel.findOneById(cardId, session)
    const targetColumn = await columnModel.findOneById(
      reqBody.targetColumnId,
      session
    )
    const boardId = authorizedBoard._id.toString()
    if (!sourceCard || sourceCard.boardId.toString() !== boardId) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Source card not found!')
    }
    if (!targetColumn || targetColumn.boardId.toString() !== boardId) {
      throw new ApiError(
        StatusCodes.UNPROCESSABLE_ENTITY,
        'Target column must belong to the same board.'
      )
    }

    const copiedCardData = {
      boardId,
      columnId: targetColumn._id.toString(),
      title: reqBody.title || `${sourceCard.title} (copy)`,
      description: sourceCard.description,
      cover: sourceCard.cover,
      priority: sourceCard.priority,
      startDate: sourceCard.startDate,
      dueDate: sourceCard.dueDate,
      completedAt: null,
      labels: sourceCard.labels || [],
      checklist: (sourceCard.checklist || []).map((item) => ({
        ...item,
        _id: new ObjectId().toString(),
        isCompleted: false,
        completedAt: null,
        completedBy: null
      })),
      // Cloud resources have a single lifecycle owner; copied cards start
      // without attachments so deleting one card cannot break another.
      attachments: [],
      memberIds: (sourceCard.memberIds || []).map(String),
      watcherIds: (sourceCard.watcherIds || []).map(String),
      comments: []
    }
    const result = await cardModel.createNew(copiedCardData, session)
    const copiedCard = await cardModel.findOneById(result.insertedId, session)
    const updatedColumn = await columnModel.pushCardOrderIds(copiedCard, session)
    if (!updatedColumn) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Target column not found!')
    }

    await activityService.createNew(
      {
        boardId,
        actorId: userInfo._id,
        action: ACTIVITY_ACTIONS.CARD_COPIED,
        entityType: ACTIVITY_ENTITY_TYPES.CARD,
        entityId: copiedCard._id.toString(),
        metadata: { sourceCardId: cardId }
      },
      session
    )
    return copiedCard
  })
}

const getArchivedByBoardId = async (boardId) =>
  await cardModel.findArchivedByBoardId(boardId)

const move = async (cardId, targetColumnId, userInfo, authorizedBoard) =>
  await WITH_TRANSACTION(async (session) => {
    const card = await cardModel.findOneById(cardId, session)
    const targetColumn = await columnModel.findOneById(targetColumnId, session)
    const boardId = authorizedBoard._id.toString()
    if (!card || card.boardId.toString() !== boardId) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Card not found!')
    }
    if (!targetColumn || targetColumn.boardId.toString() !== boardId) {
      throw new ApiError(
        StatusCodes.UNPROCESSABLE_ENTITY,
        'Target column must belong to the same board.'
      )
    }
    const previousColumnId = card.columnId.toString()
    if (previousColumnId === targetColumnId) return card

    const previousColumn = await columnModel.removeCardOrderId(
      previousColumnId,
      cardId,
      session
    )
    const nextColumn = await columnModel.addCardOrderId(
      targetColumnId,
      cardId,
      session
    )
    const updatedCard = await cardModel.update(
      cardId,
      { columnId: targetColumnId, updatedAt: Date.now() },
      session
    )
    if (!previousColumn || !nextColumn || !updatedCard) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Card or column not found!')
    }
    await activityService.createNew(
      {
        boardId,
        actorId: userInfo._id,
        action: ACTIVITY_ACTIONS.CARD_MOVED,
        entityType: ACTIVITY_ENTITY_TYPES.CARD,
        entityId: cardId,
        metadata: { fromColumnId: previousColumnId, toColumnId: targetColumnId }
      },
      session
    )
    const notificationRecipients = [
      ...(card.memberIds || []),
      ...(card.watcherIds || [])
    ].map(String).filter((userId) => userId !== userInfo._id)
    if (notificationRecipients.length) {
      await notificationService.createForUsers(
        notificationRecipients,
        {
          actorId: userInfo._id,
          boardId,
          cardId,
          type: NOTIFICATION_TYPES.CARD_MOVED,
          message: `Card “${card.title}” was moved.`,
          dedupeKey: `${NOTIFICATION_TYPES.CARD_MOVED}:${cardId}:${new ObjectId()}`
        },
        session
      )
    }
    return updatedCard
  })

const addAttachment = async (cardId, file, userInfo, authorizedBoard) => {
  if (!file) {
    throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, 'Attachment is required.')
  }
  const upload = await CloudinaryProvider.streamUpload(
    file.buffer,
    'card-attachments',
    { resource_type: 'auto', use_filename: true }
  )
  const attachment = {
    _id: new ObjectId().toString(),
    name: file.originalname,
    url: upload.secure_url,
    publicId: upload.public_id,
    resourceType: upload.resource_type,
    mimeType: file.mimetype,
    size: file.size,
    uploadedBy: userInfo._id,
    createdAt: Date.now()
  }

  try {
    return await WITH_TRANSACTION(async (session) => {
      const updatedCard = await cardModel.addAttachment(cardId, attachment, session)
      if (!updatedCard) {
        throw new ApiError(
          StatusCodes.UNPROCESSABLE_ENTITY,
          'Card was not found or already has 50 attachments.'
        )
      }
      await activityService.createNew(
        {
          boardId: authorizedBoard._id.toString(),
          actorId: userInfo._id,
          action: ACTIVITY_ACTIONS.CARD_ATTACHMENT_ADDED,
          entityType: ACTIVITY_ENTITY_TYPES.CARD,
          entityId: cardId,
          metadata: { attachmentId: attachment._id, name: attachment.name }
        },
        session
      )
      return updatedCard
    })
  } catch (error) {
    try {
      await CloudinaryProvider.destroy(attachment.publicId, attachment.resourceType)
    } catch (cleanupError) {
      logger.error('Failed to clean up rejected card attachment', {
        publicId: attachment.publicId,
        error: cleanupError.message
      })
    }
    throw error
  }
}

const removeAttachment = async (
  cardId,
  attachmentId,
  userInfo,
  authorizedBoard
) => {
  const card = await cardModel.findOneById(cardId)
  const attachment = card?.attachments?.find((item) => item._id === attachmentId)
  if (!attachment) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Attachment not found!')
  }
  const updatedCard = await WITH_TRANSACTION(async (session) => {
    const result = await cardModel.removeAttachment(cardId, attachmentId, session)
    if (!result) throw new ApiError(StatusCodes.NOT_FOUND, 'Attachment not found!')
    await activityService.createNew(
      {
        boardId: authorizedBoard._id.toString(),
        actorId: userInfo._id,
        action: ACTIVITY_ACTIONS.CARD_ATTACHMENT_REMOVED,
        entityType: ACTIVITY_ENTITY_TYPES.CARD,
        entityId: cardId,
        metadata: { attachmentId, name: attachment.name }
      },
      session
    )
    return result
  })

  try {
    await CloudinaryProvider.destroy(attachment.publicId, attachment.resourceType)
  } catch (error) {
    logger.error('Failed to remove orphaned card attachment', {
      publicId: attachment.publicId,
      error: error.message
    })
  }
  return updatedCard
}

export const cardService = {
  createNew,
  update,
  setArchived,
  copy,
  getArchivedByBoardId,
  move,
  addAttachment,
  removeAttachment
}
