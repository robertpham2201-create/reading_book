import { useState, useEffect } from 'react';
import { User, ReadingSettings, Book } from './types';
import { AuthScreen } from './components/AuthScreen';
import { Library } from './components/Library';
import { KindleReader } from './components/KindleReader';
import { SettingsModal } from './components/SettingsModal';
import { WordBottomSheet } from './components/WordBottomSheet';
import { AIExplainModal } from './components/AIExplainModal';
import { fetchBookById } from './services/api';

const DEFAULT_SETTINGS: ReadingSettings = {
  theme: 'sepia',
  fontSize: 18,
  fontFamily: 'Bookerly',
  lineHeight: 1.6,
  scrollSpeed: 2,
};

export function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('kindle_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [settings, setSettings] = useState<ReadingSettings>(() => {
    const saved = localStorage.getItem('kindle_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [initialLoading, setInitialLoading] = useState<boolean>(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const hasBookHash = /#\/book\/\d+/.test(hash);
    const hasSavedBook = typeof localStorage !== 'undefined' && !!localStorage.getItem('kindle_last_book_id');
    const hasUser = typeof localStorage !== 'undefined' && !!localStorage.getItem('kindle_user');
    return !!(hasUser && (hasBookHash || hasSavedBook));
  });

  // Tra từ 1 chạm state
  const [wordSheet, setWordSheet] = useState<{
    isOpen: boolean;
    word: string | null;
    sentence: string;
  }>({
    isOpen: false,
    word: null,
    sentence: '',
  });

  // Hỏi AI ngữ cảnh state
  const [aiModal, setAiModal] = useState<{
    isOpen: boolean;
    selectedText: string | null;
    context: string | null;
  }>({
    isOpen: false,
    selectedText: null,
    context: null,
  });

  // Đọc hash trên URL hoặc last_book_id khi mở app
  useEffect(() => {
    if (!user) {
      setInitialLoading(false);
      return;
    }

    const hash = window.location.hash;
    const match = hash.match(/#\/book\/(\d+)/);
    let targetBookId: number | null = match ? Number(match[1]) : null;

    if (!targetBookId) {
      const savedLastId = localStorage.getItem('kindle_last_book_id');
      if (savedLastId) {
        targetBookId = Number(savedLastId);
      }
    }

    if (targetBookId) {
      fetchBookById(targetBookId, user.id)
        .then((book) => {
          setActiveBook(book);
          window.location.hash = `#/book/${book.id}`;
          localStorage.setItem('kindle_last_book_id', String(book.id));
        })
        .catch((err) => {
          console.error('Không tìm thấy sách từ hash:', err);
          localStorage.removeItem('kindle_last_book_id');
          if (window.location.hash.startsWith('#/book')) {
            window.location.hash = '#/';
          }
        })
        .finally(() => {
          setInitialLoading(false);
        });
    } else {
      setInitialLoading(false);
    }
  }, [user?.id]);

  // Lắng nghe sự kiện thay đổi hash (Back / Forward trình duyệt)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const match = hash.match(/#\/book\/(\d+)/);

      if (match) {
        const bookId = Number(match[1]);
        if (!activeBook || activeBook.id !== bookId) {
          if (user) {
            fetchBookById(bookId, user.id)
              .then((book) => {
                setActiveBook(book);
                localStorage.setItem('kindle_last_book_id', String(book.id));
              })
              .catch((err) => {
                console.error('Lỗi tải sách từ hashchange:', err);
                window.location.hash = '#/';
              });
          }
        }
      } else {
        // Hash không phải book (e.g. #/ hoặc rỗng) -> về Tủ sách
        if (activeBook) {
          setActiveBook(null);
          localStorage.removeItem('kindle_last_book_id');
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [user, activeBook]);

  // Lưu phiên đăng nhập
  const handleAuthSuccess = (authenticatedUser: User, userSettings?: ReadingSettings) => {
    setUser(authenticatedUser);
    localStorage.setItem('kindle_user', JSON.stringify(authenticatedUser));
    if (userSettings) {
      setSettings(userSettings);
      localStorage.setItem('kindle_settings', JSON.stringify(userSettings));
    }
  };

  const handleLogout = () => {
    setUser(null);
    setActiveBook(null);
    localStorage.removeItem('kindle_user');
    localStorage.removeItem('kindle_last_book_id');
    window.location.hash = '';
  };

  const handleOpenBook = (book: Book) => {
    setActiveBook(book);
    window.location.hash = `#/book/${book.id}`;
    localStorage.setItem('kindle_last_book_id', String(book.id));
  };

  const handleCloseBook = () => {
    setActiveBook(null);
    localStorage.removeItem('kindle_last_book_id');
    if (window.location.hash.startsWith('#/book')) {
      window.location.hash = '#/';
    }
  };

  const handleUpdateSettings = (newSettings: ReadingSettings) => {
    setSettings(newSettings);
    localStorage.setItem('kindle_settings', JSON.stringify(newSettings));
  };

  // Tra từ điển 1 chạm
  const handleSelectWord = (word: string, sentenceContext: string) => {
    setWordSheet({
      isOpen: true,
      word,
      sentence: sentenceContext,
    });
  };

  // Mở Hỏi AI phân tích ngữ cảnh
  const handleAskAI = (selectedText: string, context: string) => {
    setAiModal({
      isOpen: true,
      selectedText,
      context,
    });
  };

  return (
    <div className="min-h-screen bg-[#f7f4ed]">
      {!user ? (
        <AuthScreen onSuccess={handleAuthSuccess} />
      ) : initialLoading ? (
        <div className="flex h-screen items-center justify-center flex-col gap-3">
          <div className="w-8 h-8 border-3 border-amber-600/30 border-t-amber-700 rounded-full animate-spin" />
          <span className="text-xs text-stone-500 font-serif">Đang mở lại cuốn sách của bạn...</span>
        </div>
      ) : activeBook ? (
        <KindleReader
          book={activeBook}
          user={user}
          settings={settings}
          onBack={handleCloseBook}
          onOpenSettings={() => setSettingsModalOpen(true)}
          onSelectWord={handleSelectWord}
          onAskAIContext={handleAskAI}
        />
      ) : (
        <Library
          user={user}
          onOpenBook={handleOpenBook}
          onOpenSettings={() => setSettingsModalOpen(true)}
          onLogout={handleLogout}
        />
      )}

      {/* Tra từ 1 chạm Bottom Sheet */}
      {user && (
        <WordBottomSheet
          user={user}
          bookId={activeBook?.id}
          isOpen={wordSheet.isOpen}
          word={wordSheet.word}
          sentenceContext={wordSheet.sentence}
          onClose={() => setWordSheet((prev) => ({ ...prev, isOpen: false }))}
        />
      )}

      {/* Modal Hỏi AI Ngữ Cảnh */}
      {user && (
        <AIExplainModal
          isOpen={aiModal.isOpen}
          selectedText={aiModal.selectedText}
          context={aiModal.context}
          bookTitle={activeBook?.title}
          bookId={activeBook?.id}
          user={user}
          onClose={() => setAiModal((prev) => ({ ...prev, isOpen: false }))}
        />
      )}

      {/* Modal Cài đặt đọc sách */}
      {user && (
        <SettingsModal
          user={user}
          settings={settings}
          isOpen={settingsModalOpen}
          onClose={() => setSettingsModalOpen(false)}
          onUpdateSettings={handleUpdateSettings}
        />
      )}
    </div>
  );
}

export default App;
