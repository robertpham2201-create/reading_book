import { Router, Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import db from '../../../db/index.js';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sampleBooksDir = path.resolve(__dirname, '../../sample_books');

// Đăng ký tài khoản
router.post('/register', (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu' });
  }

  const cleanUsername = String(username).trim();
  const cleanPassword = String(password).trim();

  if (cleanUsername.length < 2) {
    return res.status(400).json({ error: 'Tên đăng nhập phải có ít nhất 2 ký tự' });
  }

  try {
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername) as { id: number } | undefined;
    if (existing) {
      return res.status(400).json({ error: 'Tên đăng nhập này đã tồn tại, vui lòng chọn tên khác hoặc đăng nhập' });
    }

    const insertUser = db.prepare('INSERT INTO users (username, password, api_key) VALUES (?, ?, ?)');
    const result = insertUser.run(cleanUsername, cleanPassword, '');
    const userId = Number(result.lastInsertRowid);

    // Tạo thiết lập giao diện mặc định
    db.prepare(`
      INSERT INTO user_settings (user_id, theme, font_size, font_family, line_height)
      VALUES (?, 'sepia', 18, 'Bookerly', 1.6)
    `).run(userId);

    // Tự động tặng 2 cuốn sách mẫu vào thư viện của user này (lưu trực tiếp nội dung vào DB)
    const princePath = path.join(sampleBooksDir, 'the_little_prince.txt');
    const sherlockPath = path.join(sampleBooksDir, 'sherlock_holmes.txt');
    const princeContent = fs.existsSync(princePath) ? fs.readFileSync(princePath, 'utf-8') : '';
    const sherlockContent = fs.existsSync(sherlockPath) ? fs.readFileSync(sherlockPath, 'utf-8') : '';

    const insertBook = db.prepare(`
      INSERT INTO books (user_id, title, author, file_path, format, content, current_location, progress_percent)
      VALUES (?, ?, ?, ?, ?, ?, '', 0)
    `);

    if (princeContent) {
      insertBook.run(
        userId,
        'The Little Prince',
        'Antoine de Saint-Exupéry',
        princePath,
        'txt',
        princeContent
      );
    }

    if (sherlockContent) {
      insertBook.run(
        userId,
        'Sherlock Holmes - A Scandal in Bohemia',
        'Arthur Conan Doyle',
        sherlockPath,
        'txt',
        sherlockContent
      );
    }

    return res.json({
      success: true,
      user: {
        id: userId,
        username: cleanUsername,
        apiKey: '',
      },
      settings: {
        theme: 'sepia',
        fontSize: 18,
        fontFamily: 'Bookerly',
        lineHeight: 1.6,
      }
    });
  } catch (error: any) {
    console.error('[Auth] Lỗi đăng ký:', error);
    return res.status(500).json({ error: 'Lỗi máy chủ khi đăng ký: ' + error.message });
  }
});

// Đăng nhập
router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập và mật khẩu' });
  }

  const cleanUsername = String(username).trim();
  const cleanPassword = String(password).trim();

  try {
    const user = db.prepare('SELECT id, username, password, api_key FROM users WHERE username = ?').get(cleanUsername) as {
      id: number;
      username: string;
      password: string;
      api_key: string;
    } | undefined;

    if (!user || user.password !== cleanPassword) {
      return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' });
    }

    let settings = db.prepare('SELECT theme, font_size, font_family, line_height FROM user_settings WHERE user_id = ?').get(user.id) as any;
    if (!settings) {
      db.prepare(`
        INSERT INTO user_settings (user_id, theme, font_size, font_family, line_height)
        VALUES (?, 'sepia', 18, 'Bookerly', 1.6)
      `).run(user.id);
      settings = { theme: 'sepia', font_size: 18, font_family: 'Bookerly', line_height: 1.6 };
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        apiKey: user.api_key || '',
      },
      settings: {
        theme: settings.theme || 'sepia',
        fontSize: settings.font_size || 18,
        fontFamily: settings.font_family || 'Bookerly',
        lineHeight: settings.line_height || 1.6,
      }
    });
  } catch (error: any) {
    console.error('[Auth] Lỗi đăng nhập:', error);
    return res.status(500).json({ error: 'Lỗi máy chủ: ' + error.message });
  }
});

// Cập nhật Gemini API Key
router.post('/api-key', (req: Request, res: Response) => {
  const { userId, apiKey } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'Thiếu thông tin người dùng' });
  }

  try {
    db.prepare('UPDATE users SET api_key = ? WHERE id = ?').run(String(apiKey || '').trim(), Number(userId));
    return res.json({ success: true, apiKey: String(apiKey || '').trim() });
  } catch (error: any) {
    console.error('[Auth] Lỗi cập nhật API Key:', error);
    return res.status(500).json({ error: 'Không thể cập nhật API Key' });
  }
});

// Cập nhật cài đặt giao diện đọc sách
router.post('/settings', (req: Request, res: Response) => {
  const { userId, theme, fontSize, fontFamily, lineHeight } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'Thiếu thông tin người dùng' });
  }

  try {
    const existing = db.prepare('SELECT user_id FROM user_settings WHERE user_id = ?').get(Number(userId));
    if (existing) {
      db.prepare(`
        UPDATE user_settings
        SET theme = COALESCE(?, theme),
            font_size = COALESCE(?, font_size),
            font_family = COALESCE(?, font_family),
            line_height = COALESCE(?, line_height)
        WHERE user_id = ?
      `).run(theme, fontSize, fontFamily, lineHeight, Number(userId));
    } else {
      db.prepare(`
        INSERT INTO user_settings (user_id, theme, font_size, font_family, line_height)
        VALUES (?, ?, ?, ?, ?)
      `).run(Number(userId), theme || 'sepia', fontSize || 18, fontFamily || 'Bookerly', lineHeight || 1.6);
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[Auth] Lỗi lưu settings:', error);
    return res.status(500).json({ error: 'Lỗi khi lưu cài đặt' });
  }
});

export default router;
