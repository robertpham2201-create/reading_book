import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Đường dẫn file SQLite reader.db trong thư mục db/
const dbPath = path.resolve(__dirname, 'reader.db');
const schemaPath = path.resolve(__dirname, 'schema.sql');

export const db = new DatabaseSync(dbPath);

// Kích hoạt foreign keys và WAL mode để hiệu năng cao
try {
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');
  
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schemaSql);
  }
} catch (error) {
  console.error('[DB] Khởi tạo database thất bại:', error);
}

export default db;
