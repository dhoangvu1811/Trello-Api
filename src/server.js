/* eslint-disable no-console */
import express from 'express'
import AsyncExitHook from 'async-exit-hook'
import { CONNECT_DB, GET_DB, CLOSE_DB } from '~/config/mongodb'

const START_SERVER = () => {
  const app = express()
  const hostname = 'localhost'
  const port = 8017

  app.get('/', async (req, res) => {
    console.log(await GET_DB().listCollections().toArray())

    res.end('<h1>Hello World!</h1><hr>')
  })

  app.listen(port, hostname, () => {
    console.log(`3. Hello DHVuxDev, I am running at ${hostname}:${port}/`)
  })

  //Thực hiện các tác vụ cleanup trước khi dừng server
  AsyncExitHook(() => {
    console.log('4. Disconnecting from MongoDB Cloud Atlas...')
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
