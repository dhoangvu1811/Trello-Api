import JWT from 'jsonwebtoken'

/**
 * Function tạo mới token cần ba tham số đầu vào
 * userInfo: Những thông tin muốn đính vào token
 * secretSignature: chữ ký bí mật (dạng một chuỗi string ngẫu nhiên)
 * tokenLife: thời gian sống của token
 */
const generateToken = async (userInfo, secretSignature, tokenLife) => {
  try {
    return JWT.sign(userInfo, secretSignature, {
      algorithm: 'HS256',
      expiresIn: tokenLife
    })
  } catch (error) {
    throw new Error(error)
  }
}

/**
 * Function kiểm tra token có hợp lệ hay không
 */
const verifyToken = async (token, secretSignature) => {
  try {
    return JWT.verify(token, secretSignature)
  } catch (error) {
    throw new Error(error)
  }
}

export const JwtProvider = {
  generateToken,
  verifyToken
}
