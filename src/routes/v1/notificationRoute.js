import express from 'express'
import { ObjectId } from 'mongodb'
import { StatusCodes } from 'http-status-codes'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { notificationController } from '~/controllers/notificationController'
import ApiError from '~/utils/ApiError'

const Router = express.Router()

const validateId = (req, res, next) => {
  if (!ObjectId.isValid(req.params.id)) {
    next(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, 'Notification id is invalid.'))
    return
  }
  next()
}

Router.get('/', authMiddleware.isAuthorized, notificationController.getMine)
Router.put('/read-all', authMiddleware.isAuthorized, notificationController.markAllRead)
Router.put('/:id/read', authMiddleware.isAuthorized, validateId, notificationController.markRead)

export const notificationRoute = Router
