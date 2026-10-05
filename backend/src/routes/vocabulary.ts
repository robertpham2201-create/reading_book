import { Router, Request, Response } from 'express';
import db from '../../../db/index.js';

const router = Router();

// Lấy danh sách từ vựng đã lưu của user
router.get('/', (req: Request, res: Response) => {
  const userId = req.query.userId;
  if (!userId) {
    return res.status(400).json({ error: 'Thiếu userId' });
  }

  try {
    const list = db.prepare(`
      SELECT v.id, v.user_id, v.book_id, v.word, v.ipa, v.meaning, v.sentence_context, v.created_at, b.title as book_title
      FROM vocabularies v
      LEFT JOIN books b ON v.book_id = b.id
      WHERE v.user_id = ?
      ORDER BY v.created_at DESC, v.id DESC
    `).all(Number(userId));

    return res.json({ success: true, vocabularies: list });
  } catch (error: any) {
    console.error('[Vocabulary] Lỗi lấy danh sách từ vựng:', error);
    return res.status(500).json({ error: 'Không thể lấy kho từ vựng' });
  }
});

// Kiểm tra xem 1 từ hoặc cụm từ đã được lưu trong kho chưa
router.get('/check', (req: Request, res: Response) => {
  const { userId, word } = req.query;
  if (!userId || !word) {
    return res.status(400).json({ error: 'Thiếu tham số userId hoặc word' });
  }

  try {
    const item = db.prepare(`
      SELECT id, word, ipa, meaning, sentence_context, created_at
      FROM vocabularies
      WHERE user_id = ? AND lower(trim(word)) = lower(trim(?))
      LIMIT 1
    `).get(Number(userId), String(word)) as any;

    return res.json({ success: true, isSaved: !!item, item: item || null });
  } catch (error: any) {
    console.error('[Vocabulary] Lỗi kiểm tra từ vựng:', error);
    return res.status(500).json({ error: 'Lỗi kiểm tra từ vựng' });
  }
});

// Thêm hoặc cập nhật từ/cụm từ vào kho từ vựng
router.post('/', (req: Request, res: Response) => {
  const { userId, bookId, word, ipa, meaning, sentenceContext } = req.body;

  if (!userId || !word || !meaning) {
    return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ thông tin từ vựng (từ và ý nghĩa)' });
  }

  const cleanWord = String(word).trim();
  const cleanMeaning = String(meaning).trim();
  const cleanIpa = String(ipa || '').trim();
  const cleanContext = String(sentenceContext || '').trim();

  try {
    // Kiểm tra xem đã có từ này chưa
    const existing = db.prepare(`
      SELECT id FROM vocabularies
      WHERE user_id = ? AND lower(trim(word)) = lower(trim(?))
      LIMIT 1
    `).get(Number(userId), cleanWord) as any;

    if (existing) {
      db.prepare(`
        UPDATE vocabularies
        SET book_id = COALESCE(?, book_id),
            ipa = CASE WHEN ? != '' THEN ? ELSE ipa END,
            meaning = ?,
            sentence_context = CASE WHEN ? != '' THEN ? ELSE sentence_context END,
            created_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        bookId ? Number(bookId) : null,
        cleanIpa, cleanIpa,
        cleanMeaning,
        cleanContext, cleanContext,
        Number(existing.id)
      );

      const updated = db.prepare('SELECT * FROM vocabularies WHERE id = ?').get(Number(existing.id));
      return res.json({ success: true, vocabulary: updated, updated: true });
    }

    const result = db.prepare(`
      INSERT INTO vocabularies (user_id, book_id, word, ipa, meaning, sentence_context)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      Number(userId),
      bookId ? Number(bookId) : null,
      cleanWord,
      cleanIpa,
      cleanMeaning,
      cleanContext
    );

    const inserted = db.prepare('SELECT * FROM vocabularies WHERE id = ?').get(Number(result.lastInsertRowid));
    return res.json({ success: true, vocabulary: inserted, created: true });
  } catch (error: any) {
    console.error('[Vocabulary] Lỗi lưu từ vựng:', error);
    return res.status(500).json({ error: 'Không thể lưu từ vựng vào kho' });
  }
});

// Xóa từ vựng khỏi kho
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ error: 'Thiếu userId' });
  }

  try {
    db.prepare(`
      DELETE FROM vocabularies
      WHERE id = ? AND user_id = ?
    `).run(Number(id), Number(userId));

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[Vocabulary] Lỗi xóa từ vựng:', error);
    return res.status(500).json({ error: 'Không thể xóa từ vựng' });
  }
});

export default router;
