import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { getProjectRoot } from '../../db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = getProjectRoot();

// Nạp file .env từ thư mục gốc
dotenv.config({ path: path.join(rootDir, '.env') });
dotenv.config(); // Fallback thư mục hiện tại

import authRoutes from './routes/auth.js';
import bookRoutes from './routes/books.js';
import aiRoutes from './routes/ai.js';
import vocabularyRoutes from './routes/vocabulary.js';
import '../../db/index.js'; // Khởi tạo database

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads sách
const uploadsDir = path.join(rootDir, 'backend', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/vocabulary', vocabularyRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    hasEnvApi: !!(process.env.xiaomi_api || process.env.GEMINI_API_KEY),
    time: new Date().toISOString()
  });
});

// Production: Phục vụ frontend built files nếu có (cho Dokploy/Docker deployment)
const frontendDist = path.join(rootDir, 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  // Static assets có hash (ví dụ /assets/index-xxx.js) thì browser cache an toàn,
  // nhưng index.html thì TUYỆT ĐỐI KHÔNG CACHE để điện thoại luôn load ngay code mới nhất sau khi deploy
  app.use(express.static(frontendDist, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }
  }));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`[Backend Server] Đang chạy tại http://localhost:${PORT}`);
  console.log(`[Backend Server] AI Model: ${process.env.xiaomi_model || 'mimo-v2.5'}`);
});
