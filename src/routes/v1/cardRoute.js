import express from 'express'
import { cardValidation } from '~/validations/cardValidation'
import { cardController } from '~/controllers/cardController'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { multerUploadMiddleware } from '~/middlewares/multerUploadMiddleware'
import { boardAuthorizationMiddleware } from '~/middlewares/boardAuthorizationMiddleware'

const Router = express.Router()

Router.route('/archived/board/:id').get(
  authMiddleware.isAuthorized,
  boardAuthorizationMiddleware.requireBoardAccessByParam,
  cardController.getArchivedByBoardId
)

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

Router.route('/:id/archive').put(
  authMiddleware.isAuthorized,
  cardValidation.setArchived,
  boardAuthorizationMiddleware.requireBoardContentEditorByCard,
  cardController.setArchived
)

Router.route('/:id/copy').post(
  authMiddleware.isAuthorized,
  cardValidation.copy,
  boardAuthorizationMiddleware.requireBoardContentEditorByCard,
  cardController.copy
)

Router.route('/:id/move').put(
  authMiddleware.isAuthorized,
  cardValidation.move,
  boardAuthorizationMiddleware.requireBoardContentEditorByCard,
  cardController.move
)

Router.route('/:id/attachments').post(
  authMiddleware.isAuthorized,
  multerUploadMiddleware.attachmentUpload.single('attachment'),
  boardAuthorizationMiddleware.requireBoardContentEditorByCard,
  cardController.addAttachment
)

Router.route('/:id/attachments/:attachmentId').delete(
  authMiddleware.isAuthorized,
  boardAuthorizationMiddleware.requireBoardContentEditorByCard,
  cardController.removeAttachment
)

export const cardRoute = Router
