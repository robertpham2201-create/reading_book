import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tìm thư mục gốc của dự án (nơi chứa file db/schema.sql)
export function getProjectRoot(): string {
  let curr = path.resolve(__dirname);
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(curr, 'db', 'schema.sql'))) {
      return curr;
    }
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }
  return process.cwd();
}

const rootDir = getProjectRoot();
const dbDir = path.join(rootDir, 'db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Đường dẫn file SQLite reader.db trong thư mục db/
const dbPath = path.join(dbDir, 'reader.db');
const schemaPath = path.join(dbDir, 'schema.sql');

export const db = new DatabaseSync(dbPath);

// Kích hoạt foreign keys và WAL mode để hiệu năng cao
try {
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');
  
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schemaSql);
  }

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

    const insertBook = db.prepare(`
      INSERT INTO books (user_id, title, author, file_path, format, current_location, progress_percent)
      VALUES (?, ?, ?, ?, ?, '', 0)
    `);

    if (fs.existsSync(princePath)) {
      insertBook.run(adminId, 'The Little Prince', 'Antoine de Saint-Exupéry', princePath, 'txt');
    }
    if (fs.existsSync(sherlockPath)) {
      insertBook.run(adminId, 'Sherlock Holmes - A Scandal in Bohemia', 'Arthur Conan Doyle', sherlockPath, 'txt');
    }
    console.log('[DB] Đã tự động tạo tài khoản mặc định: admin / 123');
  }
} catch (error) {
  console.error('[DB] Khởi tạo database thất bại:', error);
}

export default db;
