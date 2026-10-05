# Kindle English Reader 📖

Ứng dụng web đọc sách tiếng Anh phong cách Kindle tích hợp Từ điển Anh - Việt offline (108.000+ từ) và AI phân tích ngữ cảnh, hỗ trợ định dạng EPUB, TXT và PDF.

## ✨ Tính năng nổi bật

- **Trải nghiệm đọc phong cách Kindle**:
  - Giao diện tối giản, thanh lịch với 4 theme màu (Sepia, Light, Dark, Black).
  - Tùy chỉnh kích thước font chữ, font chữ chuyên đọc sách (Bookerly, Merriweather, Georgia, Sans).
  - Thanh header tối giản dính sát mép trên, bookmark ở giữa, không che chữ trên di động.
  - Phân trang thông minh cho file TXT và PDF, loại bỏ rác số trang và khoảng trắng thừa.
  - Chuyển trang mượt mà với 2 nút chân trang gọn gàng.
- **Tự động cuộn trang (Auto-scroll)**:
  - Tự động cuộn trang êm ái với 7 mức tốc độ (từ siêu chậm 7px/s đến rất nhanh 165px/s).
  - Tạm dừng 10 giây ở đầu trang mới để người đọc đọc phần đầu trang một cách tự nhiên.
- **Tra từ 1 chạm & Phân tích ngữ cảnh AI**:
  - Chạm 2 lần vào từ để tra từ điển Anh - Việt offline tức thì (< 1ms từ SQLite local).
  - Bôi đen cụm từ / câu để nghe phát âm và bấm **Hỏi AI** để giải thích ngữ cảnh, ngữ pháp và thành ngữ.
- **Kho từ vựng (Vocabulary Bank)**:
  - Nút "+ Lưu vào kho" trực tiếp khi tra từ đơn hoặc cụm từ.
  - Quản lý kho từ vựng đã lưu, tìm kiếm, nghe phát âm và xem lại câu ngữ cảnh trong sách.
- **Hỗ trợ URL Hash Routing (`#/book/:id`)**:
  - Tự động lưu tiến độ đọc và mở lại chính xác cuốn sách đang đọc khi mở lại ứng dụng hoặc chuyển ứng dụng trên điện thoại.
  - Hỗ trợ nút Back / Forward tự nhiên trên trình duyệt điện thoại và máy tính.

## 🛠️ Công nghệ sử dụng

- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite, Lucide Icons, ePub.js.
- **Backend**: Node.js, Express, TypeScript, SQLite (`node:sqlite`), `pdf-parse`, Multer.
- **Cơ sở dữ liệu**: SQLite (lưu trữ sách, người dùng, tiến độ đọc, bookmark, kho từ vựng và từ điển 108.000+ từ).

## 🚀 Hướng dẫn cài đặt & Chạy ứng dụng

1. **Clone repository**:
   ```bash
   git clone https://github.com/robertpham2201-create/reading_book.git
   cd reading_book
   ```

2. **Cài đặt dependencies**:
   ```bash
   npm install
   npm run install:all
   ```

3. **Cấu hình môi trường**:
   Tạo file `.env` từ `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Cập nhật `xiaomi_api` (hoặc API key AI tương thích OpenAI) nếu muốn sử dụng tính năng Hỏi AI ngữ cảnh.

4. **Khởi chạy ứng dụng**:
   ```bash
   npm run dev
   ```
   - Frontend chạy tại: `http://localhost:5173`
   - Backend chạy tại: `http://localhost:3001`
