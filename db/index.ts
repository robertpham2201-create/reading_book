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
} catch (error) {
  console.error('[DB] Khởi tạo database thất bại:', error);
}

export default db;
