import express from 'express'
import { cardValidation } from '~/validations/cardValidation'
import { cardController } from '~/controllers/cardController'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { multerUploadMiddleware } from '~/middlewares/multerUploadMiddleware'
import { boardAuthorizationMiddleware } from '~/middlewares/boardAuthorizationMiddleware'

const Router = express.Router()

Router.route('/').post(
  authMiddleware.isAuthorized,
  cardValidation.createNew,
  boardAuthorizationMiddleware.requireBoardContentEditorByBody,
  cardController.createNew
)

Router.route('/:id').put(
  authMiddleware.isAuthorized,
  multerUploadMiddleware.upload.single('cardCover'),
  cardValidation.update,
  boardAuthorizationMiddleware.requireBoardContentEditorByCard,
  cardController.update
)

export const cardRoute = Router
