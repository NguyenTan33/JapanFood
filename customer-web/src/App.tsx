import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { RootLayout } from '@/components/layout/RootLayout';
import { CartProvider } from '@/context/CartContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { isStaffRole } from '@/types';

// Customer Pages
import { HomePage } from '@/pages/HomePage';
import { MenuPage } from '@/pages/MenuPage';
import { ReservationPage } from '@/pages/ReservationPage';
import { CartPage } from '@/pages/CartPage';
import { CheckoutPage } from '@/pages/CheckoutPage';
import { LocationPage } from '@/pages/LocationPage';
import { AboutPage } from '@/pages/AboutPage';
import { BlogPage } from '@/pages/BlogPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { TableOrderPage } from '@/pages/customer/TableOrderPage';

// POS & KDS Management System
import { PosLayout } from '@/layouts/PosLayout';
import { PosLoginPage } from '@/pages/pos/PosLoginPage';
import { PosTableMapView } from '@/pages/pos/PosTableMapView';
import { KdsScreen } from '@/pages/pos/KdsScreen';
import { PosShiftView } from '@/pages/pos/PosShiftView';
import { PosCustomerView } from '@/pages/pos/PosCustomerView';
import { PosMenuView } from '@/pages/pos/PosMenuView';
import { PosReportsView } from '@/pages/pos/PosReportsView';
import { PosOnlineReservationsView } from '@/pages/pos/PosOnlineReservationsView';
import { PosTableMgmtView } from '@/pages/pos/PosTableMgmtView';
import { PosReviewsView } from '@/pages/pos/PosReviewsView';
import { PosAdminUsersView } from '@/pages/pos/PosAdminUsersView';
import { PosWifiConfigView } from '@/pages/pos/PosWifiConfigView';
import { PosVoucherView } from '@/pages/pos/PosVoucherView';

import { Sparkles, Wrench } from 'lucide-react';

function NotFoundPage() {
  const { currentUser } = useAuth();
  const canAccessPos = isStaffRole(currentUser?.role);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[50vh]">
      <div className="w-16 h-16 rounded-full border border-kin-500/40 flex items-center justify-center bg-sumi-900 mb-4 shadow-gold-glow">
        <Sparkles className="w-7 h-7 text-kin-400" />
      </div>
      <h1 className="font-serif text-3xl sm:text-4xl font-bold text-washi-100 mb-3">404 - Không Tìm Thấy Trang</h1>
      <p className="text-sm text-washi-300 max-w-md mb-6">Trang bạn tìm kiếm không tồn tại hoặc đã được di chuyển.</p>
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="px-6 py-2.5 rounded-full text-xs font-semibold text-white bg-shu-700 hover:bg-shu-600 border border-kin-500/30 transition-all"
        >
          Về Trang Chủ
        </Link>
        {canAccessPos && (
          <Link
            to="/pos"
            className="px-6 py-2.5 rounded-full text-xs font-semibold text-kin-300 bg-sumi-900 hover:bg-sumi-800 border border-kin-500/30 transition-all"
          >
            Vào Hệ Thống POS
          </Link>
        )}
      </div>
    </div>
  );
}

function PosModulePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm space-y-3">
        <div className="w-12 h-12 mx-auto rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
          <Wrench className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-extrabold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-600 max-w-lg mx-auto">{description}</p>
        <div className="pt-2">
          <Link
            to="/pos/tables"
            className="inline-flex items-center px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
          >
            Quay Lại Sơ Đồ Bàn
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            {/* Customer Website Routes */}
            <Route path="/" element={<RootLayout />}>
              <Route index element={<HomePage />} />
              <Route path="menu" element={<MenuPage />} />
              <Route path="reservation" element={<ReservationPage />} />
              <Route path="cart" element={<CartPage />} />
              <Route path="checkout" element={<CheckoutPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="location" element={<LocationPage />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="blog" element={<BlogPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>

            {/* POS / KDS Dedicated Staff Login */}
            <Route path="/pos/login" element={<PosLoginPage />} />

            {/* Standalone Full-Screen Kitchen Display System (ADMIN / MANAGER / STAFF / KITCHEN) */}
            <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'STAFF', 'KITCHEN']} loginPath="/pos/login" />}>
              <Route path="/kds" element={<KdsScreen />} />
            </Route>

            {/* POS Management System Routes (Protected: ADMIN / MANAGER / STAFF) */}
            <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'STAFF']} loginPath="/pos/login" />}>
              <Route path="/pos" element={<PosLayout />}>
                <Route index element={<PosTableMapView />} />
                <Route path="tables" element={<PosTableMapView />} />
                <Route path="kds" element={<KdsScreen />} />
                <Route path="shifts" element={<PosShiftView />} />
                <Route path="customers" element={<PosCustomerView />} />
                <Route path="menu" element={<PosMenuView />} />
                <Route path="reservations" element={<PosOnlineReservationsView />} />

                {/* Manager & Admin Only Routes */}
                <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']} loginPath="/pos/login" />}>
                  <Route path="reports" element={<PosReportsView />} />
                  <Route path="areas-tables" element={<PosTableMgmtView />} />
                  <Route path="vouchers" element={<PosVoucherView />} />
                  <Route path="reviews" element={<PosReviewsView />} />
                  <Route path="wifi" element={<PosWifiConfigView />} />
                </Route>

                {/* Admin ONLY Route: Quản lý nhân sự & Phân quyền */}
                <Route element={<ProtectedRoute allowedRoles={['ADMIN']} loginPath="/pos/login" />}>
                  <Route path="users" element={<PosAdminUsersView />} />
                </Route>
              </Route>
            </Route>

            {/* Customer Dine-In QR Table Ordering with WiFi Guard */}
            <Route path="/table-order" element={<TableOrderPage />} />
            <Route path="/table/:id" element={<TableOrderPage />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
