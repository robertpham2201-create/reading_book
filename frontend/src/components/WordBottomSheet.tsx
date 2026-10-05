import React, { useEffect, useState } from 'react';
import { Volume2, X, Loader2, BookOpen, BookmarkPlus, Check } from 'lucide-react';
import { WordData, User } from '../types';
import { lookupWordInDictionary, saveVocabulary, deleteVocabulary, checkVocabularyWord } from '../services/api';
import { speakWord } from '../services/tts';

interface WordBottomSheetProps {
  user: User;
  bookId?: number | null;
  word: string | null;
  sentenceContext?: string;
  isOpen: boolean;
  onClose: () => void;
  onSavedChange?: () => void;
}

export const WordBottomSheet: React.FC<WordBottomSheetProps> = ({
  user,
  bookId,
  word,
  sentenceContext,
  isOpen,
  onClose,
  onSavedChange,
}) => {
  const [data, setData] = useState<WordData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !word) {
      setData(null);
      setError(null);
      setIsSaved(false);
      setSavedId(null);
      return;
    }

    const cleanWord = word.trim().replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
    if (!cleanWord) return;

    setLoading(true);
    setError(null);

    // Tra từ trực tiếp trong SQLite < 1ms
    lookupWordInDictionary(cleanWord)
      .then((res) => {
        setData(res);
        // Tự động phát âm chuẩn tiếng Anh
        speakWord(res.word);
      })
      .catch((err) => {
        setError(err.message || 'Không tìm thấy trong từ điển');
        speakWord(cleanWord);
      })
      .finally(() => setLoading(false));

    // Kiểm tra xem từ đã lưu trong kho từ vựng chưa
    if (user?.id) {
      checkVocabularyWord(user.id, cleanWord)
        .then((res) => {
          setIsSaved(res.isSaved);
          if (res.item) {
            setSavedId(res.item.id);
          }
        })
        .catch(() => {});
    }
  }, [word, isOpen, user?.id]);

  if (!isOpen || !word) return null;

  const cleanWord = word.trim().replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');

  const handleToggleSave = async () => {
    if (saving) return;
    setSaving(true);

    try {
      if (isSaved && savedId) {
        await deleteVocabulary(savedId, user.id);
        setIsSaved(false);
        setSavedId(null);
        onSavedChange?.();
      } else {
        const briefMeaning = extractBriefMeaning(data);
        const saved = await saveVocabulary({
          userId: user.id,
          bookId: bookId || null,
          word: data?.word || cleanWord,
          ipa: data?.ipa || '',
          meaning: briefMeaning || 'Từ vựng tiếng Anh',
          sentenceContext: sentenceContext || '',
        });
        setIsSaved(true);
        setSavedId(saved.id);
        onSavedChange?.();
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi thao tác kho từ vựng');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-2xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-[#faf7f2] rounded-t-3xl shadow-2xl border-t border-stone-200 overflow-hidden flex flex-col max-h-[82vh] animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab bar */}
        <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto mt-3 mb-1" />

        {/* Word Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-stone-200/80 bg-white/60">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-2xl font-serif font-bold text-stone-900 lowercase">
              {data?.word || cleanWord}
            </h2>
            {data?.ipa && (
              <span className="text-sm font-mono text-amber-900 bg-amber-100/70 border border-amber-200 px-2.5 py-0.5 rounded-lg">
                {data.ipa}
              </span>
            )}
            <button
              type="button"
              onClick={() => speakWord(data?.word || cleanWord)}
              className="p-1.5 text-stone-700 hover:text-stone-900 bg-amber-100/60 hover:bg-amber-200/80 rounded-full transition-colors cursor-pointer"
              title="Nghe phát âm chuẩn"
            >
              <Volume2 className="w-4 h-4 text-amber-800" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Nút Thêm vào Kho Từ Vựng */}
            <button
              type="button"
              onClick={handleToggleSave}
              disabled={saving}
              className={`py-1.5 px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs ${
                isSaved
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }`}
              title={isSaved ? 'Đã lưu trong kho từ vựng (Bấm để bỏ lưu)' : 'Thêm từ này vào kho từ vựng'}
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isSaved ? (
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              ) : (
                <BookmarkPlus className="w-3.5 h-3.5" />
              )}
              <span>{isSaved ? 'Đã lưu kho' : '+ Lưu vào kho'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-200/50 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Word Content Area */}
        <div className="overflow-y-auto px-6 py-4 space-y-4">
          {loading && (
            <div className="py-8 flex flex-col items-center justify-center text-stone-500 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-amber-700" />
              <span className="text-xs">Đang mở từ điển...</span>
            </div>
          )}

          {error && !loading && (
            <div className="py-6 text-center text-stone-600">
              <BookOpen className="w-8 h-8 text-stone-400 mx-auto mb-2" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {data && !loading && (
            <div className="space-y-4">
              {/* Context sentence from book */}
              {sentenceContext && (
                <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/70 text-xs text-amber-950">
                  <span className="font-semibold block mb-0.5 text-amber-800">Câu trong sách:</span>
                  <p className="italic font-serif leading-relaxed">"...{sentenceContext}..."</p>
                </div>
              )}

              {/* Rich Dictionary HTML renderer with Kindle styling */}
              {data.html ? (
                <div 
                  className="kindle-dict-content text-sm text-stone-800 leading-relaxed space-y-3"
                  dangerouslySetInnerHTML={{ __html: cleanDictionaryHtml(data.html) }}
                />
              ) : (
                <p className="text-sm text-stone-800">{data.description}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Trích xuất nghĩa ngắn gọn từ dữ liệu từ điển để lưu vào kho từ vựng
function extractBriefMeaning(data: WordData | null): string {
  if (!data) return '';
  if (data.description && data.description.trim()) {
    return data.description.trim();
  }
  if (data.html) {
    const text = data.html
      .replace(/<h1[^>]*>.*?<\/h1>/gi, '')
      .replace(/<h3[^>]*>.*?<\/h3>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text.slice(0, 250);
  }
  return '';
}

// Loại bỏ các thẻ h1, h3 trùng lặp trong dữ liệu HTML gốc và thêm định dạng đẹp
function cleanDictionaryHtml(rawHtml: string): string {
  return rawHtml
    .replace(/<h1[^>]*>.*?<\/h1>/gi, '') // bỏ h1 (tên từ đã hiện ở header)
    .replace(/<h3[^>]*>.*?<\/h3>/gi, '') // bỏ h3 (phiên âm đã hiện ở header)
    .replace(/<h2>/gi, '<h2 class="text-xs font-bold uppercase tracking-wider text-amber-900 bg-amber-100/70 px-2.5 py-1 rounded-md mt-4 mb-2 inline-block">')
    .replace(/<ul>/gi, '<ul class="space-y-1.5 pl-4 list-disc marker:text-amber-700">')
    .replace(/<ol>/gi, '<ol class="space-y-1.5 pl-4 list-decimal marker:text-amber-800 font-medium">')
    .replace(/<li>/gi, '<li class="text-stone-800 text-sm leading-relaxed">')
    .replace(/<ul style="list-style-type:circle">/gi, '<div class="my-1.5 p-2 bg-stone-100/70 rounded-lg border-l-2 border-amber-600 text-xs text-stone-700 not-italic block">')
    .replace(/<\/ul><\/li>/gi, '</div></li>');
}
