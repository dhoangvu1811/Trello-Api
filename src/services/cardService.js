/* eslint-disable no-useless-catch */
import { cardModel } from '~/models/cardModel'
import { columnModel } from '~/models/columnModel'
import { CloudinaryProvider } from '~/providers/CloudinaryProvider'
import { StatusCodes } from 'http-status-codes'
import ApiError from '~/utils/ApiError'
import { CARD_MEMBER_ACTIONS } from '~/utils/constants'
import { getBoardUserIds } from '~/utils/boardPermissions'
import { userModel } from '~/models/userModel'

const createNew = async (reqBody) => {
  try {
    // Xử lý logic
    const newCard = {
      ...reqBody
    }

    //Gọi tới model để xử lý lưu bản ghi trong DB
    const createdCard = await cardModel.createNew(newCard)

    const getNewCard = await cardModel.findOneById(createdCard.insertedId)
    //Cập nhật mảng cardOrderIds trong collection columns
    if (getNewCard) {
      await columnModel.pushCardOrderIds(getNewCard)
    }

    return getNewCard
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
    // Xử lý logic
    const updateData = {
      ...reqBody,
      updatedAt: Date.now()
    }

    let updatedCard = {}

    if (cardCoverFile) {
      const uploadResult = await CloudinaryProvider.streamUpload(
        cardCoverFile.buffer,
        'card-covers'
      )

      updatedCard = await cardModel.update(cardId, {
        cover: uploadResult.secure_url
      })
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

      updatedCard = await cardModel.unShiftNewComment(cardId, commentData)
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

      updatedCard = await cardModel.updateMembers(
        cardId,
        updateData.incommingMemberInfo
      )
    } else {
      updatedCard = await cardModel.update(cardId, updateData)
    }

    return updatedCard
  } catch (error) {
    throw error
  }
}

export const cardService = {
  createNew,
  update
}
