import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  ShoppingBag, 
  Menu, 
  X, 
  Calendar, 
  User,
  LogOut,
  ChevronDown,
  MapPin,
  Package,
  KeyRound,
  Award,
  Sparkles,
  Utensils,
  Flame
} from 'lucide-react';
import { MobileNav } from './MobileNav';
import { useAuth } from '@/context/AuthContext';
import { isStaffRole } from '@/types';

interface NavbarProps {
  cartCount?: number;
  onOpenCart?: () => void;
  onOpenAuth?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  cartCount = 0, 
  onOpenCart, 
  onOpenAuth 
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, isAuthenticated, openAuthModal, logout } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Trang chủ', path: '/' },
    { name: 'Thực đơn', path: '/menu', badge: '3D' },
    { name: 'Đặt bàn', path: '/reservation' },
    { name: 'Giới thiệu', path: '/about' },
    { name: 'Địa điểm', path: '/location' },
    { name: 'Blog', path: '/blog' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <header
        className={`sticky top-0 z-40 w-full transition-all duration-300 ${
          isScrolled
            ? 'bg-sumi-950/95 backdrop-blur-xl border-b border-kin-500/25 shadow-xl shadow-black/50 py-3'
            : 'bg-sumi-950/80 backdrop-blur-md border-b border-kin-500/10 py-4 lg:py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-2">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-3 group min-w-0">
              <div className="relative w-10 h-10 shrink-0 rounded-full border border-kin-500/50 flex items-center justify-center bg-sumi-900 group-hover:border-kin-400 group-hover:shadow-gold-glow transition-all duration-300">
                <span className="font-kanji text-kin-400 text-xl font-bold">桜</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-serif text-xl sm:text-2xl font-bold tracking-wider text-washi-100 group-hover:text-kin-400 transition-colors">
                  SAKURA
                </span>
                <span className="text-[9px] tracking-[0.25em] text-kin-500/90 font-medium uppercase truncate">
                  Japanese Fine Dining
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center space-x-4 xl:space-x-7">
              {navLinks.map((link) => {
                const active = isActive(link.path);
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={(e) => {
                      if (link.path === '/reservation' && !isAuthenticated) {
                        e.preventDefault();
                        openAuthModal('login', 'Quý khách vui lòng đăng nhập để đặt bàn giữ chỗ.');
                      }
                    }}
                    className={`relative text-sm tracking-wide transition-colors py-1 group whitespace-nowrap ${
                      active 
                        ? 'text-kin-400 font-semibold' 
                        : 'text-washi-200/90 hover:text-washi-100'
                    }`}
                  >
                    <span>{link.name}</span>
                    {link.badge && (
                      <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-shu-800 text-kin-200 border border-shu-600/50">
                        {link.badge}
                      </span>
                    )}
                    {/* Active/Hover Underline */}
                    <span 
                      className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-kin-500 to-kin-300 transition-all duration-300 ${
                        active ? 'w-full' : 'w-0 group-hover:w-full'
                      }`} 
                    />
                  </Link>
                );
              })}
            </nav>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2 sm:space-x-3 xl:space-x-4 shrink-0">
              {/* Cart Button with dynamic counter */}
              <button
                type="button"
                onClick={() => {
                  if (!isAuthenticated) {
                    openAuthModal('login', 'Quý khách vui lòng đăng nhập để xem và quản lý giỏ hàng.');
                    return;
                  }
                  if (onOpenCart) onOpenCart();
                }}
                aria-label={`Giỏ hàng ${cartCount} món`}
                className="relative p-2.5 rounded-full text-washi-200 hover:text-kin-400 bg-sumi-900/80 hover:bg-sumi-800 border border-kin-500/20 hover:border-kin-500/50 transition-all duration-200"
              >
                <ShoppingBag className="w-5 h-5" />
                {isAuthenticated && cartCount > 0 && (
                  <span 
                    role="status" 
                    aria-atomic="true"
                    aria-label={`${cartCount} món trong giỏ hàng`}
                    className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-shu-600 text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-sumi-950 shadow-md"
                  >
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </button>

              {/* User Account / Profile Dropdown */}
              {!isAuthenticated ? (
                <button
                  type="button"
                  onClick={onOpenAuth || (() => openAuthModal('login'))}
                  aria-label="Đăng nhập tài khoản"
                  className="hidden sm:flex items-center space-x-1.5 px-3.5 py-2 rounded-full text-xs font-semibold text-washi-200 hover:text-kin-400 bg-sumi-900/60 hover:bg-sumi-800 border border-kin-500/25 transition-all whitespace-nowrap shadow-sm"
                >
                  <User className="w-3.5 h-3.5 text-kin-400 shrink-0" />
                  <span>Đăng nhập</span>
                </button>
              ) : (
                <div className="relative hidden sm:block">
                  <button
                    type="button"
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center space-x-2 py-1.5 pl-2 pr-3 rounded-full bg-sumi-900/90 hover:bg-sumi-800 border border-kin-500/40 text-xs font-semibold text-washi-100 hover:text-kin-300 transition-all shadow-md group"
                  >
                    {currentUser?.avatarUrl ? (
                      <img
                        src={currentUser.avatarUrl}
                        alt={currentUser.fullName || 'User Avatar'}
                        className="w-6 h-6 rounded-full object-cover border border-kin-300 shadow-sm shrink-0"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-kin-500 to-kin-700 text-sumi-950 font-bold text-[11px] flex items-center justify-center border border-kin-300 shadow-sm shrink-0">
                        {currentUser?.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}
                    <span className="max-w-[110px] truncate">{currentUser?.fullName}</span>
                    <span className="px-1.5 py-0.5 text-[9px] rounded-full bg-shu-900/80 text-kin-300 border border-shu-600/40 font-mono">
                      {currentUser?.membershipTier || 'SILVER'}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-kin-400 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  {isUserMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsUserMenuOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-sumi-950/95 border-2 border-kin-500/40 shadow-2xl shadow-black p-3.5 z-50 backdrop-blur-2xl space-y-3 animate-fade-in text-xs">
                        {/* User Header Summary */}
                        <Link
                          to="/profile?tab=profile"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center space-x-3 p-2.5 rounded-xl bg-sumi-900/80 hover:bg-sumi-800 border border-kin-500/20 hover:border-kin-500/40 transition-colors"
                        >
                          {currentUser?.avatarUrl ? (
                            <img
                              src={currentUser.avatarUrl}
                              alt={currentUser.fullName || 'User Avatar'}
                              className="w-10 h-10 rounded-full object-cover border border-kin-400/50 shadow-md shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-kin-500 to-kin-700 text-sumi-950 font-bold text-sm flex items-center justify-center border border-kin-300 shadow-md shrink-0">
                              {currentUser?.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
                            </div>
                          )}
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="font-bold text-washi-100 text-sm truncate">{currentUser?.fullName}</div>
                            <div className="text-[11px] text-washi-400 truncate">{currentUser?.email}</div>
                            <div className="pt-1 flex items-center justify-between text-[11px] border-t border-sumi-800/80">
                              <span className="text-kin-400 font-semibold flex items-center gap-1">
                                <Award className="w-3.5 h-3.5 text-kin-400" />
                                Hạng {currentUser?.membershipTier || 'Thành viên'}
                              </span>
                              <span className="font-mono text-washi-300">{currentUser?.loyaltyPoints || 0} pts</span>
                            </div>
                          </div>
                        </Link>

                        {/* Menu Links */}
                        <div className="space-y-1">
                          <Link
                            to="/profile?tab=profile"
                            onClick={() => setIsUserMenuOpen(false)}
                            className="flex items-center space-x-2.5 px-3 py-2 rounded-xl text-washi-200 hover:text-kin-300 hover:bg-sumi-900 transition-colors"
                          >
                            <Award className="w-4 h-4 text-kin-400 shrink-0" />
                            <span>Hạng thành viên & Điểm tích lũy</span>
                          </Link>

                          <Link
                            to="/profile?tab=addresses"
                            onClick={() => setIsUserMenuOpen(false)}
                            className="flex items-center space-x-2.5 px-3 py-2 rounded-xl text-washi-200 hover:text-kin-300 hover:bg-sumi-900 transition-colors"
                          >
                            <MapPin className="w-4 h-4 text-kin-400 shrink-0" />
                            <span>Sổ địa chỉ nhận hàng</span>
                          </Link>

                          <Link
                            to="/profile?tab=orders"
                            onClick={() => setIsUserMenuOpen(false)}
                            className="flex items-center space-x-2.5 px-3 py-2 rounded-xl text-washi-200 hover:text-kin-300 hover:bg-sumi-900 transition-colors"
                          >
                            <Package className="w-4 h-4 text-kin-400 shrink-0" />
                            <span>Lịch sử & Theo dõi đơn hàng</span>
                          </Link>

                          <Link
                            to="/profile?tab=reservations"
                            onClick={() => setIsUserMenuOpen(false)}
                            className="flex items-center space-x-2.5 px-3 py-2 rounded-xl text-washi-200 hover:text-kin-300 hover:bg-sumi-900 transition-colors"
                          >
                            <Calendar className="w-4 h-4 text-kin-400 shrink-0" />
                            <span>Lịch sử đặt bàn</span>
                          </Link>

                          <Link
                            to="/profile?tab=security"
                            onClick={() => setIsUserMenuOpen(false)}
                            className="flex items-center space-x-2.5 px-3 py-2 rounded-xl text-washi-200 hover:text-kin-300 hover:bg-sumi-900 transition-colors"
                          >
                            <KeyRound className="w-4 h-4 text-kin-400 shrink-0" />
                            <span>Đổi mật khẩu</span>
                          </Link>

                          {/* POS & KDS Management Entry (Staff/Manager/Admin only) */}
                          {isStaffRole(currentUser?.role) && (
                            <div className="pt-1 border-t border-sumi-800/80">
                              <Link
                                to="/pos"
                                onClick={() => setIsUserMenuOpen(false)}
                                className="flex items-center space-x-2.5 px-3 py-2 rounded-xl text-amber-300 hover:text-amber-200 hover:bg-sumi-900 font-bold transition-colors"
                              >
                                <Utensils className="w-4 h-4 text-amber-400 shrink-0" />
                                <span>Hệ Thống Quản Lý POS</span>
                              </Link>
                              <Link
                                to="/kds"
                                onClick={() => setIsUserMenuOpen(false)}
                                className="flex items-center space-x-2.5 px-3 py-2 rounded-xl text-orange-300 hover:text-orange-200 hover:bg-sumi-900 font-bold transition-colors"
                              >
                                <Flame className="w-4 h-4 text-orange-400 shrink-0" />
                                <span>Màn Hình Bếp (KDS)</span>
                              </Link>
                            </div>
                          )}
                        </div>

                        {/* Logout Button */}
                        <div className="pt-2 border-t border-sumi-800">
                          <button
                            type="button"
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              logout();
                            }}
                            className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-shu-400 hover:text-shu-300 hover:bg-shu-950/60 font-semibold transition-colors"
                          >
                            <LogOut className="w-4 h-4 shrink-0" />
                            <span>Đăng xuất</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Online Reservation CTA */}
              <button
                type="button"
                onClick={() => {
                  if (!isAuthenticated) {
                    openAuthModal('login', 'Quý khách vui lòng đăng nhập để đặt bàn giữ chỗ.');
                    return;
                  }
                  navigate('/reservation');
                }}
                className="hidden md:inline-flex items-center space-x-2 px-3.5 xl:px-5 py-2.5 rounded-full text-xs uppercase tracking-wider font-semibold text-white bg-gradient-to-r from-shu-700 via-shu-600 to-shu-700 hover:from-shu-600 hover:to-shu-500 border border-kin-500/40 shadow-lg shadow-shu-950/60 hover:shadow-gold-glow hover:-translate-y-0.5 transition-all duration-300 whitespace-nowrap"
              >
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>Đặt bàn ngay</span>
              </button>

              {/* Mobile Hamburger Toggle */}
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label={isMobileMenuOpen ? 'Đóng menu' : 'Mở menu điều hướng'}
                aria-expanded={isMobileMenuOpen}
                aria-controls="mobile-navigation-drawer"
                className="lg:hidden p-2 rounded-lg text-washi-200 hover:text-kin-400 bg-sumi-900 border border-kin-500/20 focus:outline-none"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Slide-over Mobile Navigation */}
      <MobileNav
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        navLinks={navLinks}
        cartCount={cartCount}
        onOpenCart={onOpenCart}
        onOpenAuth={onOpenAuth}
      />
    </>
  );
};
