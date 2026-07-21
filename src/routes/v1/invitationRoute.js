import express from 'express'
import { invitationController } from '~/controllers/invitationController'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { invitationValidation } from '~/validations/invitationValidation'
import { boardAuthorizationMiddleware } from '~/middlewares/boardAuthorizationMiddleware'

const Route = express.Router()

Route.route('/').get(
  authMiddleware.isAuthorized,
  invitationController.getInvitations
)

Route.route('/board').post(
  authMiddleware.isAuthorized,
  invitationValidation.createNewBoardInvitation,
  boardAuthorizationMiddleware.requireBoardOwnerByBody,
  invitationController.createNewBoardInvitation
)

Route.route('/board/:invitationId').put(
  authMiddleware.isAuthorized,
  invitationValidation.updateBoardInvitation,
  invitationController.updateBoardInvitation
)

export const invitationRoute = Route
