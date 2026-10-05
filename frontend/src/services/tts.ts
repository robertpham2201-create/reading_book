// Text-to-Speech service: Ưu tiên Xiaomi MiMo TTS (mimo-v2.5-tts), chỉ fallback sang Web Speech khi có lỗi

let currentAudio: HTMLAudioElement | null = null;
let currentBlobUrl: string | null = null;
let activeAbortController: AbortController | null = null;

/**
 * Dừng hoàn toàn mọi âm thanh đang phát hoặc yêu cầu đang tải
 */
export function stopAudio(): void {
  // 1. Huỷ yêu cầu fetch đang chờ phản hồi
  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }

  // 2. Dừng audio player
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio.src = '';
    } catch {}
    currentAudio = null;
  }

  // 3. Giải phóng bộ nhớ blob URL cũ
  if (currentBlobUrl) {
    try {
      URL.revokeObjectURL(currentBlobUrl);
    } catch {}
    currentBlobUrl = null;
  }

  // 4. Hủy Web Speech Synthesis của trình duyệt nếu đang nói dở
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}

/**
 * Phát âm thanh bằng Web Speech API cục bộ của trình duyệt
 * (CHỈ ĐƯỢC GỌI LÀM FALLBACK khi Xiaomi MiMo TTS thực sự bị lỗi mạng/server hoặc offline)
 */
export function fallbackWebSpeech(text: string, lang = 'en-US'): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('[WebSpeech] Trình duyệt không hỗ trợ Web Speech API');
    return;
  }

  try {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9;

    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(
      (v) =>
        v.lang.startsWith('en') &&
        (v.name.includes('Natural') ||
          v.name.includes('Google') ||
          v.name.includes('Samantha') ||
          v.name.includes('Jenny'))
    );
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.error('[WebSpeech] Lỗi phát âm thanh fallback:', e);
  }
}

/**
 * Phát âm bằng AI Xiaomi MiMo TTS (mimo-v2.5-tts - giọng đọc phòng thu cao cấp).
 * Quy trình:
 * 1. Dừng mọi âm thanh cũ và Web Speech.
 * 2. Tải file âm thanh qua fetch từ backend (/api/ai/tts).
 * 3. Chuyển thành Blob URL và phát âm thanh.
 * 4. NẾU VÀ CHỈ NẾU Xiaomi MiMo TTS gặp sự cố thì mới kích hoạt fallback sang Web Speech.
 */
export async function playAiTts(text: string, voice = 'Chloe'): Promise<void> {
  const clean = text?.trim();
  if (!clean) return;

  // Dừng mọi âm thanh cũ và huỷ yêu cầu đang chờ trước khi bắt đầu
  stopAudio();

  const abortController = new AbortController();
  activeAbortController = abortController;

  try {
    const isLongText = clean.length > 150;
    const url = `/api/ai/tts${!isLongText ? `?text=${encodeURIComponent(clean)}&voice=${encodeURIComponent(voice)}` : ''}`;

    const res = await fetch(url, {
      method: isLongText ? 'POST' : 'GET',
      headers: isLongText ? { 'Content-Type': 'application/json' } : undefined,
      body: isLongText ? JSON.stringify({ text: clean, voice }) : undefined,
      signal: abortController.signal,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.error || `Server TTS trả về HTTP ${res.status}`);
    }

    const blob = await res.blob();
    if (!blob || blob.size === 0) {
      throw new Error('Dữ liệu âm thanh nhận về bị rỗng');
    }

    // Nếu người dùng đã click từ khác hoặc đóng trong lúc chờ tải thì hủy bỏ
    if (abortController.signal.aborted) {
      return;
    }

    const blobUrl = URL.createObjectURL(blob);
    currentBlobUrl = blobUrl;

    const audio = new Audio(blobUrl);
    currentAudio = audio;

    audio.onended = () => {
      if (currentBlobUrl === blobUrl) {
        URL.revokeObjectURL(blobUrl);
        currentBlobUrl = null;
      }
      if (currentAudio === audio) {
        currentAudio = null;
      }
    };

    audio.onerror = () => {
      if (currentBlobUrl === blobUrl) {
        URL.revokeObjectURL(blobUrl);
        currentBlobUrl = null;
      }
      if (currentAudio === audio) {
        currentAudio = null;
      }
      // Khi phát thẻ audio thất bại mới kích hoạt fallback
      fallbackWebSpeech(clean);
    };

    await audio.play();
  } catch (err: any) {
    // Nếu người dùng chủ động click sang từ khác (AbortError) thì không kích hoạt fallback
    if (err?.name === 'AbortError') {
      return;
    }

    console.warn('[TTS] Xiaomi MiMo TTS không khả dụng, chuyển sang Web Speech:', err?.message || err);
    stopAudio();
    fallbackWebSpeech(clean);
  } finally {
    if (activeAbortController === abortController) {
      activeAbortController = null;
    }
  }
}

/**
 * Phát âm từ vựng (ưu tiên audioUrl từ điển chuẩn, tiếp theo là Xiaomi MiMo TTS, cuối cùng mới fallback Web Speech)
 */
export function speakWord(text: string, audioUrl?: string): void {
  if (audioUrl && audioUrl.trim().length > 0) {
    try {
      stopAudio();
      const audio = new Audio(audioUrl);
      currentAudio = audio;
      audio.play().catch(() => {
        playAiTts(text);
      });
      return;
    } catch {
      // Fallback
    }
  }

  playAiTts(text);
}

/**
 * Đọc to câu/đoạn văn bản (Ưu tiên Xiaomi MiMo TTS tự nhiên, CHỈ fallback sang Web Speech khi có sự cố)
 */
export function speakWithWebSpeech(text: string, _lang = 'en-US'): void {
  playAiTts(text);
}
