import React, { useState } from 'react';
import { BookOpen, KeyRound, User as UserIcon, ArrowRight, Sparkles } from 'lucide-react';
import { loginUser, registerUser } from '../services/api';
import { User, ReadingSettings } from '../types';

interface AuthScreenProps {
  onSuccess: (user: User, settings: ReadingSettings) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ tên tài khoản và mật khẩu');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isRegister) {
        const result = await registerUser(username.trim(), password.trim());
        onSuccess(result.user, result.settings);
      } else {
        const result = await loginUser(username.trim(), password.trim());
        onSuccess(result.user, result.settings);
      }
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f4ed] flex flex-col justify-center px-4 py-8 text-[#2d2926]">
      <div className="max-w-md w-full mx-auto">
        {/* App Logo & Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#2d2926] text-[#f7f4ed] shadow-lg mb-4">
            <BookOpen className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-serif font-bold tracking-tight text-[#2d2926]">
            Kindle English
          </h1>
          <p className="text-sm text-stone-600 mt-2">
            Đọc sách tiếng Anh chuẩn Kindle • Tra từ 1 chạm • Phân tích ngữ cảnh bằng AI
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-stone-200">
          <div className="flex border-b border-stone-100 mb-6">
            <button
              type="button"
              onClick={() => { setIsRegister(false); setError(null); }}
              className={`flex-1 pb-3 text-center font-medium text-base transition-colors ${
                !isRegister
                  ? 'text-[#2d2926] border-b-2 border-[#2d2926]'
                  : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => { setIsRegister(true); setError(null); }}
              className={`flex-1 pb-3 text-center font-medium text-base transition-colors ${
                isRegister
                  ? 'text-[#2d2926] border-b-2 border-[#2d2926]'
                  : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              Tạo tài khoản mới
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5">
                Tên đăng nhập
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <UserIcon className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ví dụ: robert"
                  required
                  autoCapitalize="none"
                  className="w-full pl-11 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:bg-white text-base"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider mb-1.5">
                Mật khẩu
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-11 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:bg-white text-base"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-4 bg-[#2d2926] hover:bg-black text-[#f7f4ed] font-medium rounded-xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 text-base cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isRegister ? 'Tạo tài khoản & Bắt đầu đọc' : 'Đăng nhập vào thư viện'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {isRegister && (
            <div className="mt-4 p-3 bg-stone-50 rounded-xl border border-stone-200/60 flex items-start gap-2.5 text-xs text-stone-600">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Khi tạo tài khoản, hệ thống sẽ tự động tặng sẵn 2 cuốn sách kinh điển (<strong>The Little Prince</strong> & <strong>Sherlock Holmes</strong>) để bạn đọc ngay.
              </span>
            </div>
          )}
        </div>

        <div className="text-center mt-6 text-xs text-stone-500">
          Dữ liệu sách và vị trí đọc được lưu độc lập trên SQLite của bạn
        </div>
      </div>
    </div>
  );
};
