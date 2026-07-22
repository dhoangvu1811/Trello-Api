import express from 'express'
import { userValidation } from '~/validations/userValidation'
import { userController } from '~/controllers/userController'
import { authMiddleware } from '~/middlewares/authMiddleware'
import { multerUploadMiddleware } from '~/middlewares/multerUploadMiddleware'
import { rateLimitMiddleware } from '~/middlewares/rateLimitMiddleware'

const Router = express.Router()

Router.route('/register').post(
  rateLimitMiddleware.register,
  userValidation.createNew,
  userController.createNew
)

Router.route('/verify').put(
  userValidation.verifyAccount,
  userController.verifyAccount
)

Router.route('/login').post(
  rateLimitMiddleware.login,
  userValidation.login,
  userController.login
)

Router.route('/forgot-password').post(
  rateLimitMiddleware.passwordReset,
  userValidation.forgotPassword,
  userController.forgotPassword
)

Router.route('/reset-password').put(
  rateLimitMiddleware.passwordReset,
  userValidation.resetPassword,
  userController.resetPassword
)

Router.route('/logout').delete(userController.logout)
Router.route('/refresh_token').post(
  rateLimitMiddleware.refresh,
  userController.refreshToken
)
Router.route('/session').get(
  authMiddleware.isAuthorized,
  userController.getSession
)

Router.route('/update').put(
  authMiddleware.isAuthorized,
  multerUploadMiddleware.upload.single('avatar'),
  userValidation.update,
  userController.update
)

export const userRoute = Router
