/* eslint-disable no-console */
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

const START_EXPRESS = () => {
  const app = express()

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

  const port = Number(env.PORT)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.')
  }

  const host = env.BUILD_MODE === 'production' ? '0.0.0.0' : env.HOST

  // Dùng HTTP server để Express và Socket.IO cùng lắng nghe trên một cổng.
  server.listen(port, host, () => {
    console.log(
      `3. ${env.BUILD_MODE.toUpperCase()} Hello ${env.AUTHOR}, I am running at HOST: ${host} and PORT: ${port}`
    )
  })

  // Chờ Socket.IO và MongoDB đóng xong trước khi kết thúc tiến trình.
  AsyncExitHook((done) => {
    console.log('4. Server is shutting down...')
    io.close(async () => {
      try {
        await CLOSE_DB()
        console.log('5. Disconnected from MongoDB Cloud Atlas!')
      } catch (error) {
        console.error('Failed to close MongoDB connection:', error)
      } finally {
        done()
      }
    })
  })
}

export const START_SERVER = () => {
  //Chỉ khi kết nối thành công mới start server
  //Immediately Invoked / Anonymous Async Functions (IIFE)
  (async () => {
    try {
      console.log('1. Connecting to MongoDB Cloud Atlas...')
      await CONNECT_DB()
      console.log('2. Connected to MongoDB Cloud Atlas!')
      START_EXPRESS()
    } catch (error) {
      console.error(error)
      try {
        await CLOSE_DB()
      } catch (closeError) {
        console.error('Failed to close MongoDB connection:', closeError)
      }
      process.exitCode = 1
    }
  })()
}
