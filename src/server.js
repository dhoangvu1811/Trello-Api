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

const START_SERVER = () => {
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

  //Môi trường production
  if (env.BUILD_MODE === 'production') {
    app.listen(process.env.PORT, () => {
      console.log(
        `3. PRODUCTION Hello ${env.AUTHOR}, I am running at PORT: ${process.env.PORT}`
      )
    })
  } else {
    //Môi trường Local dev
    app.listen(env.LOCAL_DEV_APP_PORT, env.LOCAL_DEV_APP_HOST, () => {
      console.log(
        `3. LOCAL_DEV Hello ${env.AUTHOR}, I am running at HOST: ${env.LOCAL_DEV_APP_HOST} and PORT: ${env.LOCAL_DEV_APP_PORT}`
      )
    })
  }

  //Thực hiện các tác vụ cleanup trước khi dừng server
  AsyncExitHook(() => {
    console.log('4. Server is shutting down...')
    CLOSE_DB()
    console.log('5. Disconnected from MongoDB Cloud Atlas!')
  })
}
//Chỉ khi kết nối thành công mới start server
//Immediately Invoked / Anonymous Async Functions (IIFE)
;(async () => {
  try {
    console.log('1. Connecting to MongoDB Cloud Atlas...')
    await CONNECT_DB()
    console.log('2. Connected to MongoDB Cloud Atlas!')
    START_SERVER()
  } catch (error) {
    console.error(error)
    process.exit(0)
  }
})()

// //Chỉ khi kết nối thành công mới start server
// CONNECT_DB()
//   .then(() => console.log('Connected to MongoDB Cloud Atlas'))
//   .then(() => START_SERVER())
//   .catch((error) => {
//     console.error(error)
//     process.exit(0)
//   })
