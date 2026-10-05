import { User, ReadingSettings, Book, WordData, AIExplanationData, VocabularyItem } from '../types';

const API_BASE = '/api';

export async function registerUser(username: string, password: string): Promise<{ user: User; settings: ReadingSettings }> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Đăng ký thất bại');
  return data;
}

export async function loginUser(username: string, password: string): Promise<{ user: User; settings: ReadingSettings }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Đăng nhập thất bại');
  return data;
}

export async function saveUserSettings(userId: number, settings: Partial<ReadingSettings>): Promise<void> {
  await fetch(`${API_BASE}/auth/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      theme: settings.theme,
      fontSize: settings.fontSize,
      fontFamily: settings.fontFamily,
      lineHeight: settings.lineHeight,
    }),
  });
}

export async function fetchUserBooks(userId: number): Promise<Book[]> {
  const res = await fetch(`${API_BASE}/books?userId=${userId}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Lỗi tải danh sách sách');
  return data.books || [];
}

export async function fetchBookById(bookId: number, userId: number): Promise<Book> {
  const res = await fetch(`${API_BASE}/books/${bookId}?userId=${userId}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Không tìm thấy sách');
  return data.book;
}

export async function uploadBookFile(userId: number, file: File, title?: string, author?: string): Promise<Book> {
  const formData = new FormData();
  formData.append('userId', String(userId));
  formData.append('bookFile', file);
  if (title) formData.append('title', title);
  if (author) formData.append('author', author);

  const res = await fetch(`${API_BASE}/books/upload`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Lỗi tải sách lên');
  return data.book;
}

export async function fetchBookContent(bookId: number, userId: number): Promise<any> {
  const res = await fetch(`${API_BASE}/books/${bookId}/file?userId=${userId}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Lỗi nạp file sách');
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await res.json();
  }
  return await res.arrayBuffer();
}

export async function updateReadingProgress(bookId: number, currentLocation: string, progressPercent: number): Promise<void> {
  await fetch(`${API_BASE}/books/${bookId}/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentLocation, progressPercent }),
  });
}

export async function deleteUserBook(bookId: number, userId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/books/${bookId}?userId=${userId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Không thể xóa sách');
  }
}

export async function fetchBookmarks(bookId: number, userId: number): Promise<any[]> {
  const res = await fetch(`${API_BASE}/books/${bookId}/bookmarks?userId=${userId}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Lỗi tải bookmarks');
  return data.bookmarks || [];
}

export async function toggleBookmark(
  bookId: number,
  userId: number,
  pageIndex: number,
  title?: string,
  excerpt?: string
): Promise<{ bookmarked: boolean; bookmarks: any[] }> {
  const res = await fetch(`${API_BASE}/books/${bookId}/bookmarks/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, pageIndex, title, excerpt }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Lỗi đánh dấu trang');
  return data;
}

// Tra từ nhanh tức thì (< 1ms từ SQLite local Anh - Việt)
export async function lookupWordInDictionary(word: string): Promise<WordData> {
  const clean = word.trim().toLowerCase().replace(/[^a-z'-]/g, '');
  const res = await fetch(`${API_BASE}/ai/dict/${encodeURIComponent(clean)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Không tìm thấy từ trong từ điển');
  }
  return await res.json();
}

// Hỏi AI chỉ dùng khi bôi đen cụm từ hoặc câu văn
export async function askAIContextExplainer(params: {
  selectedText: string;
  context: string;
  bookTitle?: string;
}): Promise<AIExplanationData> {
  const res = await fetch(`${API_BASE}/ai/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Lỗi phân tích AI');
  }
  return data.data;
}

// Lấy danh sách từ vựng trong kho của người dùng
export async function fetchVocabulary(userId: number): Promise<VocabularyItem[]> {
  const res = await fetch(`${API_BASE}/vocabulary?userId=${userId}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Lỗi tải kho từ vựng');
  return data.vocabularies || [];
}

// Kiểm tra xem từ/cụm từ đã có trong kho chưa
export async function checkVocabularyWord(userId: number, word: string): Promise<{ isSaved: boolean; item?: VocabularyItem }> {
  const res = await fetch(`${API_BASE}/vocabulary/check?userId=${userId}&word=${encodeURIComponent(word)}`);
  const data = await res.json();
  if (!res.ok) return { isSaved: false };
  return { isSaved: !!data.isSaved, item: data.item };
}

// Thêm hoặc cập nhật từ vựng vào kho
export async function saveVocabulary(params: {
  userId: number;
  bookId?: number | null;
  word: string;
  ipa?: string;
  meaning: string;
  sentenceContext?: string;
}): Promise<VocabularyItem> {
  const res = await fetch(`${API_BASE}/vocabulary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Lỗi lưu từ vựng');
  return data.vocabulary;
}

// Xóa từ vựng khỏi kho
export async function deleteVocabulary(id: number, userId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/vocabulary/${id}?userId=${userId}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Lỗi xóa từ vựng');
}
