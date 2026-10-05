// Text-to-Speech service using Xiaomi MiMo TTS (mimo-v2.5-tts) & Web Speech API fallback

let currentAudio: HTMLAudioElement | null = null;

/**
 * Dừng mọi âm thanh đang phát
 */
export function stopAudio(): void {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {}
    currentAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}

/**
 * Phát âm thanh bằng Web Speech API cục bộ của trình duyệt (phương án dự phòng khi offline/mất mạng)
 */
export function fallbackWebSpeech(text: string, lang = 'en-US'): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('Trình duyệt không hỗ trợ Web Speech API');
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
    console.error('[WebSpeech] Lỗi phát âm thanh:', e);
  }
}

/**
 * Phát âm thanh chất lượng cao bằng AI Xiaomi MiMo TTS (mimo-v2.5-tts)
 */
export async function playAiTts(text: string, voice = 'Chloe'): Promise<void> {
  const clean = text?.trim();
  if (!clean) return;

  stopAudio();

  try {
    const audioUrl = `/api/ai/tts?text=${encodeURIComponent(clean)}&voice=${encodeURIComponent(voice)}`;
    const audio = new Audio(audioUrl);
    currentAudio = audio;

    await audio.play();
  } catch (err) {
    console.warn('[TTS] Không thể phát âm thanh qua Xiaomi MiMo TTS, chuyển sang Web Speech:', err);
    fallbackWebSpeech(clean);
  }
}

/**
 * Phát âm từ vựng (ưu tiên audioUrl gốc từ điển nếu có, sau đó là Xiaomi MiMo TTS, fallback Web Speech)
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
 * Đọc to câu/đoạn văn bản (tự động sử dụng giọng đọc tự nhiên Xiaomi MiMo TTS, fallback sang Web Speech)
 */
export function speakWithWebSpeech(text: string, lang = 'en-US'): void {
  playAiTts(text).catch(() => {
    fallbackWebSpeech(text, lang);
  });
}
