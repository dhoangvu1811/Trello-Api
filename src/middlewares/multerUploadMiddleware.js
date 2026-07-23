import { StatusCodes } from 'http-status-codes'
import multer from 'multer'
import ApiError from '~/utils/ApiError'
import {
  ALLOW_ATTACHMENT_FILE_TYPES,
  ALLOW_COMMON_FILE_TYPES,
  LIMIT_COMMON_FILE_SIZE
} from '~/utils/validators'

//Function kiểm tra loại file nào được chấp nhận
export const createFileFilter = (allowedTypes, errorMessage) =>
  (req, file, callback) => {
    if (!allowedTypes.includes(file.mimetype)) {
      return callback(
        new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, errorMessage),
        null
      )
    }
    return callback(null, true)
  }

// Khởi tạo function upload được tạo bởi multer
const upload = multer({
  limits: { fileSize: LIMIT_COMMON_FILE_SIZE },
  fileFilter: createFileFilter(
    ALLOW_COMMON_FILE_TYPES,
    'File type is invalid. Only jpg, jpeg and png are accepted.'
  )
})

const attachmentUpload = multer({
  limits: { fileSize: LIMIT_COMMON_FILE_SIZE },
  fileFilter: createFileFilter(
    ALLOW_ATTACHMENT_FILE_TYPES,
    'Attachment type is invalid.'
  )
})

export const multerUploadMiddleware = {
  upload,
  attachmentUpload
}
