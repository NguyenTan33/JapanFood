import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { CartDrawer } from '@/components/modals/CartDrawer';
import { AuthModal } from '@/components/modals/AuthModal';
import { OrderReviewModal } from '@/components/modals/OrderReviewModal';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';

interface RootLayoutProps {
  children?: React.ReactNode;
}

export const RootLayout: React.FC<RootLayoutProps> = ({ children }) => {
  const { totalCount, setIsCartOpen } = useCart();
  const { openAuthModal } = useAuth();
  const location = useLocation();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  return (
    <div className="min-h-screen min-h-dvh flex flex-col bg-sumi-950 text-washi-100 selection:bg-shu-700 selection:text-white">
      {/* Sticky Glassmorphic Navbar */}
      <Navbar 
        cartCount={totalCount} 
        onOpenCart={() => setIsCartOpen(true)}
        onOpenAuth={() => openAuthModal('login')}
      />

      {/* Main Page Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {children || <Outlet />}
      </main>

      {/* Universal Japanese Aesthetic Footer */}
      <Footer />

      {/* Modals & Slide-overs */}
      <CartDrawer />
      <AuthModal />
      <OrderReviewModal />
    </div>
  );
};
