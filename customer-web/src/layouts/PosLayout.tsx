import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Utensils,
  Coins,
  Users,
  BarChart3,
  LogOut,
  Clock,
  Flame,
  Globe,
  Layers,
  CalendarCheck,
  MapPin,
  Tag,
  MessageSquareText,
  UserCog,
  Menu,
  X,
  AlertTriangle,
  Wifi,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { normalizeUserRole } from '@/types';
import { shiftService, CashierShiftDto } from '@/services/shiftService';
import { reservationService } from '@/services/reservationService';
import { reviewService } from '@/services/reviewService';
import { PosBillCallAlertModal } from '@/components/pos/PosBillCallAlertModal';

export const PosLayout: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [now, setNow] = useState(new Date());
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [activeShift, setActiveShift] = useState<CashierShiftDto | null>(null);
  const [shiftChecked, setShiftChecked] = useState(false);
  const [pendingReservationsCount, setPendingReservationsCount] = useState<number>(0);
  const [unrepliedReviewsCount, setUnrepliedReviewsCount] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const refreshBadgeCounts = useCallback(async () => {
    try {
      const [rRes, revRes] = await Promise.all([
        reservationService.getManagedReservations({ page: 1, pageSize: 1 }).catch(() => null),
        reviewService.getManagedReviews({ page: 1, pageSize: 1 }).catch(() => null),
      ]);
      if (rRes?.counts) {
        setPendingReservationsCount(rRes.counts.pending || 0);
      }
      if (revRes?.counts) {
        setUnrepliedReviewsCount(revRes.counts.unreplied || 0);
      }
    } catch {
      // Ignored
    }
  }, []);

  useEffect(() => {
    void refreshBadgeCounts();
  }, [location.pathname, refreshBadgeCounts]);

  useEffect(() => {
    const handleResUpdated = (e: any) => {
      if (typeof e?.detail?.pendingCount === 'number') {
        setPendingReservationsCount(e.detail.pendingCount);
      } else {
        void refreshBadgeCounts();
      }
    };
    const handleRevUpdated = (e: any) => {
      if (typeof e?.detail?.unrepliedCount === 'number') {
        setUnrepliedReviewsCount(e.detail.unrepliedCount);
      } else {
        void refreshBadgeCounts();
      }
    };

    window.addEventListener('pos-reservations-updated', handleResUpdated);
    window.addEventListener('pos-reviews-updated', handleRevUpdated);
    return () => {
      window.removeEventListener('pos-reservations-updated', handleResUpdated);
      window.removeEventListener('pos-reviews-updated', handleRevUpdated);
    };
  }, [refreshBadgeCounts]);

  const refreshShiftStatus = useCallback(async () => {
    try {
      const res = await shiftService.getCurrentShift();
      setActiveShift(res.hasOpenShift ? res.shift : null);
    } catch {
      setActiveShift(null);
    } finally {
      setShiftChecked(true);
    }
  }, []);

  useEffect(() => {
    void refreshShiftStatus();
  }, [location.pathname, refreshShiftStatus]);

  useEffect(() => {
    const handleShiftUpdated = () => {
      void refreshShiftStatus();
    };
    window.addEventListener('pos-shift-updated', handleShiftUpdated);
    return () => window.removeEventListener('pos-shift-updated', handleShiftUpdated);
  }, [refreshShiftStatus]);

  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [location.pathname]);

  const formatVietnameseDateTime = (date: Date) => {
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayName = days[date.getDay()];
    const dateStr = date.toLocaleDateString('vi-VN');
    const timeStr = date.toLocaleTimeString('vi-VN');
    return `${dayName}, ${dateStr} • ${timeStr}`;
  };

  const role = normalizeUserRole(currentUser?.role);
  const isAdmin = role === 'ADMIN';
  const isManagerOrAdmin = role === 'ADMIN' || role === 'MANAGER';

  const roleDisplayName =
    role === 'ADMIN'
      ? 'Quản Trị Viên (ADMIN)'
      : role === 'MANAGER'
      ? 'Quản Lý (MANAGER)'
      : role === 'KITCHEN'
      ? 'Bếp Trưởng (KDS)'
      : 'Nhân Viên Thu Ngân (STAFF)';

  const getHeaderTitle = () => {
    const path = location.pathname;
    if (path.includes('/kds')) return 'DANH SÁCH ORDER & BẾP (KDS)';
    if (path.includes('/shifts')) return 'QUẢN LÝ CA TRỰC & TIỀN KÉT';
    if (path.includes('/menu')) return 'THỰC ĐƠN & KHO HÀNG';
    if (path.includes('/customers')) return 'KHÁCH HÀNG & HỘI VIÊN';
    if (path.includes('/reservations')) return 'QUẢN LÝ ĐẶT BÀN ONLINE';
    if (path.includes('/areas-tables')) return 'QUẢN LÝ BÀN & KHU VỰC';
    if (path.includes('/vouchers')) return 'QUẢN LÝ VOUCHER & KHUYẾN MÃI';
    if (path.includes('/reports')) return 'BÁO CÁO DOANH THU & THỐNG KÊ';
    if (path.includes('/reviews')) return 'ĐÁNH GIÁ MÓN ĂN & PHẢN HỒI';
    if (path.includes('/wifi')) return 'THIẾT LẬP MẠNG WIFI & SSID QUÁN';
    if (path.includes('/users')) return 'QUẢN LÝ NHÂN SỰ & PHÂN QUYỀN';
    return 'SƠ ĐỒ BÀN ĂN & PHỤC VỤ TẠI CHỖ';
  };

  const navLinkClass = (isActive: boolean) =>
    `flex items-center gap-2.5 px-3 min-h-[42px] rounded-lg text-[13px] font-semibold transition-colors whitespace-nowrap ${
      isActive
        ? 'bg-emerald-600 text-white shadow-sm font-bold'
        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
    }`;

  const handleLogout = () => {
    logout();
    navigate('/pos/login', { replace: true });
  };

  const sidebarContent = (
    <div className="w-64 bg-white border-r border-slate-200 flex flex-col h-full shrink-0">
      {/* 1. Brand Header */}
      <div className="px-4 py-4 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Utensils className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-extrabold text-[13px] uppercase tracking-wide text-slate-950 truncate">
              SAKURA RESTAURANT
            </h2>
            <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-tight truncate">
              QUẢN LÝ VẬN HÀNH POS
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-label="Đóng thanh điều hướng"
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Scrollable 3-Group Navigation */}
      <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
        {/* GROUP 1: BÁN HÀNG & VẬN HÀNH */}
        <div className="space-y-1">
          <p className="px-2 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            BÁN HÀNG & VẬN HÀNH
          </p>

          <NavLink
            to="/pos/tables"
            className={({ isActive }) =>
              navLinkClass(isActive || location.pathname === '/pos')
            }
          >
            <Layers className="w-4 h-4 shrink-0" />
            <span className="truncate">Sơ Đồ Bàn Ăn</span>
          </NavLink>

          <NavLink
            to="/pos/kds"
            className={({ isActive }) => navLinkClass(isActive)}
          >
            <Flame className="w-4 h-4 shrink-0" />
            <span className="truncate">Danh Sách Order (KDS)</span>
          </NavLink>

          <NavLink
            to="/pos/shifts"
            className={({ isActive }) => navLinkClass(isActive)}
          >
            <Coins className="w-4 h-4 shrink-0" />
            <span className="truncate">Ca Trực & Tiền Két</span>
          </NavLink>
        </div>

        {/* GROUP 2: DỊCH VỤ & HỘI VIÊN */}
        <div className="space-y-1">
          <p className="px-2 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            DỊCH VỤ & HỘI VIÊN
          </p>

          <NavLink
            to="/pos/menu"
            className={({ isActive }) => navLinkClass(isActive)}
          >
            <Utensils className="w-4 h-4 shrink-0" />
            <span className="truncate">Thực Đơn & Kho Hàng</span>
          </NavLink>

          <NavLink
            to="/pos/customers"
            className={({ isActive }) => navLinkClass(isActive)}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span className="truncate">Khách Hàng & Hội Viên</span>
          </NavLink>

          <NavLink
            to="/pos/reservations"
            className={({ isActive }) => navLinkClass(isActive)}
          >
            <CalendarCheck className="w-4 h-4 shrink-0" />
            <span className="truncate">Đặt Bàn Online</span>
            {pendingReservationsCount > 0 && (
              <span className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-amber-500 text-white shadow-xs">
                {pendingReservationsCount}
              </span>
            )}
          </NavLink>
        </div>

        {/* GROUP 3: QUẢN TRỊ & HỆ THỐNG (ADMIN / MANAGER ONLY) */}
        {isManagerOrAdmin && (
          <div className="space-y-1">
            <p className="px-2 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              QUẢN TRỊ & HỆ THỐNG
            </p>

            <NavLink
              to="/pos/areas-tables"
              className={({ isActive }) => navLinkClass(isActive)}
            >
              <MapPin className="w-4 h-4 shrink-0" />
              <span className="truncate">Quản Lý Bàn & Khu Vực</span>
            </NavLink>

            <NavLink
              to="/pos/vouchers"
              className={({ isActive }) => navLinkClass(isActive)}
            >
              <Tag className="w-4 h-4 shrink-0" />
              <span className="truncate">Quản Lý Voucher</span>
            </NavLink>

            <NavLink
              to="/pos/reports"
              className={({ isActive }) => navLinkClass(isActive)}
            >
              <BarChart3 className="w-4 h-4 shrink-0" />
              <span className="truncate">Báo Cáo & Thống Kê</span>
            </NavLink>

            <NavLink
              to="/pos/reviews"
              className={({ isActive }) => navLinkClass(isActive)}
            >
              <MessageSquareText className="w-4 h-4 shrink-0" />
              <span className="truncate">Đánh Giá Món Ăn</span>
              {unrepliedReviewsCount > 0 && (
                <span className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-amber-500 text-white shadow-xs">
                  {unrepliedReviewsCount}
                </span>
              )}
            </NavLink>

            <NavLink
              to="/pos/wifi"
              className={({ isActive }) => navLinkClass(isActive)}
            >
              <Wifi className="w-4 h-4 shrink-0" />
              <span className="truncate">Thiết Lập WiFi & SSID</span>
            </NavLink>

            {isAdmin && (
              <NavLink
                to="/pos/users"
                className={({ isActive }) => navLinkClass(isActive)}
              >
                <UserCog className="w-4 h-4 shrink-0" />
                <span className="truncate">Quản Lý Nhân Sự</span>
              </NavLink>
            )}
          </div>
        )}
      </nav>

      {/* 3. Bottom Real User Card & Logout */}
      <div className="p-3 border-t border-slate-200 bg-white shrink-0 space-y-2">
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
            {currentUser?.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'S'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-xs text-slate-950 truncate">
              {currentUser?.fullName || 'Nhân viên'}
            </p>
            <p className="text-[11px] text-emerald-700 font-semibold truncate">
              {roleDisplayName}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full py-2 px-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Đăng Xuất Khỏi Hệ Thống</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/')}
          className="w-full py-1 text-center text-[11px] font-medium text-slate-500 hover:text-slate-900 transition-colors flex items-center justify-center gap-1"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Về Trang Đặt Món Khách Hàng</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 font-sans">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:block h-full shrink-0">{sidebarContent}</aside>

      {/* Mobile / Tablet Slide-over Sidebar Drawer */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <aside className="relative z-10 h-full shadow-2xl">{sidebarContent}</aside>
        </div>
      )}

      {/* Right Main Viewport */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* 58px Top Header Bar */}
        <header className="h-[58px] bg-white border-b border-slate-200 px-4 lg:px-5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="Mở menu điều hướng POS"
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 shrink-0"
            >
              <Menu className="w-4 h-4" />
            </button>
            <h1 className="font-extrabold text-[15px] text-slate-950 uppercase tracking-wide truncate">
              {getHeaderTitle()}
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Live Vietnamese Clock */}
            <div className="hidden md:flex items-center gap-1.5 font-mono text-[13px] font-semibold text-slate-700 whitespace-nowrap">
              <Clock className="w-4 h-4 text-slate-500" />
              <span>{formatVietnameseDateTime(now)}</span>
            </div>

            {/* Real Active Shift Status Badge */}
            {activeShift ? (
              <button
                type="button"
                onClick={() => navigate('/pos/shifts')}
                className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs flex items-center gap-1.5 whitespace-nowrap hover:bg-emerald-100 transition-colors"
                title={`Ca ${activeShift.shiftCode} • Thu ngân: ${activeShift.openedByName}`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>
                  Ca đang mở{activeShift.openedByName ? ` • ${activeShift.openedByName}` : ''}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/pos/shifts')}
                className="px-3 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-800 font-bold text-xs flex items-center gap-1.5 whitespace-nowrap hover:bg-amber-100 transition-colors"
                title="Nhấn để mở ca trực trước khi mở bàn"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>{shiftChecked ? 'Chưa mở ca trực' : 'Đang kiểm tra ca...'}</span>
              </button>
            )}
          </div>
        </header>

        {/* Main Content Viewport */}
        <main className="flex-1 overflow-y-auto bg-slate-50">
          <Outlet />
        </main>
      </div>

      {/* Global Bill Call Alert Popup for Cashier */}
      <PosBillCallAlertModal
        onOpenCheckoutForTable={(tableId) => {
          navigate(`/pos/tables?openCheckout=${tableId}`);
        }}
      />
    </div>
  );
};
