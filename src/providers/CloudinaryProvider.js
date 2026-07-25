import cloudinary from 'cloudinary'
import streamifier from 'streamifier'
import { env } from '~/config/environment'

// Cấu hình cloudinary
const cloudinaryV2 = cloudinary.v2
cloudinaryV2.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET
})

//Khởi tạo một function để thực hiện upload file lên Cloudinary
const streamUpload = (fileBuffer, folderName, options = {}) => {
  return new Promise((resolve, reject) => {
    // Tạo một luồng stream upload lên Cloudinary
    const stream = cloudinaryV2.uploader.upload_stream(
      { folder: folderName, ...options },
      (err, result) => {
        if (err) reject(err)
        else resolve(result)
      }
    )
    // Thực hiện upload luồng trên bằng lib streamifier
    streamifier.createReadStream(fileBuffer).pipe(stream)
  })
}

const destroy = async (publicId, resourceType = 'image') =>
  await cloudinaryV2.uploader.destroy(publicId, { resource_type: resourceType })

export const isTrustedCloudinaryUrl = (url) => {
  try {
    const parsedUrl = new URL(url)
    return parsedUrl.protocol === 'https:' &&
      parsedUrl.hostname === 'res.cloudinary.com'
  } catch {
    return false
  }
}

const downloadResource = async (url, maxBytes = 10 * 1024 * 1024) => {
  if (!isTrustedCloudinaryUrl(url)) {
    throw new Error('Refusing to download an untrusted attachment URL.')
  }

  const abortController = new AbortController()
  const timeoutId = setTimeout(() => abortController.abort(), 15_000)
  try {
    const response = await fetch(url, { signal: abortController.signal })
    if (!response.ok) {
      throw new Error(`Cloud attachment returned HTTP ${response.status}.`)
    }

    const declaredSize = Number(response.headers.get('content-length'))
    if (Number.isFinite(declaredSize) && declaredSize > maxBytes) {
      throw new Error('Cloud attachment exceeds its allowed size.')
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length > maxBytes) {
      throw new Error('Cloud attachment exceeds its allowed size.')
    }
    return buffer
  } finally {
    clearTimeout(timeoutId)
  }
}

export const CloudinaryProvider = {
  streamUpload,
  destroy,
  downloadResource
}
