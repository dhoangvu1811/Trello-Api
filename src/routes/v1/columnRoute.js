import express from 'express'
import { columnValidation } from '~/validations/columnValidation'
import { columnController } from '~/controllers/columnController'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { boardAuthorizationMiddleware } from '~/middlewares/boardAuthorizationMiddleware'

const Router = express.Router()

Router.route('/').post(
  authMiddleware.isAuthorized,
  columnValidation.createNew,
  boardAuthorizationMiddleware.requireBoardMemberByBody,
  columnController.createNew
)

Router.route('/:id')
  .put(
    authMiddleware.isAuthorized,
    columnValidation.update,
    boardAuthorizationMiddleware.requireBoardMemberByColumn,
    columnController.update
  )
  .delete(
    authMiddleware.isAuthorized,
    columnValidation.deleteItem,
    boardAuthorizationMiddleware.requireBoardMemberByColumn,
    columnController.deleteItem
  )

export const columnRoute = Router
