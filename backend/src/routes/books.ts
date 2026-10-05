import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PDFParse } from 'pdf-parse';
import db, { getProjectRoot, getUploadsDir } from '../../../db/index.js';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = getUploadsDir();

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Cấu hình Multer lưu file sách (.epub, .txt, .pdf)
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.epub' || ext === '.txt' || ext === '.pdf') {
      cb(null, true);
    } else {
      cb(new Error('Chỉ hỗ trợ file sách định dạng .epub, .txt hoặc .pdf'));
    }
  },
});

// Lấy danh sách sách của user
router.get('/', (req: Request, res: Response) => {
  const userId = req.query.userId;
  if (!userId) {
    return res.status(400).json({ error: 'Thiếu userId' });
  }

  try {
    const books = db.prepare(`
      SELECT id, user_id, title, author, format, current_location, progress_percent, last_read_at, created_at
      FROM books
      WHERE user_id = ?
      ORDER BY last_read_at DESC, id DESC
    `).all(Number(userId));

    return res.json({ success: true, books });
  } catch (error: any) {
    console.error('[Books] Lỗi lấy danh sách sách:', error);
    return res.status(500).json({ error: 'Không thể lấy danh sách sách' });
  }
});

// Lấy thông tin chi tiết 1 cuốn sách
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.query.userId;
  if (!userId) {
    return res.status(400).json({ error: 'Thiếu userId' });
  }

  try {
    const book = db.prepare(`
      SELECT id, user_id, title, author, format, current_location, progress_percent, last_read_at, created_at
      FROM books
      WHERE id = ? AND user_id = ?
    `).get(Number(id), Number(userId)) as any;

    if (!book) {
      return res.status(404).json({ error: 'Không tìm thấy sách' });
    }

    return res.json({ success: true, book });
  } catch (error: any) {
    console.error('[Books] Lỗi lấy thông tin sách:', error);
    return res.status(500).json({ error: 'Không thể lấy thông tin sách' });
  }
});

// Upload sách mới (.epub, .txt hoặc .pdf)
router.post('/upload', upload.single('bookFile'), async (req: Request, res: Response) => {
  const userId = req.body.userId;
  const file = req.file;

  if (!userId || !file) {
    return res.status(400).json({ error: 'Vui lòng chọn file sách và thông tin người dùng' });
  }

  try {
    const ext = path.extname(file.originalname).toLowerCase();
    const originalNameWithoutExt = path.basename(file.originalname, ext);
    let format: 'epub' | 'txt' = ext === '.epub' ? 'epub' : 'txt';
    let title = req.body.title || originalNameWithoutExt;
    let author = req.body.author || 'Tác giả chưa rõ';
    let textContent: string | null = null;
    let fileBuffer: Buffer | null = null;

    // 1. Xử lý file PDF: Bóc tách text và lưu vào DB, xoá file tạm
    if (ext === '.pdf') {
      try {
        const pdfBuffer = fs.readFileSync(file.path);
        const parser = new PDFParse({ data: pdfBuffer });
        const textResult = await parser.getText();
        const infoResult = await parser.getInfo().catch(() => null);
        await parser.destroy();

        const extractedText = textResult?.text ? textResult.text.trim() : '';

        if (!extractedText) {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
          return res.status(400).json({
            error: 'File PDF này không trích xuất được chữ (có thể là file scan hình ảnh hoàn toàn). Vui lòng chọn file PDF có văn bản để đọc.'
          });
        }

        textContent = extractedText
          .replace(/\r\n/g, '\n')
          .replace(/\n*--\s*\d+\s+of\s+\d+\s*--\n*/gi, '\n\n')
          .replace(/\n\s*-\s*\d+\s*-\s*\n/g, '\n\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        format = 'txt';

        // Lấy title/author từ PDF metadata nếu có
        if (infoResult && (infoResult as any).info) {
          const info = (infoResult as any).info;
          if (info.Title && typeof info.Title === 'string' && info.Title.trim() && !req.body.title) {
            title = info.Title.trim();
          }
          if (info.Author && typeof info.Author === 'string' && info.Author.trim() && !req.body.author) {
            author = info.Author.trim();
          }
        }
      } catch (pdfErr: any) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        console.error('[Books] Lỗi bóc tách PDF:', pdfErr);
        return res.status(400).json({
          error: 'Lỗi bóc tách PDF: ' + (pdfErr.message || 'Không thể đọc nội dung file PDF')
        });
      }
    } else if (ext === '.txt') {
      // 2. Xử lý file TXT: Đọc nội dung text vào DB
      textContent = fs.readFileSync(file.path, 'utf-8');
      format = 'txt';
    } else if (ext === '.epub') {
      // 3. Xử lý file EPUB: Đọc binary buffer lưu vào BLOB trong DB
      fileBuffer = fs.readFileSync(file.path);
      format = 'epub';
    }

    // Xoá file upload tạm thời trên đĩa cứng ngay lập tức
    if (fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch (unlinkErr) {
        console.warn('[Books] Không thể xoá file tạm:', unlinkErr);
      }
    }

    // Lưu trực tiếp nội dung sách vào bảng books trong SQLite
    const insertBook = db.prepare(`
      INSERT INTO books (user_id, title, author, file_path, format, content, file_data, current_location, progress_percent)
      VALUES (?, ?, ?, '', ?, ?, ?, '', 0)
    `);

    const result = insertBook.run(
      Number(userId),
      title,
      author,
      format,
      textContent || null,
      fileBuffer || null
    );

    return res.json({
      success: true,
      book: {
        id: Number(result.lastInsertRowid),
        user_id: Number(userId),
        title,
        author,
        format,
        current_location: '',
        progress_percent: 0,
      }
    });
  } catch (error: any) {
    console.error('[Books] Lỗi upload sách:', error);
    return res.status(500).json({ error: 'Lỗi tải sách: ' + error.message });
  }
});

// Lấy thông tin & nội dung file sách (đọc trực tiếp từ SQLite)
router.get('/:id/file', (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.query.userId;

  try {
    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(Number(id)) as any;
    if (!book) {
      return res.status(404).json({ error: 'Không tìm thấy sách' });
    }

    if (userId && Number(book.user_id) !== Number(userId)) {
      return res.status(403).json({ error: 'Bạn không có quyền truy cập cuốn sách này' });
    }

    // 1. Nếu là TXT, trả về text từ DB (hoặc đọc file_path nếu là sách cũ)
    if (book.format === 'txt') {
      let content = book.content;
      if (!content && book.file_path && fs.existsSync(book.file_path)) {
        content = fs.readFileSync(book.file_path, 'utf-8');
      }

      if (content === undefined || content === null) {
        return res.status(404).json({ error: 'Nội dung sách không tồn tại' });
      }

      return res.json({
        id: book.id,
        title: book.title,
        author: book.author,
        format: book.format,
        current_location: book.current_location,
        progress_percent: book.progress_percent,
        content,
      });
    }

    // 2. Nếu là EPUB, gửi binary buffer từ DB (hoặc stream file_path nếu là sách cũ)
    if (book.file_data) {
      res.setHeader('Content-Type', 'application/epub+zip');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(book.title)}.epub"`);
      return res.send(Buffer.from(book.file_data));
    } else if (book.file_path && fs.existsSync(book.file_path)) {
      res.setHeader('Content-Type', 'application/epub+zip');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(book.title)}.epub"`);
      const stream = fs.createReadStream(book.file_path);
      return stream.pipe(res);
    } else {
      return res.status(404).json({ error: 'File sách EPUB không tồn tại trên hệ thống' });
    }
  } catch (error: any) {
    console.error('[Books] Lỗi đọc file sách:', error);
    return res.status(500).json({ error: 'Không thể đọc file sách' });
  }
});

// Cập nhật tiến độ đọc sách
router.post('/:id/progress', (req: Request, res: Response) => {
  const { id } = req.params;
  const { currentLocation, progressPercent } = req.body;

  try {
    db.prepare(`
      UPDATE books
      SET current_location = ?,
          progress_percent = ?,
          last_read_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(String(currentLocation || ''), Number(progressPercent || 0), Number(id));

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[Books] Lỗi lưu tiến độ:', error);
    return res.status(500).json({ error: 'Không thể lưu tiến độ' });
  }
});

// Xóa sách
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.query.userId;

  try {
    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(Number(id)) as any;
    if (!book) {
      return res.status(404).json({ error: 'Không tìm thấy sách' });
    }

    if (userId && Number(book.user_id) !== Number(userId)) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa cuốn sách này' });
    }

    // Chỉ xóa file nếu nằm trong uploads (không xóa sample_books)
    if (book.file_path.includes('uploads') && fs.existsSync(book.file_path)) {
      try {
        fs.unlinkSync(book.file_path);
      } catch (err) {
        console.warn('Không thể xóa file vật lý:', err);
      }
    }

    db.prepare('DELETE FROM books WHERE id = ?').run(Number(id));
    return res.json({ success: true });
  } catch (error: any) {
    console.error('[Books] Lỗi xóa sách:', error);
    return res.status(500).json({ error: 'Không thể xóa sách' });
  }
});

// Lấy danh sách bookmark của sách
router.get('/:id/bookmarks', (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'Thiếu userId' });

  try {
    const bookmarks = db.prepare(`
      SELECT id, user_id, book_id, page_index, title, excerpt, created_at
      FROM bookmarks
      WHERE book_id = ? AND user_id = ?
      ORDER BY page_index ASC
    `).all(Number(id), Number(userId));

    return res.json({ success: true, bookmarks });
  } catch (err: any) {
    return res.status(500).json({ error: 'Lỗi tải bookmark: ' + err.message });
  }
});

// Thêm / hủy bookmark trang (toggle)
router.post('/:id/bookmarks/toggle', (req: Request, res: Response) => {
  const { id } = req.params;
  const { userId, pageIndex, title, excerpt } = req.body;
  if (!userId || pageIndex === undefined) return res.status(400).json({ error: 'Thiếu thông tin bookmark' });

  try {
    const existing = db.prepare(`
      SELECT id FROM bookmarks WHERE book_id = ? AND user_id = ? AND page_index = ?
    `).get(Number(id), Number(userId), Number(pageIndex)) as { id: number } | undefined;

    let bookmarked = false;
    if (existing) {
      db.prepare('DELETE FROM bookmarks WHERE id = ?').run(existing.id);
      bookmarked = false;
    } else {
      db.prepare(`
        INSERT INTO bookmarks (user_id, book_id, page_index, title, excerpt)
        VALUES (?, ?, ?, ?, ?)
      `).run(Number(userId), Number(id), Number(pageIndex), title || `Trang ${Number(pageIndex) + 1}`, excerpt || '');
      bookmarked = true;
    }

    const bookmarks = db.prepare(`
      SELECT id, user_id, book_id, page_index, title, excerpt, created_at
      FROM bookmarks
      WHERE book_id = ? AND user_id = ?
      ORDER BY page_index ASC
    `).all(Number(id), Number(userId));

    return res.json({ success: true, bookmarked, bookmarks });
  } catch (err: any) {
    return res.status(500).json({ error: 'Lỗi lưu bookmark: ' + err.message });
  }
});

export default router;
