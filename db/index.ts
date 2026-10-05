import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tìm thư mục gốc của dự án (nơi chứa package.json và backend)
export function getProjectRoot(): string {
  let curr = path.resolve(__dirname);
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(curr, 'package.json')) && fs.existsSync(path.join(curr, 'backend'))) {
      return curr;
    }
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }
  return process.cwd();
}

const rootDir = getProjectRoot();

// Cấu hình đường dẫn lưu trữ dữ liệu bền vững (Persistent Storage)
export function getDbDir(): string {
  if (process.env.DB_DIR) return process.env.DB_DIR;
  if (process.env.DATA_DIR) return path.join(process.env.DATA_DIR, 'db');
  return path.join(rootDir, 'db');
}

export function getDbPath(): string {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  return path.join(getDbDir(), 'reader.db');
}

export function getUploadsDir(): string {
  if (process.env.UPLOADS_DIR) return process.env.UPLOADS_DIR;
  if (process.env.DATA_DIR) return path.join(process.env.DATA_DIR, 'uploads');
  return path.join(rootDir, 'backend', 'uploads');
}

const dbDir = getDbDir();
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const uploadsDir = getUploadsDir();
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dbPath = getDbPath();
export const db = new DatabaseSync(dbPath);

const DEFAULT_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    api_key TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    author TEXT DEFAULT 'Unknown',
    file_path TEXT DEFAULT '',
    format TEXT NOT NULL CHECK(format IN ('epub', 'txt')),
    content TEXT,
    file_data BLOB,
    current_location TEXT DEFAULT '',
    progress_percent REAL DEFAULT 0,
    last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_settings (
    user_id INTEGER PRIMARY KEY,
    theme TEXT DEFAULT 'sepia',
    font_size INTEGER DEFAULT 18,
    font_family TEXT DEFAULT 'Bookerly',
    line_height REAL DEFAULT 1.6,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    page_index INTEGER NOT NULL,
    title TEXT DEFAULT '',
    excerpt TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vocabularies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    book_id INTEGER,
    word TEXT NOT NULL,
    ipa TEXT DEFAULT '',
    meaning TEXT NOT NULL,
    sentence_context TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_vocab_user ON vocabularies(user_id);
CREATE INDEX IF NOT EXISTS idx_vocab_word ON vocabularies(user_id, lower(word));
`;

// Kích hoạt foreign keys và WAL mode để hiệu năng cao
try {
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');
  
  const schemaPath = path.join(rootDir, 'db', 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schemaSql);
  } else {
    db.exec(DEFAULT_SCHEMA_SQL);
  }

  // Tự động migrate thêm cột content và file_data cho cơ sở dữ liệu cũ
  try { db.exec('ALTER TABLE books ADD COLUMN content TEXT;'); } catch (_) {}
  try { db.exec('ALTER TABLE books ADD COLUMN file_data BLOB;'); } catch (_) {}

  // Tự động khởi tạo tài khoản admin mặc định nếu chưa tồn tại
  const adminUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin') as { id: number } | undefined;
  if (!adminUser) {
    const res = db.prepare('INSERT INTO users (username, password, api_key) VALUES (?, ?, ?)').run('admin', '123', '');
    const adminId = Number(res.lastInsertRowid);

    db.prepare(`
      INSERT OR IGNORE INTO user_settings (user_id, theme, font_size, font_family, line_height)
      VALUES (?, 'sepia', 18, 'Bookerly', 1.6)
    `).run(adminId);

    const sampleBooksDir = path.join(rootDir, 'backend', 'sample_books');
    const princePath = path.join(sampleBooksDir, 'the_little_prince.txt');
    const sherlockPath = path.join(sampleBooksDir, 'sherlock_holmes.txt');

    const princeContent = fs.existsSync(princePath) ? fs.readFileSync(princePath, 'utf-8') : '';
    const sherlockContent = fs.existsSync(sherlockPath) ? fs.readFileSync(sherlockPath, 'utf-8') : '';

    const insertBook = db.prepare(`
      INSERT INTO books (user_id, title, author, file_path, format, content, current_location, progress_percent)
      VALUES (?, ?, ?, ?, ?, ?, '', 0)
    `);

    if (princeContent) {
      insertBook.run(adminId, 'The Little Prince', 'Antoine de Saint-Exupéry', princePath, 'txt', princeContent);
    }
    if (sherlockContent) {
      insertBook.run(adminId, 'Sherlock Holmes - A Scandal in Bohemia', 'Arthur Conan Doyle', sherlockPath, 'txt', sherlockContent);
    }
    console.log('[DB] Đã tự động tạo tài khoản mặc định: admin / 123');
  }
} catch (error) {
  console.error('[DB] Khởi tạo database thất bại:', error);
}

export default db;
