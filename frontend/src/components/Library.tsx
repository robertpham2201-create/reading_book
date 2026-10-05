import React, { useEffect, useState, useRef } from 'react';
import { 
  BookOpen, 
  Upload, 
  Settings as SettingsIcon, 
  LogOut, 
  Trash2, 
  ArrowRight, 
  CheckCircle2, 
  GraduationCap, 
  Search, 
  Volume2, 
  BookmarkCheck,
  X
} from 'lucide-react';
import { Book, User, VocabularyItem } from '../types';
import { fetchUserBooks, uploadBookFile, deleteUserBook, fetchVocabulary, deleteVocabulary } from '../services/api';
import { speakWord } from '../services/tts';

interface LibraryProps {
  user: User;
  onOpenBook: (book: Book) => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export const Library: React.FC<LibraryProps> = ({
  user,
  onOpenBook,
  onOpenSettings,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'books' | 'vocabulary'>('books');
  const [books, setBooks] = useState<Book[]>([]);
  const [vocabularies, setVocabularies] = useState<VocabularyItem[]>([]);
  const [vocabSearch, setVocabSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingVocab, setLoadingVocab] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadBooks = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUserBooks(user.id);
      setBooks(data);
    } catch (err: any) {
      setError(err.message || 'Lỗi tải sách');
    } finally {
      setLoading(false);
    }
  };

  const loadVocabularies = async () => {
    setLoadingVocab(true);
    try {
      const list = await fetchVocabulary(user.id);
      setVocabularies(list);
    } catch (err: any) {
      console.error('Lỗi tải từ vựng:', err);
    } finally {
      setLoadingVocab(false);
    }
  };

  useEffect(() => {
    loadBooks();
    loadVocabularies();
  }, [user.id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const newBook = await uploadBookFile(user.id, file);
      setBooks((prev) => [newBook, ...prev]);
    } catch (err: any) {
      setError(err.message || 'Lỗi tải sách lên');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteBook = async (e: React.MouseEvent, bookId: number) => {
    e.stopPropagation();
    if (!window.confirm('Bạn có chắc chắn muốn xóa cuốn sách này khỏi thư viện?')) return;

    try {
      await deleteUserBook(bookId, user.id);
      setBooks((prev) => prev.filter((b) => b.id !== bookId));
    } catch (err: any) {
      alert(err.message || 'Không thể xóa sách');
    }
  };

  const handleDeleteVocab = async (e: React.MouseEvent, vocabId: number, word: string) => {
    e.stopPropagation();
    if (!window.confirm(`Xóa từ "${word}" khỏi kho từ vựng?`)) return;

    try {
      await deleteVocabulary(vocabId, user.id);
      setVocabularies((prev) => prev.filter((v) => v.id !== vocabId));
    } catch (err: any) {
      alert(err.message || 'Không thể xóa từ vựng');
    }
  };

  const filteredVocabularies = vocabularies.filter((v) => {
    const q = vocabSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      v.word.toLowerCase().includes(q) ||
      v.meaning.toLowerCase().includes(q) ||
      (v.sentence_context && v.sentence_context.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-[#f7f4ed] text-[#2d2926] flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-[#f7f4ed]/90 backdrop-blur-md border-b border-stone-200/80 px-4 py-3 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#2d2926] text-[#f7f4ed] flex items-center justify-center shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-serif font-bold text-lg leading-tight">Kindle English</h1>
              <span className="text-xs text-stone-500 font-sans">
                Tài khoản: <strong>{user.username}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenSettings}
              className="p-2.5 text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 rounded-xl transition-colors cursor-pointer"
              title="Cài đặt giao diện đọc"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
            <button
              onClick={onLogout}
              className="p-2.5 text-stone-500 hover:text-rose-700 hover:bg-stone-200/60 rounded-xl transition-colors cursor-pointer"
              title="Đăng xuất"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Tab Switcher: Tủ sách & Kho từ vựng */}
        <div className="flex items-center gap-2 border-b border-stone-200/80 pb-3">
          <button
            onClick={() => setActiveTab('books')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'books'
                ? 'bg-[#2d2926] text-[#f7f4ed] shadow-xs'
                : 'bg-white/80 text-stone-600 hover:bg-stone-200/60'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Tủ sách ({books.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('vocabulary');
              loadVocabularies();
            }}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'vocabulary'
                ? 'bg-amber-700 text-white shadow-xs'
                : 'bg-white/80 text-stone-600 hover:bg-stone-200/60'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Kho từ vựng ({vocabularies.length})</span>
          </button>
        </div>

        {/* TAB 1: TỦ SÁCH */}
        {activeTab === 'books' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Section Header & Upload Button */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-serif font-bold text-stone-900">Tủ sách của bạn</h2>
                <p className="text-xs text-stone-500">Lưu độc lập trên SQLite của bạn</p>
              </div>

              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".epub,.txt,.pdf"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="px-4 py-2 bg-[#2d2926] hover:bg-black text-[#f7f4ed] text-xs sm:text-sm font-medium rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  <span>{uploading ? 'Đang phân tích & tải sách...' : 'Tải sách (.epub, .txt, .pdf)'}</span>
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs">
                {error}
              </div>
            )}

            {/* Books Grid */}
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center text-stone-400 gap-3">
                <div className="w-8 h-8 border-3 border-stone-300 border-t-stone-700 rounded-full animate-spin" />
                <span className="text-xs">Đang tải tủ sách...</span>
              </div>
            ) : books.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-3xl border border-stone-200 p-8">
                <BookOpen className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                <h3 className="font-serif font-semibold text-lg text-stone-800">Tủ sách đang trống</h3>
                <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                  Hãy bấm vào nút "Tải sách (.epub, .txt, .pdf)" ở trên để nạp file sách tiếng Anh yêu thích của bạn!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {books.map((book) => {
                  const progress = Math.min(100, Math.max(0, Math.round(book.progress_percent || 0)));
                  return (
                    <div
                      key={book.id}
                      onClick={() => onOpenBook(book)}
                      className="group bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 hover:border-stone-400 transition-all shadow-xs hover:shadow-md cursor-pointer flex flex-col justify-between relative overflow-hidden"
                    >
                      <div>
                        {/* Format Badge & Delete button */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200">
                            {book.format}
                          </span>
                          <button
                            onClick={(e) => handleDeleteBook(e, book.id)}
                            className="p-1.5 text-stone-300 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                            title="Xóa sách"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Book Title & Author */}
                        <h3 className="font-serif font-bold text-base text-stone-900 group-hover:text-amber-900 transition-colors line-clamp-2 leading-snug">
                          {book.title}
                        </h3>
                        <p className="text-xs text-stone-500 mt-1 italic line-clamp-1">
                          {book.author || 'Tác giả chưa rõ'}
                        </p>
                      </div>

                      {/* Progress & Read Action */}
                      <div className="mt-5 pt-3 border-t border-stone-100">
                        <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1.5">
                          <span>Tiến độ đọc</span>
                          <span className="font-semibold text-stone-700">{progress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-700 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-xs font-semibold text-amber-800 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                            {progress > 0 ? 'Đọc tiếp' : 'Bắt đầu đọc'} <ArrowRight className="w-3.5 h-3.5" />
                          </span>
                          {progress === 100 && (
                            <span className="text-xs text-emerald-600 flex items-center gap-0.5 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Đã hoàn thành
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: KHO TỪ VỰNG */}
        {activeTab === 'vocabulary' && (
          <div className="space-y-5 animate-in fade-in duration-150">
            {/* Header & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-serif font-bold text-stone-900 flex items-center gap-2">
                  <BookmarkCheck className="w-5 h-5 text-amber-700" />
                  Kho từ vựng đã lưu
                </h2>
                <p className="text-xs text-stone-500">
                  Tổng cộng {vocabularies.length} từ & cụm từ đã thu thập khi đọc sách
                </p>
              </div>

              {/* Ô tìm kiếm từ vựng */}
              <div className="relative max-w-xs w-full">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={vocabSearch}
                  onChange={(e) => setVocabSearch(e.target.value)}
                  placeholder="Tìm từ, nghĩa, câu mẫu..."
                  className="w-full pl-9 pr-8 py-2 bg-white rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-600"
                />
                {vocabSearch && (
                  <button
                    onClick={() => setVocabSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Vocabularies List */}
            {loadingVocab ? (
              <div className="py-20 flex flex-col items-center justify-center text-stone-400 gap-3">
                <div className="w-8 h-8 border-3 border-stone-300 border-t-amber-700 rounded-full animate-spin" />
                <span className="text-xs">Đang tải kho từ vựng...</span>
              </div>
            ) : vocabularies.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-3xl border border-stone-200 p-8 space-y-2">
                <GraduationCap className="w-12 h-12 text-stone-300 mx-auto mb-2" />
                <h3 className="font-serif font-semibold text-lg text-stone-800">Kho từ vựng đang trống</h3>
                <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
                  Khi đang đọc truyện, bạn chỉ cần <strong>chạm 2 lần vào từ</strong> hoặc <strong>bôi đen cụm từ</strong> rồi bấm nút <strong>"+ Lưu vào kho"</strong> để ôn lại từ bất cứ lúc nào!
                </p>
              </div>
            ) : filteredVocabularies.length === 0 ? (
              <div className="py-12 text-center bg-white rounded-2xl border border-stone-200 p-6">
                <p className="text-xs text-stone-500">
                  Không tìm thấy từ vựng nào khớp với từ khóa "<strong>{vocabSearch}</strong>"
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredVocabularies.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 hover:border-amber-300 transition-all shadow-2xs hover:shadow-xs flex flex-col justify-between gap-3 group"
                  >
                    <div>
                      {/* Top Row: Word, IPA, Pronounce & Delete */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-serif font-bold text-stone-900 group-hover:text-amber-900 transition-colors">
                            {item.word}
                          </h3>
                          {item.ipa && (
                            <span className="text-[11px] font-mono text-amber-900 bg-amber-100/70 border border-amber-200 px-2 py-0.5 rounded-md">
                              {item.ipa}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => speakWord(item.word)}
                            className="p-1 text-stone-500 hover:text-amber-800 hover:bg-amber-100/60 rounded-full transition-colors cursor-pointer"
                            title="Nghe phát âm"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          onClick={(e) => handleDeleteVocab(e, item.id, item.word)}
                          className="p-1.5 text-stone-300 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                          title="Xóa từ vựng này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Meaning */}
                      <p className="text-xs text-stone-800 bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/50 leading-relaxed font-medium">
                        {item.meaning}
                      </p>

                      {/* Sentence Context */}
                      {item.sentence_context && item.sentence_context !== item.word && (
                        <div className="mt-2.5 p-2.5 bg-stone-50 rounded-xl border border-stone-200/60 text-[11px] text-stone-600">
                          <span className="font-semibold text-stone-700 block mb-0.5 not-italic">
                            Ngữ cảnh trong sách {item.book_title ? `"${item.book_title}"` : ''}:
                          </span>
                          <p className="italic font-serif leading-relaxed line-clamp-3">
                            "{item.sentence_context}"
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Bottom Metadata */}
                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[10px] text-stone-400">
                      <span>{new Date(item.created_at).toLocaleDateString('vi-VN')}</span>
                      {item.book_title && (
                        <span className="truncate max-w-[150px] font-medium text-stone-500">
                          {item.book_title}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
