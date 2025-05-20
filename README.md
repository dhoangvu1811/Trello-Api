# Dự Án API Trello

Dịch vụ API RESTful mô phỏng các chức năng cốt lõi của Trello, được xây dựng bằng Node.js, Express và MongoDB.

## 📋 Tổng Quan

Dự án này là một dịch vụ API backend mô phỏng các chức năng cốt lõi của Trello, cho phép quản lý bảng, cột, thẻ và người dùng. Nó cung cấp API RESTful để tạo, đọc, cập nhật và xóa tài nguyên, cũng như hỗ trợ các thao tác đặc biệt như di chuyển thẻ giữa các cột.

## 🚀 Tính Năng

- **Quản Lý Bảng**: Tạo, truy xuất, cập nhật và xóa bảng
- **Quản Lý Cột**: Quản lý các cột trong bảng
- **Quản Lý Thẻ**: Tạo và quản lý các thẻ trong cột
- **Quản Lý Người Dùng**: Xác thực và phân quyền người dùng
- **Xác Thực Dữ Liệu**: Kiểm tra đầu vào bằng schema Joi
- **Xử Lý Lỗi**: Middleware xử lý lỗi tập trung
- **Tích Hợp MongoDB**: Lưu trữ dữ liệu bằng MongoDB Atlas

## 🛠️ Công Nghệ Sử Dụng

- **Node.js**: Môi trường chạy JavaScript
- **Express**: Framework phát triển web
- **MongoDB**: Cơ sở dữ liệu NoSQL (thông qua MongoDB Atlas)
- **Babel**: Trình biên dịch JavaScript cho phép sử dụng các tính năng JavaScript hiện đại
- **Joi**: Thư viện xác thực schema
- **Lodash**: Thư viện tiện ích để làm việc với mảng, đối tượng, v.v.

## 🏗️ Kiến Trúc

Dự án theo kiến trúc có cấu trúc như sau:

```
src/
├── config/           # Các file cấu hình ứng dụng
├── controllers/      # Các controller xử lý endpoint API
├── middlewares/      # Các middleware tùy chỉnh
├── models/           # Các model cơ sở dữ liệu và định nghĩa schema
├── providers/        # Các nhà cung cấp dịch vụ bên ngoài
├── routes/           # Định nghĩa các route API
│   ├── v1/           # Các route API v1
│   └── v2/           # Các route API v2 (để sử dụng trong tương lai)
├── services/         # Logic nghiệp vụ
├── sockets/          # Triển khai WebSocket
├── utils/            # Các hàm tiện ích
├── validations/      # Các schema xác thực yêu cầu
└── server.js         # Điểm vào của ứng dụng
```

## ⚙️ Bắt Đầu

### Yêu Cầu

- Node.js (phiên bản 18 trở lên)
- Tài khoản MongoDB Atlas (hoặc MongoDB cài đặt cục bộ)

### Cài Đặt

1. Sao chép kho lưu trữ:

```bash
git clone https://github.com/yourusername/trello-api.git
cd trello-api
```

2. Cài đặt các gói phụ thuộc:

```bash
npm install
```

3. Tạo file `.env` trong thư mục gốc của dự án với các biến sau:

```
MONGODB_URI=chuỗi_kết_nối_mongodb_atlas_của_bạn
DATABASE_NAME=trello_db
LOCAL_DEV_APP_HOST=localhost
LOCAL_DEV_APP_PORT=8017
BUILD_MODE=dev
AUTHOR=TênCủaBạn
```

### Chạy Ứng Dụng

#### Chế Độ Phát Triển

```bash
npm run dev
```

#### Chế Độ Sản Xuất

```bash
npm run production
```

## 📚 Các Endpoint API

### Bảng (Boards)

- `GET /v1/boards` - Lấy tất cả bảng
- `POST /v1/boards` - Tạo bảng mới
- `GET /v1/boards/:id` - Lấy chi tiết bảng theo ID
- `PUT /v1/boards/:id` - Cập nhật bảng theo ID
- `PUT /v1/boards/supports/moving_card` - Di chuyển thẻ giữa các cột

### Cột (Columns)

- `POST /v1/columns` - Tạo cột mới
- `PUT /v1/columns/:id` - Cập nhật cột theo ID

### Thẻ (Cards)

- `POST /v1/cards` - Tạo thẻ mới
- `PUT /v1/cards/:id` - Cập nhật thẻ theo ID

### Người Dùng (Users)

- Các endpoint quản lý người dùng

## 📦 Các Script Dự Án

- `npm run lint` - Chạy ESLint để kiểm tra chất lượng mã
- `npm run clean` - Xóa thư mục build và tạo mới
- `npm run build-babel` - Biên dịch mã nguồn bằng Babel
- `npm run build` - Chạy script clean và build-babel
- `npm run production` - Build dự án và chạy ở chế độ sản xuất
- `npm run dev` - Chạy dự án ở chế độ phát triển với tính năng tự động tải lại

## 🔑 Mô Hình Dữ Liệu

### Mô Hình Bảng (Board Model)

```
{
  title: String,
  slug: String,
  description: String,
  type: String (PUBLIC/PRIVATE),
  columnOrderIds: Mảng các ObjectId,
  createdAt: Date,
  updatedAt: Date,
  _destroy: Boolean
}
```

### Mô Hình Cột (Column Model)

```
{
  boardId: ObjectId,
  title: String,
  cardOrderIds: Mảng các ObjectId,
  createdAt: Date,
  updatedAt: Date,
  _destroy: Boolean
}
```

### Mô Hình Thẻ (Card Model)

```
{
  boardId: ObjectId,
  columnId: ObjectId,
  title: String,
  description: String,
  createdAt: Date,
  updatedAt: Date,
  _destroy: Boolean
}
```

### Mô Hình Người Dùng (User Model)

```
{
  username: String,
  password: String (đã mã hóa),
  email: String,
  createdAt: Date,
  updatedAt: Date,
  _destroy: Boolean
}
```

## 🧰 Xử Lý Lỗi

Ứng dụng sử dụng middleware xử lý lỗi tập trung để bắt và định dạng tất cả các lỗi trong toàn bộ ứng dụng, cung cấp phản hồi lỗi nhất quán cho người dùng.

## 🔄 Kết Nối Cơ Sở Dữ Liệu

Ứng dụng kết nối với MongoDB Atlas bằng thông tin xác thực được cung cấp trong các biến môi trường. Nó thiết lập kết nối khi máy chủ khởi động và ngắt kết nối đúng cách khi máy chủ tắt.
