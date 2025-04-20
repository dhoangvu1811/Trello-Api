import { MongoClient, ServerApiVersion } from 'mongodb'

const MONGODB_URI =
  'mongodb+srv://VuxDH:8c5GBIg5OzmMtpFR@vuxdh.7zhlnbz.mongodb.net/?retryWrites=true&w=majority&appName=VuxDH'

const DATABASE_NAME = 'trello-dhvdev'

//Khởi tạo một đối tượng trelloDatabaseInstance ban đầu là null (Vì chưa connect)
let trelloDatabaseInstance = null

//Khởi tạo một đối tượng mongoClientInstance để connect tới MongoDB
const mongoClientInstance = new MongoClient(MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true
  }
})

// Kết nối tới Database
export const CONNECT_DB = async () => {
  //Gọi kết nối tới MongoDB Atlas với URI đã khai báo
  await mongoClientInstance.connect()

  //Kết nối thành công thì lấy ra database theo tên và gán vào biến trelloDatabaseInstance
  trelloDatabaseInstance = mongoClientInstance.db(DATABASE_NAME)
}

//Hàm GET_DB export trelloDatabaseInstance sau khi kết nối thành công để sử dụng ở nhiều nơi khác nhau
export const GET_DB = () => {
  if (!trelloDatabaseInstance)
    throw new Error('Must connect to Database first!')
  return trelloDatabaseInstance
}

//Đóng kết nối tơí DB
export const CLOSE_DB = async () => {
  await mongoClientInstance.close()
}
