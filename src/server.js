import dotenv from 'dotenv'
import path from 'path'

// Config environment variables before any other imports
if (process.env.BUILD_MODE !== 'production') {
  const envFile = process.env.BUILD_MODE === 'production' ? '.env.production' : '.env.local' // Giữ lại cho ai thích cấu hình tay trên localhost
  dotenv.config({ path: path.resolve(process.cwd(), envFile) })
}

// Now that environment variables are loaded into process.env, we can import the rest of the application
const { START_SERVER } = require('./server_core')

START_SERVER()
