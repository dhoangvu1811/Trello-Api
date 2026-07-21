/* eslint-disable no-useless-catch */
import { cardModel } from '~/models/cardModel'
import { columnModel } from '~/models/columnModel'
import { CloudinaryProvider } from '~/providers/CloudinaryProvider'
import { StatusCodes } from 'http-status-codes'
import ApiError from '~/utils/ApiError'
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ENTITY_TYPES,
  CARD_MEMBER_ACTIONS
} from '~/utils/constants'
import { getBoardUserIds } from '~/utils/boardPermissions'
import { userModel } from '~/models/userModel'
import { WITH_TRANSACTION } from '~/config/mongodb'
import { activityService } from '~/services/activityService'

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
    const updateData = {
      ...reqBody,
      updatedAt: Date.now()
    }

    let cardMutation
    let activityAction = ACTIVITY_ACTIONS.CARD_UPDATED
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
        content: updateData.commentToAdd.content,
        commentedAt: Date.now(),
        userEmail: commentAuthor.email,
        userId: commentAuthor._id.toString(),
        userAvatar: commentAuthor.avatar,
        userDisplayName: commentAuthor.displayName
      }

      cardMutation = (session) =>
        cardModel.unShiftNewComment(cardId, commentData, session)
      activityAction = ACTIVITY_ACTIONS.CARD_COMMENTED
      activityMetadata = {}
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
    } else {
      cardMutation = (session) => cardModel.update(cardId, updateData, session)
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
      return updatedCard
    })
  } catch (error) {
    throw error
  }
}

export const cardService = {
  createNew,
  update
}
