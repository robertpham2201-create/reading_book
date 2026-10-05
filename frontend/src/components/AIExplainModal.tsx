import React, { useEffect, useState } from 'react';
import { Sparkles, X, Volume2, BookOpen, HelpCircle, Layers, Lightbulb, AlertTriangle, BookmarkPlus, Check, Loader2 } from 'lucide-react';
import { AIExplanationData, User } from '../types';
import { askAIContextExplainer, saveVocabulary, deleteVocabulary, checkVocabularyWord } from '../services/api';
import { speakWithWebSpeech } from '../services/tts';

interface AIExplainModalProps {
  selectedText: string | null;
  context: string | null;
  bookTitle?: string;
  bookId?: number | null;
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onSavedChange?: () => void;
}

export const AIExplainModal: React.FC<AIExplainModalProps> = ({
  selectedText,
  context,
  bookTitle,
  bookId,
  user,
  isOpen,
  onClose,
  onSavedChange,
}) => {
  const [data, setData] = useState<AIExplanationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !selectedText) {
      setData(null);
      setError(null);
      setIsSaved(false);
      setSavedId(null);
      return;
    }

    fetchExplanation();

    // Kiểm tra xem cụm từ đã có trong kho từ vựng chưa
    if (user?.id) {
      checkVocabularyWord(user.id, selectedText.trim())
        .then((res) => {
          setIsSaved(res.isSaved);
          if (res.item) setSavedId(res.item.id);
        })
        .catch(() => {});
    }
  }, [isOpen, selectedText, user?.id]);

  const fetchExplanation = async () => {
    if (!selectedText) return;
    setLoading(true);
    setError(null);

    try {
      const res = await askAIContextExplainer({
        selectedText,
        context: context || selectedText,
        bookTitle,
      });
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Không thể kết nối tới AI');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSave = async () => {
    if (!selectedText || saving) return;
    setSaving(true);

    try {
      if (isSaved && savedId) {
        await deleteVocabulary(savedId, user.id);
        setIsSaved(false);
        setSavedId(null);
        onSavedChange?.();
      } else {
        const meaningText = data
          ? `${data.translation} ${data.why ? `(${data.why})` : ''}`.trim()
          : 'Cụm từ đã lưu';
        const saved = await saveVocabulary({
          userId: user.id,
          bookId: bookId || null,
          word: selectedText.trim(),
          meaning: meaningText,
          sentenceContext: context || selectedText,
        });
        setIsSaved(true);
        setSavedId(saved.id);
        onSavedChange?.();
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi lưu cụm từ vào kho');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !selectedText) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-2xs p-0 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab bar for mobile */}
        <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto mt-3 mb-1 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-stone-100 bg-[#fbf9f5]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-600 text-white shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">
                Phân tích Ngữ cảnh AI
              </h2>
              {bookTitle && (
                <p className="text-xs text-stone-500 truncate max-w-[140px] sm:max-w-xs">
                  {bookTitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Nút lưu cụm từ vào kho từ vựng */}
            <button
              type="button"
              onClick={handleToggleSave}
              disabled={saving}
              className={`py-1.5 px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs ${
                isSaved
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }`}
              title={isSaved ? 'Đã lưu cụm từ này vào kho (Bấm để bỏ lưu)' : 'Thêm cụm từ này vào kho từ vựng'}
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isSaved ? (
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              ) : (
                <BookmarkPlus className="w-3.5 h-3.5" />
              )}
              <span>{isSaved ? 'Đã lưu kho' : '+ Lưu kho từ'}</span>
            </button>

            <button
              onClick={() => speakWithWebSpeech(selectedText)}
              className="p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-200/50 rounded-full transition-colors cursor-pointer"
              title="Đọc câu này"
            >
              <Volume2 className="w-5 h-5 text-amber-700" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-800 hover:bg-stone-200/50 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Selected Quote Card */}
        <div className="px-6 py-3 bg-stone-50 border-b border-stone-100 text-stone-800">
          <p className="font-serif italic text-sm sm:text-base text-stone-900 border-l-3 border-amber-600 pl-3 py-0.5 leading-relaxed">
            "{selectedText}"
          </p>
        </div>

        {/* Main Content Area */}
        <div className="overflow-y-auto px-6 py-5 space-y-5 text-stone-800">
          {/* Loading Animation */}
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center text-stone-500 gap-3">
              <div className="relative">
                <div className="w-10 h-10 border-3 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
                <Sparkles className="w-4 h-4 text-amber-600 absolute inset-0 m-auto animate-pulse" />
              </div>
              <p className="text-sm font-medium animate-pulse text-amber-900">
                AI đang giải mã sắc thái & ngữ cảnh...
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && !loading && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-sm">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Không thể phân tích ngữ cảnh</p>
                <p className="text-xs opacity-90 mb-3">{error}</p>
                <button
                  onClick={fetchExplanation}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                >
                  Thử lại
                </button>
              </div>
            </div>
          )}

          {/* AI Result Card */}
          {data && !loading && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* 1. Context Translation */}
              <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 uppercase tracking-wide mb-1.5">
                  <BookOpen className="w-4 h-4 text-amber-700" />
                  <span>Ý nghĩa trong ngữ cảnh này</span>
                </div>
                <p className="text-base sm:text-lg font-medium text-stone-900 leading-snug">
                  {data.translation}
                </p>
              </div>

              {/* 2. Why it means this */}
              <div className="p-4 bg-stone-50 border border-stone-200/70 rounded-2xl">
                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-600 uppercase tracking-wide mb-1.5">
                  <HelpCircle className="w-4 h-4 text-amber-700" />
                  <span>Bản chất & Sắc thái</span>
                </div>
                <p className="text-sm text-stone-700 leading-relaxed">
                  {data.why}
                </p>
              </div>

              {/* 3. Grammar & Idiom Breakdown */}
              {data.grammarAndIdioms && data.grammarAndIdioms.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-stone-600 uppercase tracking-wide">
                    <Layers className="w-4 h-4 text-amber-700" />
                    <span>Cấu trúc ngữ pháp & Thành ngữ bóc tách</span>
                  </div>

                  <div className="space-y-2">
                    {data.grammarAndIdioms.map((item, idx) => (
                      <div 
                        key={idx}
                        className="p-3 bg-white rounded-xl border border-stone-200 shadow-2xs hover:border-amber-300 transition-colors"
                      >
                        <span className="font-semibold text-amber-900 font-mono text-xs block mb-1">
                          • {item.element}
                        </span>
                        <p className="text-xs text-stone-700 leading-relaxed">
                          {item.explanation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Practical Usage Tip */}
              {data.usageTip && (
                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-start gap-2.5 text-emerald-950 text-xs">
                  <Lightbulb className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-0.5 text-emerald-900">
                      Gợi ý áp dụng tự nhiên:
                    </span>
                    <p className="leading-relaxed opacity-90">
                      {data.usageTip}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
