import { StatusCodes } from 'http-status-codes'
import { JwtProvider } from '~/providers/JwtProvider'
import { env } from '~/config/environment'
import ApiError from '~/utils/ApiError'
import { userService } from '~/services/userService'

//Middleware này sẽ đảm nhiệm việc quan trọng: Xác thực cái Jwt accessToken nhận được từ FE có hợp lệ hay không
const isAuthorized = async (req, res, next) => {
  // Lấy accessToken nằm trong request cookies phía client - withCredentials trong file authorizeAxios
  const clientAccessToken = req.cookies?.accessToken

  // Nếu như clientAccessToken không tồn tại thì trả về lỗi
  if (!clientAccessToken) {
    next(
      new ApiError(StatusCodes.UNAUTHORIZED, 'Unauthorized! (token not found)')
    )
    return
  }

  try {
    //B1: Thực hiện giải mã token xem có hợp lệ hay không
    const accessTokenDecoded = await JwtProvider.verifyToken(
      clientAccessToken,
      env.ACCESS_TOKEN_SECRET_SIGNATURE
    )
    const authContext = await userService.validateAccessSession(
      accessTokenDecoded
    )
    if (!authContext) {
      next(new ApiError(StatusCodes.UNAUTHORIZED, 'Session is no longer valid.'))
      return
    }

    //B2: Nếu như token hợp lệ thì cần lưu thông tin giải mã vào req.jwtDecoded, để sử dụng cho các tầng xử lý ở phía sau
    req.jwtDecoded = accessTokenDecoded
    req.authenticatedUser = authContext.user
    req.authSession = authContext.session

    //B3: cho phép req đi tiếp
    next()
  } catch (error) {
    // console.log('🚀 ~ isAuthorized ~ error:', error)
    //Nếu cái accessToken bị hết hạn (expired) thì trả về lỗi GONE - 410 để phía FE biết để gọi Api refreshToken
    if (error?.message?.includes('jwt expired')) {
      next(new ApiError(StatusCodes.GONE, 'Need to refresh token!'))
      return
    }

    //Nếu như accessToken không hợp lệ do bất kỳ điều gì khác vụ hết hạn thì trả về lỗi 401 cho phía FE gọi Api sign_out
    next(new ApiError(StatusCodes.UNAUTHORIZED, 'Unauthorized!'))
  }
}

export const authMiddleware = {
  isAuthorized
}
