import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, User as UserIcon, Phone, CheckCircle2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, authModalView, authPromptMessage, closeAuthModal, openAuthModal, login, register, forgotPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthModalOpen) {
      setMessage(null);
      setError(null);
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAuthModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthModalOpen, closeAuthModal]);

  if (!isAuthModalOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err?.message || 'Đăng nhập không thành công.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !fullName || !phone) return;
    setIsLoading(true);
    setError(null);
    try {
      await register(fullName, email, phone, password);
    } catch (err: any) {
      setError(err?.message || 'Đăng ký không thành công.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);
    await forgotPassword(email);
    setIsLoading(false);
    setMessage(`Hướng dẫn khôi phục mật khẩu đã được gửi đến email: ${email}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={closeAuthModal}
        aria-hidden="true"
      />

      <div className="relative bg-sumi-950 border border-kin-500/30 rounded-2xl max-w-md w-full max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden text-washi-100 z-10">
        {/* Japanese Header Banner */}
        <div className="relative bg-gradient-to-r from-shu-950 via-sumi-900 to-shu-950 p-5 sm:p-6 border-b border-kin-500/20 text-center shrink-0">
          <button
            type="button"
            onClick={closeAuthModal}
            aria-label="Đóng cửa sổ đăng nhập"
            className="absolute top-4 right-4 p-1.5 rounded-full bg-sumi-900/80 hover:bg-sumi-800 text-washi-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-kin-500/50 bg-sumi-900 shadow-gold-glow mb-2">
            <span className="font-kanji text-kin-400 text-2xl font-bold">桜</span>
          </div>
          <h3 id="auth-modal-title" className="font-serif text-xl font-bold text-washi-100">
            {authModalView === 'login' && 'Chào Mừng Quý Khách'}
            {authModalView === 'register' && 'Đăng Ký Thành Viên'}
            {authModalView === 'forgot' && 'Khôi Phục Mật Khẩu'}
          </h3>
          <p className="text-xs text-washi-300 mt-1">
            {authModalView === 'login' && 'Đăng nhập để nhận ưu đãi thành viên và theo dõi đơn hàng'}
            {authModalView === 'register' && 'Tận hưởng quyền lợi VIP và tích điểm trên mỗi lượt thưởng thức'}
            {authModalView === 'forgot' && 'Nhập email đã đăng ký để nhận mã xác minh khôi phục'}
          </p>
        </div>

        {/* Content Form */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-5 sm:p-6 space-y-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6">
          {error && (
            <div className="p-3 rounded-xl bg-shu-950/80 border border-shu-500/50 text-shu-200 text-xs flex items-center space-x-2">
              <span>{error}</span>
            </div>
          )}

          {authPromptMessage && (
            <div className="p-3 rounded-xl bg-kin-500/15 border border-kin-500/40 text-kin-300 text-xs flex items-center space-x-2">
              <span className="font-bold text-kin-400">❖</span>
              <span>{authPromptMessage}</span>
            </div>
          )}

          {message && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{message}</span>
            </div>
          )}

          {authModalView === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-washi-300 mb-1">Tài khoản</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-washi-500" />
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Nhập tài khoản (Email hoặc số điện thoại)"
                    className="w-full bg-sumi-900 border border-sumi-700 rounded-xl pl-10 pr-4 py-2.5 text-base sm:text-xs text-washi-100 placeholder:text-washi-500 focus:outline-none focus:border-kin-400 transition-colors"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium text-washi-300">Mật khẩu</label>
                  <button
                    type="button"
                    onClick={() => {
                      setMessage(null);
                      openAuthModal('forgot');
                    }}
                    className="text-[11px] text-kin-400 hover:underline"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-washi-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu của bạn"
                    className="w-full bg-sumi-900 border border-sumi-700 rounded-xl pl-10 pr-4 py-2.5 text-base sm:text-xs text-washi-100 placeholder:text-washi-500 focus:outline-none focus:border-kin-400 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl font-semibold text-xs text-white bg-gradient-to-r from-shu-700 to-shu-600 hover:from-shu-600 hover:to-shu-500 border border-kin-500/40 shadow-lg shadow-shu-950/60 transition-all"
              >
                {isLoading ? 'Đang xác thực...' : 'Đăng Nhập'}
              </button>

              <div className="text-center pt-2 text-xs text-washi-400">
                Chưa có tài khoản?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMessage(null);
                    openAuthModal('register');
                  }}
                  className="font-semibold text-kin-400 hover:underline"
                >
                  Đăng ký ngay
                </button>
              </div>
            </form>
          )}

          {authModalView === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-washi-300 mb-1">Họ và tên</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-washi-500" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full bg-sumi-900 border border-sumi-700 rounded-xl pl-10 pr-4 py-2.5 text-base sm:text-xs text-washi-100 placeholder:text-washi-500 focus:outline-none focus:border-kin-400 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-washi-300 mb-1">Số điện thoại</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-washi-500" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0901234567"
                    className="w-full bg-sumi-900 border border-sumi-700 rounded-xl pl-10 pr-4 py-2.5 text-base sm:text-xs text-washi-100 placeholder:text-washi-500 focus:outline-none focus:border-kin-400 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-washi-300 mb-1">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-washi-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full bg-sumi-900 border border-sumi-700 rounded-xl pl-10 pr-4 py-2.5 text-base sm:text-xs text-washi-100 placeholder:text-washi-500 focus:outline-none focus:border-kin-400 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-washi-300 mb-1">Mật khẩu</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-washi-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className="w-full bg-sumi-900 border border-sumi-700 rounded-xl pl-10 pr-4 py-2.5 text-base sm:text-xs text-washi-100 placeholder:text-washi-500 focus:outline-none focus:border-kin-400 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl font-semibold text-xs text-white bg-gradient-to-r from-shu-700 to-shu-600 hover:from-shu-600 hover:to-shu-500 border border-kin-500/40 shadow-lg shadow-shu-950/60 transition-all"
              >
                {isLoading ? 'Đang xử lý...' : 'Tạo Tài Khoản Thành Viên'}
              </button>

              <div className="text-center pt-2 text-xs text-washi-400">
                Đã có tài khoản?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMessage(null);
                    openAuthModal('login');
                  }}
                  className="font-semibold text-kin-400 hover:underline"
                >
                  Đăng nhập
                </button>
              </div>
            </form>
          )}

          {authModalView === 'forgot' && (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-washi-300 mb-1">Email đăng ký tài khoản</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-washi-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Nhập email của bạn"
                    className="w-full bg-sumi-900 border border-sumi-700 rounded-xl pl-10 pr-4 py-2.5 text-base sm:text-xs text-washi-100 placeholder:text-washi-500 focus:outline-none focus:border-kin-400 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl font-semibold text-xs text-white bg-shu-700 hover:bg-shu-600 border border-kin-500/40 transition-colors"
              >
                {isLoading ? 'Đang gửi...' : 'Gửi Mã Khôi Phục'}
              </button>

              <div className="text-center pt-2 text-xs text-washi-400">
                <button
                  type="button"
                  onClick={() => openAuthModal('login')}
                  className="font-semibold text-kin-400 hover:underline"
                >
                  ← Quay lại Đăng nhập
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
