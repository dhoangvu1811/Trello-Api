import { StatusCodes } from 'http-status-codes'
import { notificationService } from '~/services/notificationService'
import ApiError from '~/utils/ApiError'

const getMine = async (req, res, next) => {
  try {
    const notifications = await notificationService.getByUserId(req.jwtDecoded._id)
    res.status(StatusCodes.OK).json(notifications)
  } catch (error) {
    next(error)
  }
}

const markRead = async (req, res, next) => {
  try {
    const notification = await notificationService.markRead(
      req.params.id,
      req.jwtDecoded._id
    )
    if (!notification) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Notification not found!')
    }
    res.status(StatusCodes.OK).json(notification)
  } catch (error) {
    next(error)
  }
}

const markAllRead = async (req, res, next) => {
  try {
    await notificationService.markAllRead(req.jwtDecoded._id)
    res.status(StatusCodes.OK).json({ markedAllRead: true })
  } catch (error) {
    next(error)
  }
}

export const notificationController = { getMine, markRead, markAllRead }
