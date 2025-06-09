import express from 'express'
import { invitationController } from '~/controllers/invitationController'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { invitationValidation } from '~/validations/invitationValidation'

const Route = express.Router()

Route.route('/').get(
  authMiddleware.isAuthorized,
  invitationController.getInvitations
)

Route.route('/board').post(
  authMiddleware.isAuthorized,
  invitationValidation.createNewBoardInvitation,
  invitationController.createNewBoardInvitation
)

Route.route('/board/:invitationId').put(
  authMiddleware.isAuthorized,
  invitationController.updateBoardInvitation
)

export const invitationRoute = Route
