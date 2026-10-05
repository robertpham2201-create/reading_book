// Text-to-Speech service using Web Speech API & audio fallback

export function speakWord(text: string, audioUrl?: string) {
  // Nếu có audio URL từ từ điển chuẩn, phát audio trước
  if (audioUrl && audioUrl.trim().length > 0) {
    try {
      const audio = new Audio(audioUrl);
      audio.play().catch(() => {
        // Fallback sang Web Speech Synthesis
        speakWithWebSpeech(text);
      });
      return;
    } catch {
      // Fallback
    }
  }

  speakWithWebSpeech(text);
}

export function speakWithWebSpeech(text: string, lang = 'en-US') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('Trình duyệt không hỗ trợ Web Speech API');
    return;
  }

  window.speechSynthesis.cancel(); // Dừng câu đang đọc dở

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.9; // Tốc độ hơi chậm một chút để nghe rõ phát âm

  // Cố gắng chọn giọng đọc tiếng Anh tự nhiên nếu có
  const voices = window.speechSynthesis.getVoices();
  const englishVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha')));
  if (englishVoice) {
    utterance.voice = englishVoice;
  }

  window.speechSynthesis.speak(utterance);
}
