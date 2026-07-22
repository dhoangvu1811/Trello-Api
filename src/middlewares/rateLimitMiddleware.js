import crypto from 'crypto'
import { StatusCodes } from 'http-status-codes'
import { rateLimitModel } from '~/models/rateLimitModel'
import ApiError from '~/utils/ApiError'

const hashKey = (value) =>
  crypto.createHash('sha256').update(value).digest('hex')

const createRateLimiter = ({ scope, maxRequests, windowMs, identify }) => {
  return async (req, res, next) => {
    try {
      const identity = identify(req)
      const bucket = await rateLimitModel.consume(
        `${scope}:${hashKey(identity)}`,
        windowMs
      )

      const remaining = Math.max(0, maxRequests - bucket.count)
      res.set('RateLimit-Limit', maxRequests.toString())
      res.set('RateLimit-Remaining', remaining.toString())

      if (bucket.count > maxRequests) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((bucket.windowStart + windowMs - Date.now()) / 1000)
        )
        res.set('Retry-After', retryAfterSeconds.toString())
        next(
          new ApiError(
            StatusCodes.TOO_MANY_REQUESTS,
            'Too many requests. Please try again later.'
          )
        )
        return
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}

const identifyAuthRequest = (req) =>
  `${req.ip}:${String(req.body?.email || '').trim().toLowerCase()}`

export const rateLimitMiddleware = {
  register: createRateLimiter({
    scope: 'register',
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
    identify: identifyAuthRequest
  }),
  login: createRateLimiter({
    scope: 'login',
    maxRequests: 10,
    windowMs: 15 * 60 * 1000,
    identify: identifyAuthRequest
  }),
  refresh: createRateLimiter({
    scope: 'refresh',
    maxRequests: 60,
    windowMs: 15 * 60 * 1000,
    identify: (req) => req.ip
  }),
  passwordReset: createRateLimiter({
    scope: 'password-reset',
    maxRequests: 5,
    windowMs: 60 * 60 * 1000,
    identify: identifyAuthRequest
  }),
  invitation: createRateLimiter({
    scope: 'invitation',
    maxRequests: 20,
    windowMs: 60 * 60 * 1000,
    identify: (req) => req.jwtDecoded._id.toString()
  })
}
