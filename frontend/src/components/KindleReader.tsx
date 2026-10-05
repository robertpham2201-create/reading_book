import React, { useEffect, useState, useRef } from 'react';
import { 
  ArrowLeft, 
  Settings as SettingsIcon, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Volume2, 
  X, 
  Bookmark as BookmarkIcon, 
  ListFilter,
  Check,
  Play,
  Pause,
  ChevronsDown,
  BookmarkPlus
} from 'lucide-react';
import ePub from 'epubjs';
import { Book, ReadingSettings, User, Bookmark } from '../types';
import { fetchBookContent, updateReadingProgress, fetchBookmarks, toggleBookmark, saveVocabulary } from '../services/api';
import { speakWithWebSpeech } from '../services/tts';

interface KindleReaderProps {
  book: Book;
  user: User;
  settings: ReadingSettings;
  onBack: () => void;
  onOpenSettings: () => void;
  onSelectWord: (word: string, sentenceContext: string) => void;
  onAskAIContext: (selectedText: string, context: string) => void;
}

export const KindleReader: React.FC<KindleReaderProps> = ({
  book,
  user,
  settings,
  onBack,
  onOpenSettings,
  onSelectWord,
  onAskAIContext,
}) => {
  const [loading, setLoading] = useState(true);
  const [txtChapters, setTxtChapters] = useState<string[][]>([]); // chapters -> pages
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedRangeText, setSelectedRangeText] = useState<string | null>(null);
  const [floatingMenuPos, setFloatingMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [epubRendition, setEpubRendition] = useState<any>(null);
  const [pageTurnDirection, setPageTurnDirection] = useState<'next' | 'prev'>('next');

  // Tự động cuộn trang (Auto-scroll)
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const scrollSpeed = settings.scrollSpeed || 2;
  const isAutoScrollingRef = useRef(false);
  const scrollSpeedRef = useRef(settings.scrollSpeed || 2);
  const autoScrollRafRef = useRef<number | null>(null);
  const subPixelRef = useRef(0);
  const isPageTransitioningRef = useRef(false);
  const autoScrollPauseUntilRef = useRef<number>(0);

  // Danh sách Bookmarks
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [showBookmarksModal, setShowBookmarksModal] = useState(false);

  const viewerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasMovedRef = useRef<boolean>(false);
  const rawBookTextRef = useRef<string>('');

  // Theme styling mapping
  const themeClasses = {
    sepia: 'bg-[#f6efe2] text-[#3b2f21]',
    light: 'bg-[#fbfbfb] text-[#1a1a1a]',
    dark: 'bg-[#23272e] text-[#d1d5db]',
    black: 'bg-[#000000] text-[#9ca3af]',
  }[settings.theme] || 'bg-[#f6efe2] text-[#3b2f21]';

  const fontClasses = {
    Bookerly: 'font-bookerly',
    Merriweather: 'font-merriweather',
    Georgia: 'font-georgia',
    Sans: 'font-sans-reader',
  }[settings.fontFamily] || 'font-bookerly';

  // Lắng nghe sự kiện bôi đen (selectionchange) trên điện thoại và máy tính
  useEffect(() => {
    const handleSelectionUpdate = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        return;
      }

      const text = selection.toString().trim();
      const words = text.split(/\s+/).filter((w) => w.length > 0);
      if (words.length >= 2) {
        setSelectedRangeText(text);

        try {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          if (rect && rect.top > 0) {
            const topPos = rect.top > 70 ? rect.top - 50 : rect.bottom + 10;
            const leftPos = Math.max(16, Math.min(window.innerWidth - 130, rect.left + rect.width / 2 - 50));
            setFloatingMenuPos({ x: leftPos, y: topPos });
          }
        } catch {
          setFloatingMenuPos({ x: window.innerWidth / 2 - 50, y: window.innerHeight - 130 });
        }
      }
    };

    document.addEventListener('selectionchange', handleSelectionUpdate);
    document.addEventListener('mouseup', handleSelectionUpdate);
    document.addEventListener('touchend', handleSelectionUpdate);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionUpdate);
      document.removeEventListener('mouseup', handleSelectionUpdate);
      document.removeEventListener('touchend', handleSelectionUpdate);
    };
  }, []);

  // Tải nội dung sách và danh sách bookmarks
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    // Tải bookmarks của sách
    fetchBookmarks(book.id, user.id)
      .then((bms) => {
        if (isMounted) setBookmarks(bms);
      })
      .catch(console.error);

    fetchBookContent(book.id, user.id)
      .then((data) => {
        if (!isMounted) return;

        if (book.format === 'txt') {
          const rawText = typeof data === 'string' ? data : (data.content || '');
          rawBookTextRef.current = rawText;
          paginateText(rawText);
          setLoading(false);
        } else {
          initEpub(data);
        }
      })
      .catch((err) => {
        console.error('Lỗi nạp sách:', err);
        alert('Không thể mở sách: ' + err.message);
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [book.id]);

  // Tự động phân trang lại khi người dùng đổi font size
  useEffect(() => {
    if (book.format === 'txt' && rawBookTextRef.current) {
      paginateText(rawBookTextRef.current);
    }
  }, [settings.fontSize]);

  // Phân chia file TXT thành các trang đọc đều đặn, thông minh, không trang rác
  const paginateText = (text: string) => {
    // 1. Loại bỏ các rác PDF như '-- 4 of 52 --', '- 4 -', dòng số trang đơn độc
    const cleaned = text
      .replace(/\r\n/g, '\n')
      .replace(/\n*--\s*\d+\s+of\s+\d+\s*--\n*/gi, '\n\n')
      .replace(/\n\s*-\s*\d+\s*-\s*\n/g, '\n\n')
      .replace(/\n{3,}/g, '\n\n');

    const rawParagraphs = cleaned.split(/\n\s*\n/);
    const paragraphs: string[] = [];

    for (const p of rawParagraphs) {
      const trimmed = p.trim();
      if (!trimmed) continue;
      // Bỏ qua nếu là số trang đơn độc hoặc rác phân trang pdf
      if (/^--\s*\d+\s+of\s+\d+\s*--$/i.test(trimmed)) continue;
      if (/^-\s*\d+\s*-$/.test(trimmed)) continue;
      if (/^\d{1,4}$/.test(trimmed)) continue;
      paragraphs.push(trimmed);
    }

    const pages: string[] = [];
    const targetChars = Math.round(750 * (18 / Math.max(12, settings.fontSize || 18)));
    const minChars = Math.round(targetChars * 0.55);

    let currentPageParas: string[] = [];
    let currentLen = 0;

    for (const para of paragraphs) {
      // Nếu đoạn văn dài hơn dung lượng 1 trang, tách theo câu để lấp đầy trang tự nhiên
      if (para.length > targetChars) {
        const sentences = para.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [para];
        for (const sent of sentences) {
          const sentTrim = sent.trim();
          if (!sentTrim) continue;

          if ((currentLen + sentTrim.length) > targetChars && currentLen >= minChars) {
            pages.push(currentPageParas.join('\n\n').trim());
            currentPageParas = [sentTrim];
            currentLen = sentTrim.length;
          } else {
            if (currentPageParas.length > 0 && !/[.!?]$/.test(currentPageParas[currentPageParas.length - 1])) {
              currentPageParas[currentPageParas.length - 1] += ' ' + sentTrim;
            } else {
              currentPageParas.push(sentTrim);
            }
            currentLen += sentTrim.length;
          }
        }
      } else {
        // Đoạn văn bình thường
        if ((currentLen + para.length) > targetChars && currentLen >= minChars) {
          pages.push(currentPageParas.join('\n\n').trim());
          currentPageParas = [para];
          currentLen = para.length;
        } else {
          currentPageParas.push(para);
          currentLen += para.length;
        }
      }
    }

    if (currentPageParas.length > 0) {
      pages.push(currentPageParas.join('\n\n').trim());
    }

    setTxtChapters([pages]);
    setTotalPages(Math.max(1, pages.length));

    if (book.current_location) {
      const savedPage = parseInt(book.current_location, 10);
      if (!isNaN(savedPage) && savedPage >= 0 && savedPage < pages.length) {
        setCurrentPage(savedPage);
      }
    }
  };

  // Khởi tạo Epub.js
  const initEpub = (epubBuffer: ArrayBuffer) => {
    if (!viewerRef.current) return;
    viewerRef.current.innerHTML = '';

    try {
      const epubBook = ePub(epubBuffer);
      const rendition = epubBook.renderTo(viewerRef.current, {
        width: '100%',
        height: '100%',
        flow: 'paginated',
        manager: 'continuous',
      });

      setEpubRendition(rendition);
      rendition.display(book.current_location || undefined);

      rendition.on('relocated', (location: any) => {
        const cfi = location.start.cfi;
        const progress = Math.round((location.start.percentage || 0) * 100);
        updateReadingProgress(book.id, cfi, progress).catch(console.error);
      });

      rendition.on('selected', (cfiRange: string) => {
        epubBook.getRange(cfiRange).then((range: any) => {
          const text = range.toString().trim();
          if (text) {
            setSelectedRangeText(text);
          }
        });
      });

      setLoading(false);
    } catch (err) {
      console.error('Lỗi hiển thị EPUB:', err);
      setLoading(false);
    }
  };

  const goToTxtPage = (pageIdx: number) => {
    if (pageIdx < 0 || pageIdx >= totalPages) return;
    setPageTurnDirection(pageIdx >= currentPage ? 'next' : 'prev');
    setCurrentPage(pageIdx);
    const progress = Math.round(((pageIdx + 1) / totalPages) * 100);
    updateReadingProgress(book.id, String(pageIdx), progress).catch(console.error);
    setSelectedRangeText(null);
    setFloatingMenuPos(null);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  // Kiểm tra trang hiện tại đã được bookmark chưa
  const isCurrentPageBookmarked = bookmarks.some((b) => b.page_index === currentPage);

  // Toggle bookmark trang hiện tại
  const handleToggleBookmark = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      // Lấy 1 đoạn đầu trang làm excerpt ghi nhớ
      const pageText = txtChapters[0]?.[currentPage] || '';
      const excerpt = pageText.slice(0, 80).replace(/\n/g, ' ').trim() + '...';
      const title = `Trang ${currentPage + 1}`;

      const res = await toggleBookmark(book.id, user.id, currentPage, title, excerpt);
      setBookmarks(res.bookmarks);
    } catch (err: any) {
      alert(err.message || 'Lỗi lưu bookmark');
    }
  };

  // Xử lý chạm vào 1 từ đơn lẻ - CHỈ MỞ KHI DOUBLE TAP
  const lastTapInfo = useRef<{ time: number; word: string; paragraph: string }>({
    time: 0,
    word: '',
    paragraph: '',
  });

  const handleWordTap = (e: React.MouseEvent<HTMLSpanElement>, word: string, paragraph: string) => {
    e.stopPropagation();
    if (hasMovedRef.current) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) {
      const selectedWords = sel.toString().trim().split(/\s+/).filter(Boolean);
      if (selectedWords.length >= 2) return;
    }

    const now = Date.now();
    const timeDiff = now - lastTapInfo.current.time;
    const isSameWord = lastTapInfo.current.word === word;

    if (timeDiff < 350 && isSameWord) {
      lastTapInfo.current = { time: 0, word: '', paragraph: '' };

      const cleanWord = word.trim().replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
      if (!cleanWord || cleanWord.length < 1) return;

      window.getSelection()?.removeAllRanges();

      const sentences = paragraph.split(/(?<=[.?!])\s+/);
      const matchingSentence = sentences.find((s) => s.includes(word)) || paragraph;

      onSelectWord(cleanWord, matchingSentence.trim());
    } else {
      lastTapInfo.current = { time: now, word, paragraph };
    }
  };

  const handleWordDoubleClick = (e: React.MouseEvent<HTMLSpanElement>, word: string, paragraph: string) => {
    e.stopPropagation();
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) {
      const selectedWords = sel.toString().trim().split(/\s+/).filter(Boolean);
      if (selectedWords.length >= 2) return;
    }

    const cleanWord = word.trim().replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
    if (!cleanWord || cleanWord.length < 1) return;

    window.getSelection()?.removeAllRanges();

    const sentences = paragraph.split(/(?<=[.?!])\s+/);
    const matchingSentence = sentences.find((s) => s.includes(word)) || paragraph;

    onSelectWord(cleanWord, matchingSentence.trim());
  };

  // Kích hoạt hỏi AI khi bấm nút (chỉ gửi nguyên đoạn văn chứa câu được chọn)
  const handleTriggerAI = () => {
    if (!selectedRangeText) return;

    let paragraphContext = selectedRangeText;

    // 1. Thử lấy đoạn văn từ thẻ <p> chứa bôi đen trong DOM
    const sel = window.getSelection();
    if (sel && sel.anchorNode) {
      const node = sel.anchorNode.nodeType === Node.ELEMENT_NODE 
        ? (sel.anchorNode as Element) 
        : sel.anchorNode.parentElement;
      const pElem = node?.closest('p');
      if (pElem && pElem.textContent) {
        paragraphContext = pElem.textContent.trim();
      }
    }

    // 2. Nếu chưa lấy được từ DOM, tìm đoạn văn tương ứng trong trang
    if (paragraphContext === selectedRangeText) {
      const pageText = txtChapters[0]?.[currentPage] || '';
      if (pageText) {
        const paragraphs = pageText.split(/\n\s*\n/);
        const found = paragraphs.find((p) => p.includes(selectedRangeText));
        if (found) {
          paragraphContext = found.trim();
        }
      }
    }

    onAskAIContext(selectedRangeText, paragraphContext);
    setSelectedRangeText(null);
    setFloatingMenuPos(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleQuickSavePhrase = async () => {
    if (!selectedRangeText) return;
    try {
      await saveVocabulary({
        userId: user.id,
        bookId: book.id,
        word: selectedRangeText.trim(),
        meaning: 'Cụm từ đã lưu từ trang sách',
        sentenceContext: selectedRangeText.trim(),
      });
      alert(`Đã lưu "${selectedRangeText.slice(0, 35)}..." vào kho từ vựng!`);
      setSelectedRangeText(null);
      setFloatingMenuPos(null);
      window.getSelection()?.removeAllRanges();
    } catch (err: any) {
      alert(err.message || 'Lỗi lưu từ vựng');
    }
  };

  // Xử lý chạm màn hình để ẩn/hiện thanh điều khiển (không lật trang tự động tránh bấm nhầm)
  const handleScreenClick = (e: React.MouseEvent) => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    if (selectedRangeText) {
      setSelectedRangeText(null);
      setFloatingMenuPos(null);
      return;
    }
  };

  const nextPage = () => {
    setPageTurnDirection('next');
    if (book.format === 'epub' && epubRendition) {
      epubRendition.next();
    } else if (currentPage < totalPages - 1) {
      goToTxtPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    setPageTurnDirection('prev');
    if (book.format === 'epub' && epubRendition) {
      epubRendition.prev();
    } else if (currentPage > 0) {
      goToTxtPage(currentPage - 1);
    }
  };

  const toggleAutoScroll = () => {
    setIsAutoScrolling((prev) => {
      const next = !prev;
      if (next) {
        if (scrollContainerRef.current && scrollContainerRef.current.scrollTop < 40) {
          autoScrollPauseUntilRef.current = Date.now() + 10000;
        } else {
          autoScrollPauseUntilRef.current = 0;
        }
      }
      return next;
    });
  };

  // Đồng bộ ref cho animation loop tự cuộn
  useEffect(() => {
    isAutoScrollingRef.current = isAutoScrolling;
    scrollSpeedRef.current = scrollSpeed;
  }, [isAutoScrolling, scrollSpeed]);

  // Khi sang trang mới, hoãn tự cuộn 10 giây để người đọc đọc phần đầu trang
  useEffect(() => {
    if (isAutoScrollingRef.current) {
      autoScrollPauseUntilRef.current = Date.now() + 10000;
    }
  }, [currentPage]);

  // Vòng lặp tự động cuộn trang (Auto-scroll mượt mà với requestAnimationFrame)
  useEffect(() => {
    if (!isAutoScrolling) {
      if (autoScrollRafRef.current) {
        cancelAnimationFrame(autoScrollRafRef.current);
        autoScrollRafRef.current = null;
      }
      return;
    }

    let lastTime = performance.now();

    // Tốc độ cuộn: pixel mỗi giây (thêm 2 mức siêu chậm ở dưới)
    const speedMap: Record<number, number> = {
      1: 7,   // Siêu chậm (đọc từng chữ, tra từ thong thả)
      2: 14,  // Cực chậm (chậm rãi, thư thái)
      3: 24,  // Rất chậm (mức 1 cũ)
      4: 45,  // Chậm vừa (mức 2 cũ)
      5: 75,  // Vừa (mức 3 cũ)
      6: 115, // Nhanh (mức 4 cũ)
      7: 165, // Rất nhanh (mức 5 cũ)
    };

    const step = (now: number) => {
      if (!isAutoScrollingRef.current) return;

      const delta = (now - lastTime) / 1000;
      lastTime = now;

      // Nếu đang trong thời gian chờ 10s khi sang trang mới
      if (Date.now() < autoScrollPauseUntilRef.current) {
        subPixelRef.current = 0;
        autoScrollRafRef.current = requestAnimationFrame(step);
        return;
      }

      const container = scrollContainerRef.current;
      if (container && !isPageTransitioningRef.current) {
        const pxPerSec = speedMap[scrollSpeedRef.current] || 14;
        subPixelRef.current += pxPerSec * delta;

        if (subPixelRef.current >= 1) {
          const pixelsToScroll = Math.floor(subPixelRef.current);
          subPixelRef.current -= pixelsToScroll;
          container.scrollTop += pixelsToScroll;

          // Kiểm tra xem đã chạm đáy trang chưa
          const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 15;
          if (isAtBottom) {
            isPageTransitioningRef.current = true;
            // Chờ 2s để người đọc đọc xong dòng cuối cùng rồi tự động sang trang sau
            setTimeout(() => {
              if (!isAutoScrollingRef.current) return;
              if (currentPage < totalPages - 1) {
                nextPage();
                setTimeout(() => {
                  if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollTop = 0;
                  }
                  isPageTransitioningRef.current = false;
                  // Sang trang mới đợi 10s
                  autoScrollPauseUntilRef.current = Date.now() + 10000;
                  lastTime = performance.now();
                }, 350);
              } else {
                setIsAutoScrolling(false);
                isPageTransitioningRef.current = false;
              }
            }, 2000);
          }
        }
      }

      autoScrollRafRef.current = requestAnimationFrame(step);
    };

    autoScrollRafRef.current = requestAnimationFrame(step);

    return () => {
      if (autoScrollRafRef.current) {
        cancelAnimationFrame(autoScrollRafRef.current);
        autoScrollRafRef.current = null;
      }
    };
  }, [isAutoScrolling, currentPage, totalPages]);

  // Lắng nghe phím bấm máy tính:
  // - Mũi tên TRÁI / PHẢI: sang trang trước / sau
  // - Mũi tên LÊN / XUỐNG: cuộn nội dung lên / xuống mượt mà
  // - Phím SPACE hoặc phím 's': bật / tắt tự động cuộn
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Không xử lý khi đang gõ phím trong input/textarea hoặc đang mở modal
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        showBookmarksModal
      ) {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        nextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        prevPage();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        scrollContainerRef.current?.scrollBy({ top: 90, behavior: 'smooth' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        scrollContainerRef.current?.scrollBy({ top: -90, behavior: 'smooth' });
      } else if (e.key === ' ' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        toggleAutoScroll();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages, showBookmarksModal, book.format, epubRendition]);

  return (
    <div 
      className={`fixed inset-0 z-40 select-text overflow-hidden flex flex-col ${themeClasses} transition-colors duration-200`}
    >
      {/* Thanh điều khiển trên cùng: Sát mép trên, là 1 phần riêng biệt, KHÔNG đè lên nội dung truyện */}
      <header 
        className={`flex-shrink-0 w-full z-30 px-3 sm:px-6 py-2 safe-top border-b transition-colors duration-200 select-none ${
          settings.theme === 'sepia'
            ? 'bg-[#ece4d5] border-[#ded3be] text-[#3b2f21]'
            : settings.theme === 'dark'
            ? 'bg-[#1e2229] border-stone-800 text-stone-200'
            : settings.theme === 'black'
            ? 'bg-[#0f0f0f] border-stone-800 text-stone-300'
            : 'bg-[#f4f4f4] border-stone-200 text-stone-900'
        }`}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
          {/* Trái: Nút Quay về Tủ sách */}
          <button
            onClick={onBack}
            className="py-1.5 px-2.5 sm:px-3 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs sm:text-sm font-medium active:scale-95 flex-shrink-0"
            title="Quay về tủ sách"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-serif">Tủ sách</span>
          </button>

          {/* Giữa: Nút Bookmark (ở giữa) */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleToggleBookmark}
              className={`py-1.5 px-3 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                isCurrentPageBookmarked
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15'
              }`}
              title={isCurrentPageBookmarked ? 'Bỏ đánh dấu trang này' : 'Đánh dấu trang này'}
            >
              <BookmarkIcon className={`w-3.5 h-3.5 ${isCurrentPageBookmarked ? 'fill-current text-white' : ''}`} />
              <span>{isCurrentPageBookmarked ? 'Đã lưu' : 'Bookmark'}</span>
            </button>

            {bookmarks.length > 0 && (
              <button
                onClick={() => setShowBookmarksModal(true)}
                className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer relative"
                title={`Xem ${bookmarks.length} dấu trang`}
              >
                <ListFilter className="w-3.5 h-3.5 opacity-70" />
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {bookmarks.length}
                </span>
              </button>
            )}
          </div>

          {/* Phải: Tự cuộn & Cài đặt */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={toggleAutoScroll}
              className={`py-1.5 px-2.5 sm:px-3 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                isAutoScrolling
                  ? 'bg-amber-600 text-white ring-2 ring-amber-400 shadow-xs'
                  : 'bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15'
              }`}
              title={isAutoScrolling ? 'Tạm dừng tự động cuộn' : 'Bật tự động cuộn (Phím Space hoặc S)'}
            >
              {isAutoScrolling ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Dừng</span>
                </>
              ) : (
                <>
                  <ChevronsDown className="w-3.5 h-3.5" />
                  <span>Tự cuộn</span>
                </>
              )}
            </button>

            <button
              onClick={onOpenSettings}
              className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
              title="Cài đặt đọc sách"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Reading Viewport - Độc lập, cuộn riêng, không bị che bởi header */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 w-full max-w-2xl mx-auto px-5 sm:px-8 py-5 sm:py-8 overflow-y-auto flex flex-col justify-between"
        onClick={handleScreenClick}
      >
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-amber-600/30 border-t-amber-700 rounded-full animate-spin" />
            <span className="text-xs opacity-70">Đang chuẩn bị trang sách...</span>
          </div>
        ) : book.format === 'epub' ? (
          <div ref={viewerRef} className="w-full h-full" />
        ) : (
          /* TXT Paginated Reader with Page Turn Animation */
          <div 
            key={currentPage}
            className={`flex-1 ${fontClasses} leading-relaxed select-text space-y-4 cursor-text animate-in fade-in ${
              pageTurnDirection === 'next' ? 'slide-in-from-right-8' : 'slide-in-from-left-8'
            } duration-200`}
            style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight }}
          >
            {txtChapters[0]?.[currentPage]?.split('\n\n').map((paragraph, pIdx) => (
              <p key={pIdx} className="mb-4 text-justify select-text">
                {paragraph.split(/(\s+)/).map((segment, sIdx) => {
                  if (/^\s+$/.test(segment)) {
                    return <span key={sIdx}>{segment}</span>;
                  }
                  return (
                    <span
                      key={sIdx}
                      onClick={(e) => handleWordTap(e, segment, paragraph)}
                      onDoubleClick={(e) => handleWordDoubleClick(e, segment, paragraph)}
                      className="cursor-pointer hover:bg-amber-500/15 rounded-xs transition-colors select-text"
                    >
                      {segment}
                    </span>
                  );
                })}
              </p>
            ))}
          </div>
        )}

        {/* Nút điều hướng cuối trang: Chỉ 2 nút sang trang và trang trước */}
        <div className="pt-8 pb-4 flex items-center justify-between gap-3 select-none pointer-events-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              prevPage();
            }}
            disabled={currentPage <= 0}
            className="px-4 py-2 rounded-xl bg-stone-900/10 hover:bg-stone-900/20 dark:bg-white/10 dark:hover:bg-white/20 flex items-center gap-1.5 text-xs font-medium transition-all cursor-pointer disabled:opacity-20 active:scale-95 shadow-2xs"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Trang trước</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              nextPage();
            }}
            disabled={currentPage >= totalPages - 1}
            className="px-4 py-2 rounded-xl bg-stone-900/10 hover:bg-stone-900/20 dark:bg-white/10 dark:hover:bg-white/20 flex items-center gap-1.5 text-xs font-medium transition-all cursor-pointer disabled:opacity-20 active:scale-95 shadow-2xs"
          >
            <span>Trang sau</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 1. Nút nổi nhỏ ngay trên đoạn chữ vừa bôi đen */}
      {selectedRangeText && floatingMenuPos && (
        <div 
          style={{ top: `${floatingMenuPos.y}px`, left: `${floatingMenuPos.x}px` }}
          className="fixed z-50 animate-in fade-in zoom-in-95 duration-150 pointer-events-auto"
          onMouseDown={(e) => e.preventDefault()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={handleTriggerAI}
            className="py-1.5 px-3 bg-amber-700 hover:bg-amber-800 text-white font-semibold text-xs rounded-full shadow-2xl flex items-center gap-1.5 cursor-pointer ring-2 ring-white/60 active:scale-95 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-200 animate-pulse" />
            <span>Hỏi AI ngữ cảnh</span>
          </button>
        </div>
      )}

      {/* 2. Thanh Action Bar ghim dưới đáy màn hình khi có bôi đen */}
      {selectedRangeText && (
        <div 
          className="fixed bottom-6 inset-x-4 z-50 max-w-md mx-auto bg-stone-900 text-white rounded-2xl shadow-2xl p-3 border border-stone-700/80 animate-in slide-in-from-bottom duration-200 pointer-events-auto"
          onMouseDown={(e) => e.preventDefault()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex-1 truncate">
              <span className="text-[10px] uppercase font-bold text-amber-400 block tracking-wider">
                Đã chọn cụm/câu
              </span>
              <p className="text-xs text-stone-200 truncate italic">
                "{selectedRangeText}"
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => speakWithWebSpeech(selectedRangeText)}
                className="p-2 hover:bg-stone-800 text-stone-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                title="Đọc to câu này"
              >
                <Volume2 className="w-4 h-4 text-amber-300" />
              </button>

              <button
                type="button"
                onClick={handleQuickSavePhrase}
                className="p-2 hover:bg-stone-800 text-stone-300 hover:text-white rounded-xl transition-colors cursor-pointer flex items-center gap-1 text-xs"
                title="Lưu cụm từ này vào kho từ vựng"
              >
                <BookmarkPlus className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Lưu từ</span>
              </button>

              <button
                type="button"
                onClick={handleTriggerAI}
                className="py-2 px-3.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Sparkles className="w-4 h-4 text-amber-200" />
                <span>Hỏi AI</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedRangeText(null);
                  setFloatingMenuPos(null);
                  window.getSelection()?.removeAllRanges();
                }}
                className="p-1.5 text-stone-400 hover:text-white rounded-lg cursor-pointer"
                title="Hủy chọn"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}





      {/* Modal Danh sách Bookmark */}
      {showBookmarksModal && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setShowBookmarksModal(false)}
        >
          <div 
            className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <BookmarkIcon className="w-4 h-4 text-amber-600 fill-current" />
                <h3 className="font-bold text-base text-stone-900">
                  Dấu trang đã lưu ({bookmarks.length})
                </h3>
              </div>
              <button
                onClick={() => setShowBookmarksModal(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 space-y-2.5">
              {bookmarks.length === 0 ? (
                <div className="py-8 text-center text-stone-400 text-xs">
                  Chưa có dấu trang nào. Bấm nút "Bookmark" ở góc trên bên phải khi đọc để lưu trang nhé!
                </div>
              ) : (
                bookmarks.map((bm) => (
                  <div
                    key={bm.id}
                    onClick={() => {
                      goToTxtPage(bm.page_index);
                      setShowBookmarksModal(false);
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 ${
                      bm.page_index === currentPage
                        ? 'bg-amber-50/80 border-amber-300 ring-1 ring-amber-400'
                        : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-900">
                        {bm.title || `Trang ${bm.page_index + 1}`}
                      </span>
                      {bm.page_index === currentPage && (
                        <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-semibold">
                          Đang đọc trang này
                        </span>
                      )}
                    </div>
                    {bm.excerpt && (
                      <p className="text-xs text-stone-500 italic line-clamp-2">
                        "{bm.excerpt}"
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
