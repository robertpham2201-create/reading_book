import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Nạp file .env từ thư mục gốc reading_book/.env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
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

// Static uploads
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Routes
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

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`[Backend Server] Đang chạy tại http://localhost:${PORT}`);
  console.log(`[Backend Server] AI Model: ${process.env.xiaomi_model || 'mimo-v2.5'}`);
});
