import express from 'express'
import cors from 'cors'
import { corsOptions } from '~/config/cors'
import AsyncExitHook from 'async-exit-hook'
import { CONNECT_DB, CLOSE_DB } from '~/config/mongodb'
import { env } from '~/config/environment'
import { APIs_V1 } from '~/routes/v1'
import { errorHandlingMiddleware } from '~/middlewares/errorHandlingMiddleware'
import cookieParser from 'cookie-parser'
import socketIo from 'socket.io'
import http from 'http'
import {
  authenticateSocket,
  registerBoardSocket
} from './sockets/inviteUserToBoardSocket'
import { logger } from '~/utils/logger'

export const CREATE_HTTP_SERVER = () => {
  const app = express()

  if (env.BUILD_MODE === 'production') app.set('trust proxy', 1)

  //Fix cái vụ Cache from disk của ExpressJS
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })

  //Cấu hình Cookie parser
  app.use(cookieParser())

  //Xử lý cors
  app.use(cors(corsOptions))

  //Enable req.body json data
  app.use(express.json())

  //Use APIs V1
  app.use('/V1', APIs_V1)

  // Middleware xử lý lỗi tập trung
  app.use(errorHandlingMiddleware)

  // Tạo một server mới bọc app của express để làm real time với socket.io
  const server = http.createServer(app)
  // Khởi tạo biến io với server và cors
  const io = socketIo(server, { cors: corsOptions })
  app.set('io', io)
  io.use(authenticateSocket)
  io.on('connection', (socket) => {
    registerBoardSocket(socket)
  })

  return { app, server, io }
}

const START_EXPRESS = () => {
  const { server, io } = CREATE_HTTP_SERVER()

  const port = Number(env.PORT)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.')
  }

  const host = env.BUILD_MODE === 'production' ? '0.0.0.0' : env.HOST

  // Dùng HTTP server để Express và Socket.IO cùng lắng nghe trên một cổng.
  server.listen(port, host, () => {
    logger.info('HTTP server started', {
      buildMode: env.BUILD_MODE,
      host,
      port,
      author: env.AUTHOR
    })
  })

  // Chờ Socket.IO và MongoDB đóng xong trước khi kết thúc tiến trình.
  AsyncExitHook((done) => {
    logger.info('Server is shutting down')
    io.close(async () => {
      try {
        await CLOSE_DB()
        logger.info('Disconnected from MongoDB')
      } catch (error) {
        logger.error('Failed to close MongoDB connection', {
          error: error.message
        })
      } finally {
        done()
      }
    })
  })

  return { server, io }
}

export const START_SERVER = () => {
  //Chỉ khi kết nối thành công mới start server
  //Immediately Invoked / Anonymous Async Functions (IIFE)
  (async () => {
    try {
      logger.info('Connecting to MongoDB')
      await CONNECT_DB()
      logger.info('Connected to MongoDB')
      START_EXPRESS()
    } catch (error) {
      logger.error('Server startup failed', { error: error.message })
      try {
        await CLOSE_DB()
      } catch (closeError) {
        logger.error('Failed to close MongoDB after startup error', {
          error: closeError.message
        })
      }
      process.exitCode = 1
    }
  })()
}
