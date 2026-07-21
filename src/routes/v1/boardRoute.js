import express from 'express'
import { boardValidation } from '~/validations/boardValidation'
import { boardController } from '~/controllers/boardController'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { boardAuthorizationMiddleware } from '~/middlewares/boardAuthorizationMiddleware'
import { paginationValidation } from '~/validations/paginationValidation'

const Router = express.Router()

Router.route('/')
  .get(
    authMiddleware.isAuthorized,
    paginationValidation.boards,
    boardController.getBoards
  )
  .post(
    authMiddleware.isAuthorized,
    boardValidation.createNew,
    boardController.createNew
  )

Router.route('/:id')
  .get(authMiddleware.isAuthorized, boardController.getDetails)
  .put(
    authMiddleware.isAuthorized,
    boardValidation.update,
    boardAuthorizationMiddleware.requireBoardUpdatePermission,
    boardController.update
  )

Router.route('/:id/members/:userId/role').put(
  authMiddleware.isAuthorized,
  boardValidation.updateMemberRole,
  boardAuthorizationMiddleware.requireBoardOwnerByParam,
  boardController.updateMemberRole
)

Router.route('/:id/activities').get(
  authMiddleware.isAuthorized,
  paginationValidation.activities,
  boardAuthorizationMiddleware.requireBoardAccessByParam,
  boardController.getActivities
)

//Api Hỗ trợ việc di chuyển card giữa các column khác nhau
Router.route('/supports/moving_card').put(
  authMiddleware.isAuthorized,
  boardValidation.moveCardToDifferentColumn,
  boardAuthorizationMiddleware.requireBoardContentEditorForCardMove,
  boardController.moveCardToDifferentColumn
)

export const boardRoute = Router
