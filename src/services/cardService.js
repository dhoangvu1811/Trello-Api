/* eslint-disable no-useless-catch */
import { cardModel } from '~/models/cardModel'
import { columnModel } from '~/models/columnModel'
import { CloudinaryProvider } from '~/providers/CloudinaryProvider'

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
const update = async (cardId, reqBody, cardCoverFile, userInfo) => {
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
      // Tạo dữ liệu comment để thêm vào DB, cần bổ sung những field cần thiết
      const commentData = {
        ...updateData.commentToAdd,
        commentedAt: Date.now(),
        userEmail: userInfo.email,
        userId: userInfo._id
      }

      updatedCard = await cardModel.unShiftNewComment(cardId, commentData)
    } else if (updateData.incommingMemberInfo) {
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
