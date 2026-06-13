import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  X, 
  Calendar, 
  ShoppingBag, 
  Phone, 
  MapPin, 
  User, 
  ChevronRight 
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  navLinks: Array<{ name: string; path: string; badge?: string }>;
  cartCount?: number;
  onOpenCart?: () => void;
  onOpenAuth?: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  isOpen,
  onClose,
  navLinks,
  cartCount = 0,
  onOpenCart,
  onOpenAuth,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, isAuthenticated, openAuthModal, logout } = useAuth();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Menu điều hướng"
    >
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        id="mobile-navigation-drawer"
        className="fixed inset-y-0 right-0 max-w-xs w-full bg-sumi-950/95 backdrop-blur-xl border-l border-kin-500/25 px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl flex flex-col justify-between overflow-y-auto overflow-x-hidden"
      >
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-6 border-b border-kin-500/20">
            <div className="flex items-center space-x-2.5">
              <span className="font-kanji text-kin-400 text-2xl font-bold">桜</span>
              <span className="font-serif text-lg font-bold text-washi-100 tracking-wider">
                SAKURA
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng menu điều hướng"
              className="p-2 rounded-full text-washi-300 hover:text-kin-400 hover:bg-sumi-900 border border-kin-500/20"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="mt-6 space-y-2">
            {navLinks.map((link) => {
              const active = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={(e) => {
                    onClose();
                    if (link.path === '/reservation' && !isAuthenticated) {
                      e.preventDefault();
                      openAuthModal('login', 'Quý khách vui lòng đăng nhập để đặt bàn giữ chỗ.');
                    }
                  }}
                  className={`flex items-center justify-between px-4 py-3 rounded-lg text-base transition-colors ${
                    active 
                      ? 'bg-sumi-900 text-kin-400 font-semibold border-l-4 border-kin-500' 
                      : 'text-washi-200 hover:bg-sumi-900/60 hover:text-washi-100'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span>{link.name}</span>
                    {link.badge && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-shu-800 text-kin-200 border border-shu-600/50">
                        {link.badge}
                      </span>
                    )}
                  </div>
                  <ChevronRight className={`w-4 h-4 ${active ? 'text-kin-400' : 'text-sumi-400'}`} />
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Actions */}
        <div className="pt-6 border-t border-kin-500/20 space-y-4">
          {/* Action Row: Cart & Auth */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                onClose();
                if (!isAuthenticated) {
                  openAuthModal('login', 'Quý khách vui lòng đăng nhập để xem và quản lý giỏ hàng.');
                  return;
                }
                if (onOpenCart) onOpenCart();
              }}
              className="flex items-center justify-center space-x-2 py-2.5 px-3 rounded-lg bg-sumi-900 border border-kin-500/30 text-xs font-medium text-washi-100 hover:text-kin-400 whitespace-nowrap min-w-0"
            >
              <ShoppingBag className="w-4 h-4 text-kin-400 shrink-0" />
              <span>Giỏ hàng {isAuthenticated && cartCount > 0 ? `(${cartCount})` : ''}</span>
            </button>

            {!isAuthenticated ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onOpenAuth) onOpenAuth();
                  else openAuthModal('login');
                }}
                className="flex items-center justify-center space-x-2 py-2.5 px-3 rounded-lg bg-sumi-900 border border-kin-500/30 text-xs font-medium text-washi-100 hover:text-kin-400 whitespace-nowrap min-w-0"
              >
                <User className="w-4 h-4 text-kin-400 shrink-0" />
                <span>Đăng nhập</span>
              </button>
            ) : (
              <Link
                to="/profile?tab=profile"
                onClick={onClose}
                className="flex items-center justify-center space-x-2 py-2.5 px-3 rounded-lg bg-sumi-900 border border-kin-500/30 text-xs font-medium text-kin-300 hover:text-kin-200 whitespace-nowrap min-w-0"
              >
                <User className="w-4 h-4 text-kin-400 shrink-0" />
                <span>Hồ sơ & Điểm thành viên</span>
              </Link>
            )}
          </div>

          {isAuthenticated && (
            <div className="p-3 rounded-xl bg-sumi-900/80 border border-kin-500/20 flex items-center justify-between text-xs gap-2">
              <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                {currentUser?.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.fullName || 'User Avatar'}
                    className="w-9 h-9 rounded-full object-cover border border-kin-400/40 shadow-sm shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-kin-500 to-kin-700 text-sumi-950 font-bold text-xs flex items-center justify-center border border-kin-300 shadow-sm shrink-0">
                    {currentUser?.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-bold text-washi-100 truncate">{currentUser?.fullName}</div>
                  <div className="text-[10px] text-kin-400 font-mono">Hạng {currentUser?.membershipTier} • {currentUser?.loyaltyPoints || 0} pts</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  logout();
                }}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-shu-400 hover:bg-shu-950/60 border border-shu-600/30 shrink-0"
              >
                Đăng xuất
              </button>
            </div>
          )}

          {/* Direct Reservation CTA */}
          <button
            type="button"
            onClick={() => {
              onClose();
              if (!isAuthenticated) {
                openAuthModal('login', 'Quý khách vui lòng đăng nhập để đặt bàn giữ chỗ.');
                return;
              }
              navigate('/reservation');
            }}
            className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-shu-700 via-shu-600 to-shu-700 border border-kin-500/40 shadow-lg shadow-shu-950/80 hover:brightness-110 transition-all"
          >
            <Calendar className="w-4 h-4 shrink-0" />
            <span>Đặt bàn trực tuyến ngay</span>
          </button>

          {/* Quick Hotline & Address */}
          <div className="bg-sumi-900/50 rounded-lg p-3 text-xs space-y-2 border border-sumi-800">
            <a 
              href="tel:19008899" 
              className="flex items-center space-x-2 text-kin-400 hover:text-kin-300 font-medium"
            >
              <Phone className="w-3.5 h-3.5 shrink-0" />
              <span>Hotline: 1900 8899 (10:30 - 22:30)</span>
            </a>
            <div className="flex items-center space-x-2 text-washi-300 min-w-0">
              <MapPin className="w-3.5 h-3.5 text-sumi-400 shrink-0" />
              <span className="truncate">15A/2 Lê Thánh Tôn, Bến Nghé, Quận 1</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
