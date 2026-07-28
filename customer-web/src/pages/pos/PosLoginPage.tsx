import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Utensils, Lock, Mail, Eye, EyeOff, AlertTriangle, ArrowLeft, LogIn, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isInternalRole, normalizeUserRole } from '@/types';

function resolveSafeRedirect(
  role: string | null | undefined,
  redirectParam: string | null,
  fromState?: { pathname?: string; search?: string }
): string {
  const normalized = normalizeUserRole(role);
  if (normalized === 'KITCHEN') {
    return '/kds';
  }

  const candidate =
    redirectParam ||
    (fromState?.pathname ? `${fromState.pathname}${fromState.search || ''}` : '');

  if (
    candidate &&
    (candidate.startsWith('/pos') || candidate.startsWith('/kds')) &&
    !candidate.startsWith('/pos/login')
  ) {
    return candidate;
  }
  return '/pos';
}

export const PosLoginPage: React.FC = () => {
  const { currentUser, isAuthenticated, login, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fromState = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
  const redirectTarget = resolveSafeRedirect(currentUser?.role, searchParams.get('redirect'), fromState);

  if (isAuthenticated && currentUser && isInternalRole(currentUser.role)) {
    return <Navigate to={redirectTarget} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Vui lòng nhập đầy đủ Email/Số điện thoại và Mật khẩu.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const user = await login(identifier.trim(), password);
      const role = normalizeUserRole(user.role);

      if (role === 'CUSTOMER') {
        logout();
        setError('Tài khoản khách hàng không có quyền truy cập hệ thống POS và KDS.');
        return;
      }

      if (role === 'KITCHEN') {
        navigate('/kds', { replace: true });
        return;
      }

      const target = resolveSafeRedirect(role, searchParams.get('redirect'), fromState);
      navigate(target, { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col justify-center items-center p-4 font-sans">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
        {/* Brand Header */}
        <div className="px-6 py-6 bg-slate-900 text-white flex items-center gap-3.5 border-b border-slate-800">
          <div className="w-11 h-11 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0 shadow-md">
            <Utensils className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-wide uppercase">SAKURA RESTAURANT</h1>
            <p className="text-xs text-emerald-400 font-semibold">
              Đăng Nhập Hệ Thống POS & Bếp KDS
            </p>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-start gap-2.5"
            >
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="pos-login-identifier" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Tài khoản nhân viên
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                id="pos-login-identifier"
                type="text"
                autoComplete="username"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Nhập tài khoản (Email hoặc số điện thoại)"
                className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>
          </div>

          <div>
            <label htmlFor="pos-login-password" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Mật khẩu
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                id="pos-login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu..."
                className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                className="absolute right-3 top-2.5 p-0.5 text-slate-400 hover:text-slate-700"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-colors"
          >
            <LogIn className="w-4 h-4" />
            <span>{isSubmitting ? 'Đang xác thực...' : 'Đăng Nhập Vào Hệ Thống'}</span>
          </button>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Về trang khách hàng</span>
            </Link>
            <span>Yêu cầu phân quyền Nhân viên trở lên</span>
          </div>
        </form>
      </div>
    </div>
  );
};
