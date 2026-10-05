import React, { useState } from 'react';
import { X, Type, Palette, Gauge } from 'lucide-react';
import { ReadingSettings, User } from '../types';
import { saveUserSettings } from '../services/api';

interface SettingsModalProps {
  user: User;
  settings: ReadingSettings;
  isOpen: boolean;
  onClose: () => void;
  onUpdateSettings: (settings: ReadingSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  user,
  settings,
  isOpen,
  onClose,
  onUpdateSettings,
}) => {
  const [currentSettings, setCurrentSettings] = useState<ReadingSettings>(settings);

  if (!isOpen) return null;

  const handleThemeChange = (theme: ReadingSettings['theme']) => {
    const updated = { ...currentSettings, theme };
    setCurrentSettings(updated);
    onUpdateSettings(updated);
    saveUserSettings(user.id, updated).catch(console.error);
  };

  const handleFontSizeChange = (fontSize: number) => {
    const updated = { ...currentSettings, fontSize };
    setCurrentSettings(updated);
    onUpdateSettings(updated);
    saveUserSettings(user.id, updated).catch(console.error);
  };

  const handleFontFamilyChange = (fontFamily: ReadingSettings['fontFamily']) => {
    const updated = { ...currentSettings, fontFamily };
    setCurrentSettings(updated);
    onUpdateSettings(updated);
    saveUserSettings(user.id, updated).catch(console.error);
  };

  const handleScrollSpeedChange = (scrollSpeed: number) => {
    const updated = { ...currentSettings, scrollSpeed };
    setCurrentSettings(updated);
    onUpdateSettings(updated);
    saveUserSettings(user.id, updated).catch(console.error);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h2 className="text-lg font-bold text-stone-900">Cài đặt đọc sách</h2>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-6 py-5 space-y-6">
          {/* Section: Reading Theme */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-stone-900 flex items-center gap-2">
              <Palette className="w-4 h-4 text-amber-600" />
              Màu giấy đọc sách
            </label>
            <div className="grid grid-cols-4 gap-2.5">
              {[
                { id: 'sepia', name: 'Sepia', bg: 'bg-[#f6efe2]', text: 'text-[#3b2f21]', border: 'border-[#dfd3be]' },
                { id: 'light', name: 'Trắng', bg: 'bg-[#ffffff]', text: 'text-[#1a1a1a]', border: 'border-stone-300' },
                { id: 'dark', name: 'Tối', bg: 'bg-[#23272e]', text: 'text-[#d1d5db]', border: 'border-stone-600' },
                { id: 'black', name: 'OLED', bg: 'bg-[#000000]', text: 'text-[#9ca3af]', border: 'border-stone-800' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleThemeChange(t.id as any)}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${t.bg} ${t.text} ${
                    currentSettings.theme === t.id
                      ? 'ring-2 ring-stone-900 shadow-sm scale-102 font-bold'
                      : t.border
                  }`}
                >
                  <span className="text-xs">{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          <hr className="border-stone-100" />

          {/* Section: Font Size */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                <Type className="w-4 h-4 text-amber-600" />
                Cỡ chữ ({currentSettings.fontSize}px)
              </label>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-stone-400">A</span>
              <input
                type="range"
                min="14"
                max="28"
                step="1"
                value={currentSettings.fontSize}
                onChange={(e) => handleFontSizeChange(Number(e.target.value))}
                className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-900"
              />
              <span className="text-base font-bold text-stone-700">A</span>
            </div>
          </div>

          <hr className="border-stone-100" />

          {/* Section: Font Family */}
          <div className="space-y-3 pb-2">
            <label className="text-sm font-semibold text-stone-900">
              Phông chữ sách
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'Bookerly', label: 'Literata (Kindle)' },
                { id: 'Merriweather', label: 'Merriweather' },
                { id: 'Georgia', label: 'Georgia' },
                { id: 'Sans', label: 'Sans-Serif' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => handleFontFamilyChange(f.id as any)}
                  className={`py-2.5 px-3 text-xs rounded-xl border transition-all cursor-pointer ${
                    currentSettings.fontFamily === f.id
                      ? 'bg-stone-900 text-white border-stone-900 font-semibold shadow-xs'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <hr className="border-stone-100" />

          {/* Section: Auto-Scroll Speed */}
          <div className="space-y-3 pb-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                <Gauge className="w-4 h-4 text-amber-600" />
                Tốc độ tự cuộn trang
              </label>
              <span className="text-xs font-bold text-amber-700 font-mono">
                {[
                  'Mức 1: Siêu chậm (~7px/s)',
                  'Mức 2: Cực chậm (~14px/s)',
                  'Mức 3: Rất chậm (~24px/s)',
                  'Mức 4: Chậm vừa (~45px/s)',
                  'Mức 5: Vừa (~75px/s)',
                  'Mức 6: Nhanh (~115px/s)',
                  'Mức 7: Rất nhanh (~165px/s)',
                ][(currentSettings.scrollSpeed || 2) - 1] || 'Mức 2: Cực chậm'}
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {[
                { id: 1, label: '1', short: 'Siêu', name: 'Siêu chậm (~7px/s)' },
                { id: 2, label: '2', short: 'Cực', name: 'Cực chậm (~14px/s)' },
                { id: 3, label: '3', short: 'R.Chậm', name: 'Rất chậm (~24px/s)' },
                { id: 4, label: '4', short: 'Chậm', name: 'Chậm vừa (~45px/s)' },
                { id: 5, label: '5', short: 'Vừa', name: 'Vừa (~75px/s)' },
                { id: 6, label: '6', short: 'Nhanh', name: 'Nhanh (~115px/s)' },
                { id: 7, label: '7', short: 'R.Nhanh', name: 'Rất nhanh (~165px/s)' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleScrollSpeedChange(s.id)}
                  className={`py-2 px-0.5 text-center rounded-xl border transition-all cursor-pointer ${
                    (currentSettings.scrollSpeed || 2) === s.id
                      ? 'bg-amber-600 text-white border-amber-600 font-bold shadow-xs'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100 text-xs'
                  }`}
                  title={s.name}
                >
                  <div className="text-xs font-semibold">{s.label}</div>
                  <div className="text-[9px] opacity-80 truncate">{s.short}</div>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-stone-500 italic text-center">
              ⏱️ Tự động đợi 10 giây ở đầu trang mới trước khi bắt đầu cuộn tiếp.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
