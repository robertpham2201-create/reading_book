export interface User {
  id: number;
  username: string;
}

export interface ReadingSettings {
  theme: 'light' | 'sepia' | 'dark' | 'black';
  fontSize: number;
  fontFamily: 'Bookerly' | 'Merriweather' | 'Georgia' | 'Sans';
  lineHeight: number;
  scrollSpeed?: number;
}

export interface Book {
  id: number;
  user_id: number;
  title: string;
  author: string;
  format: 'epub' | 'txt';
  current_location: string;
  progress_percent: number;
  last_read_at?: string;
  created_at?: string;
}

export interface Bookmark {
  id: number;
  user_id: number;
  book_id: number;
  page_index: number;
  title: string;
  excerpt: string;
  created_at: string;
}

export interface WordData {
  word: string;
  ipa?: string;
  description?: string;
  html?: string;
}

export interface AIExplanationData {
  translation: string;
  why: string;
  grammarAndIdioms: Array<{
    element: string;
    explanation: string;
  }>;
  usageTip?: string;
}

export interface VocabularyItem {
  id: number;
  user_id: number;
  book_id?: number | null;
  book_title?: string | null;
  word: string;
  ipa?: string;
  meaning: string;
  sentence_context?: string;
  created_at: string;
}
