import { Router, Request, Response } from 'express';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getProjectRoot } from '../../../db/index.js';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveDictDbPath(): string {
  if (process.env.DICT_DB_PATH && fs.existsSync(process.env.DICT_DB_PATH)) {
    return process.env.DICT_DB_PATH;
  }
  const root = getProjectRoot();
  const candidates = [
    path.join(root, 'db', 'dict.db'),
    path.join(root, 'backend', 'dict.db'),
    path.join(root, 'dict.db'),
    '/app/db/dict.db',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return path.join(root, 'db', 'dict.db');
}

const dictDbPath = resolveDictDbPath();

let dictDb: DatabaseSync | null = null;
try {
  if (fs.existsSync(dictDbPath)) {
    dictDb = new DatabaseSync(dictDbPath);
    dictDb.exec('CREATE INDEX IF NOT EXISTS idx_av_word ON av(word);');
    dictDb.exec('CREATE INDEX IF NOT EXISTS idx_av_word_lower ON av(lower(word));');
    console.log('[Dictionary] Đã kết nối cơ sở dữ liệu từ điển Anh - Việt (108.000+ từ) tại:', dictDbPath);
  } else {
    console.warn('[Dictionary] Không tìm thấy dict.db tại:', dictDbPath);
  }
} catch (err) {
  console.error('[Dictionary] Lỗi kết nối dict.db:', err);
}

// Hàm tìm từ vựng thông minh (hỗ trợ dạng chia thì, số nhiều, -ing, -ed, -s, -ies)
function findWordInLocalDict(inputWord: string) {
  if (!dictDb) return null;

  const clean = inputWord.toLowerCase().trim().replace(/[^a-z'-]/g, '');
  if (!clean) return null;

  const stmt = dictDb.prepare('SELECT word, pronounce, description, html FROM av WHERE word = ? OR lower(word) = ? LIMIT 1');
  
  // 1. Tìm chính xác từ gốc
  let row = stmt.get(clean, clean) as any;
  if (row) return row;

  // 2. Thử các biến thể chia từ (lemmatization)
  const candidates: string[] = [];
  if (clean.endsWith('ies') && clean.length > 3) candidates.push(clean.slice(0, -3) + 'y');
  if (clean.endsWith('es') && clean.length > 3) candidates.push(clean.slice(0, -2));
  if (clean.endsWith('s') && clean.length > 2) candidates.push(clean.slice(0, -1));
  
  if (clean.endsWith('ing') && clean.length > 4) {
    candidates.push(clean.slice(0, -3)); // swimming -> swimm -> swim
    candidates.push(clean.slice(0, -3) + 'e'); // making -> make
    if (clean.length > 5 && clean[clean.length - 4] === clean[clean.length - 5]) {
      candidates.push(clean.slice(0, -4)); // running -> run
    }
  }

  if (clean.endsWith('ed') && clean.length > 3) {
    candidates.push(clean.slice(0, -2)); // walked -> walk
    candidates.push(clean.slice(0, -1)); // liked -> like
    if (clean.length > 4 && clean[clean.length - 3] === clean[clean.length - 4]) {
      candidates.push(clean.slice(0, -3)); // stopped -> stop
    }
  }

  if (clean.endsWith('ly') && clean.length > 3) candidates.push(clean.slice(0, -2));

  for (const c of candidates) {
    row = stmt.get(c, c) as any;
    if (row) return row;
  }

  return null;
}

// Tra từ nhanh 1 chạm (Offline SQLite < 1ms, 108.000+ từ Anh-Việt đầy đủ phiên âm, nghĩa, cách dùng)
router.get('/dict/:word', (req: Request, res: Response) => {
  const rawWord = req.params.word;
  const entry = findWordInLocalDict(rawWord);

  if (entry) {
    let cleanPronounce = (entry.pronounce || '').trim();
    if (cleanPronounce && !cleanPronounce.startsWith('/')) {
      cleanPronounce = `/${cleanPronounce}/`;
    }

    return res.json({
      success: true,
      word: entry.word,
      ipa: cleanPronounce,
      description: entry.description || '',
      html: entry.html || '',
    });
  }

  // Trường hợp không tìm thấy từ trong kho 108k từ
  const cleanWord = rawWord.trim().toLowerCase().replace(/[^a-z'-]/g, '');
  return res.json({
    success: false,
    word: cleanWord,
    ipa: `/${cleanWord}/`,
    description: 'Chưa có trong từ điển Anh - Việt cục bộ.',
    html: `<p>Không tìm thấy định nghĩa cho từ <strong>${cleanWord}</strong> trong từ điển chuẩn.</p>`,
  });
});

// Phân tích cụm từ & câu ngữ cảnh bằng AI (Xiaomi MiMo v2.5 từ .env)
router.post('/explain', async (req: Request, res: Response) => {
  const { selectedText, context, bookTitle } = req.body;

  if (!selectedText) {
    return res.status(400).json({ error: 'Vui lòng chọn cụm từ hoặc câu cần hỏi' });
  }

  const cleanSelected = String(selectedText).trim();
  // Sử dụng đúng đoạn văn chứa câu văn được gửi từ frontend
  const paragraphContext = String(context || cleanSelected).trim().slice(0, 1000);

  const apiKey = process.env.xiaomi_api || process.env.GEMINI_API_KEY;
  const baseUrl = process.env.xiaomi_url || 'https://token-plan-sgp.xiaomimimo.com/v1';
  const model = process.env.xiaomi_model || 'mimo-v2.5';

  if (!apiKey) {
    return res.status(500).json({
      error: 'Chưa cấu hình API Key trong file .env trên server.',
    });
  }

  // Prompt ngắn gọn, súc tích, đi thẳng vào trọng tâm
  const systemPrompt = `Bạn là trợ lý dịch và phân tích ngữ cảnh tiếng Anh sang tiếng Việt.
Trả về DUY NHẤT một chuỗi JSON hợp lệ theo đúng cấu trúc sau (không kèm markdown hay chữ nào bên ngoài):
{
  "translation": "Bản dịch tiếng Việt tự nhiên, thoát ý chuẩn theo ngữ cảnh",
  "why": "Giải thích ngắn gọn sắc thái hoặc lý do dịch như vậy",
  "grammarAndIdioms": [
    {
      "element": "từ vựng / cụm từ / thành ngữ nổi bật",
      "explanation": "nghĩa ngắn gọn và cách dùng"
    }
  ]
}`;

  const userPrompt = `Đoạn văn ngữ cảnh: "${paragraphContext}"
Câu/cụm từ cần giải thích: "${cleanSelected}"`;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 800,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return res.status(response.status).json({
        error: `Lỗi kết nối AI (${response.status}): ${errText || response.statusText}`,
      });
    }

    const resultData: any = await response.json();
    const rawContent = (resultData.choices?.[0]?.message?.content || '').trim();

    let parsedResult: any = null;

    // 1. Thử parse trực tiếp JSON sau khi bóc tách code block
    try {
      const cleanJson = rawContent
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      parsedResult = JSON.parse(cleanJson);
    } catch (_) {
      // 2. Fallback trích xuất bằng regex nếu JSON bị cắt cụt hoặc thừa ký tự
      const transMatch = rawContent.match(/"translation"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
      const whyMatch = rawContent.match(/"why"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);

      const grammarItems: Array<{ element: string; explanation: string }> = [];
      const itemRegex = /"element"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*,\s*"explanation"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g;
      let m;
      while ((m = itemRegex.exec(rawContent)) !== null) {
        grammarItems.push({
          element: m[1].replace(/\\"/g, '"'),
          explanation: m[2].replace(/\\"/g, '"'),
        });
      }

      if (transMatch) {
        parsedResult = {
          translation: transMatch[1].replace(/\\"/g, '"'),
          why: whyMatch ? whyMatch[1].replace(/\\"/g, '"') : 'Đã phân tích dựa trên ngữ cảnh đoạn văn.',
          grammarAndIdioms: grammarItems,
        };
      } else {
        // Nếu không có cả JSON, làm sạch chuỗi thô để hiển thị làm bản dịch
        const sanitized = rawContent.replace(/[{}[\]"]/g, ' ').replace(/\s+/g, ' ').trim();
        parsedResult = {
          translation: sanitized || cleanSelected,
          why: 'Đã phân tích dựa trên ngữ cảnh câu văn.',
          grammarAndIdioms: [],
        };
      }
    }

    return res.json({
      success: true,
      data: parsedResult,
    });
  } catch (error: any) {
    console.error('[AI] Lỗi xử lý:', error);
    return res.status(500).json({ error: 'Lỗi gọi AI: ' + error.message });
  }
});

export default router;
