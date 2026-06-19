import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Trash2, Plus, Minus, ArrowRight, ShieldCheck, ShoppingBag, LogIn, MessageSquareText } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';

export const CartDrawer: React.FC = () => {
  const { items, isCartOpen, setIsCartOpen, updateQuantity, removeFromCart, clearCart, subtotal, totalCount } = useCart();
  const { isAuthenticated, openAuthModal } = useAuth();

  useEffect(() => {
    if (!isCartOpen) return;
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCartOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCartOpen, setIsCartOpen]);

  if (!isCartOpen) return null;

  const deposit50 = Math.round(subtotal * 0.5);

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Giỏ Hàng Của Bạn"
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={() => setIsCartOpen(false)}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 w-full max-w-[32rem] flex justify-end pl-3 sm:pl-8 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-lg h-full bg-sumi-950 border-l border-kin-500/30 shadow-2xl flex flex-col text-washi-100 overflow-hidden overscroll-contain">
          
          {/* Header */}
          <div className="p-4 sm:p-5 pt-[max(1.25rem,env(safe-area-inset-top))] border-b border-kin-500/20 flex items-center justify-between gap-3 bg-sumi-950/95 backdrop-blur-xl shrink-0">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-shu-800 to-sumi-900 border border-kin-500/40 flex items-center justify-center text-kin-400 shadow-sm">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-serif text-base sm:text-lg font-bold text-washi-100 truncate">Giỏ Hàng Của Bạn</h2>
                  {totalCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-shu-900/80 text-kin-300 border border-shu-600/40 font-mono">
                      {totalCount} món
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-kin-500/90 font-medium">桜 Sakura Dining Cart</p>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 shrink-0">
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Quý khách có chắc muốn làm trống toàn bộ giỏ hàng?')) {
                      clearCart();
                    }
                  }}
                  aria-label="Xóa hết giỏ hàng"
                  className="p-2 rounded-lg text-washi-400 hover:text-shu-400 hover:bg-sumi-900/80 transition-colors"
                  title="Làm trống giỏ hàng"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                aria-label="Đóng giỏ hàng"
                className="p-2 rounded-lg bg-sumi-900/80 hover:bg-sumi-800 text-washi-300 hover:text-white border border-kin-500/20 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>



          {/* Cart Item List */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3.5 sm:p-4 space-y-3 overscroll-contain">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 px-4">
                <div className="w-16 h-16 rounded-2xl bg-sumi-900 border border-kin-500/30 flex items-center justify-center text-washi-500 mb-4 shadow-lg shadow-black/40">
                  <ShoppingBag className="w-8 h-8 text-kin-400/60" />
                </div>
                <h3 className="font-serif text-lg font-bold text-washi-100">Giỏ hàng đang trống</h3>
                <p className="text-xs text-washi-400 mt-1 max-w-xs leading-relaxed">
                  Hãy khám phá thực đơn ẩm thực Nhật Bản trứ danh và chọn món yêu thích nhé!
                </p>
                <Link
                  to="/menu"
                  onClick={() => setIsCartOpen(false)}
                  className="mt-6 px-6 py-2.5 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-shu-700 via-shu-600 to-shu-700 hover:brightness-110 border border-kin-500/40 shadow-lg shadow-shu-950/80 transition-all"
                >
                  Khám Phá Thực Đơn 3D
                </Link>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="relative p-3.5 sm:p-4 rounded-2xl bg-gradient-to-b from-sumi-900/90 via-sumi-900/60 to-sumi-950/90 border border-kin-500/25 hover:border-kin-400/40 shadow-md shadow-black/40 transition-all space-y-3 group"
                >
                  {/* Top: Image & Header Details */}
                  <div className="flex items-start gap-3">
                    {/* Dish Image */}
                    <div className="w-[72px] h-[72px] min-w-[72px] rounded-xl overflow-hidden border border-kin-500/30 bg-sumi-950 shadow-md shrink-0 relative">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>

                    {/* Dish Info */}
                    <div className="flex-1 min-w-0 pr-6">
                      {item.japaneseName && (
                        <p className="text-[10px] font-kanji text-kin-400/90 font-medium tracking-wide truncate">
                          {item.japaneseName}
                        </p>
                      )}
                      <h4 className="font-serif text-[14px] sm:text-[15px] font-bold text-washi-100 leading-snug line-clamp-2">
                        {item.name}
                      </h4>
                      <p className="text-[11px] text-washi-400 font-mono mt-0.5">
                        Đơn giá: {item.totalUnitPrice.toLocaleString('vi-VN')}₫
                      </p>
                    </div>

                    {/* Delete Item Button */}
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.id)}
                      aria-label={`Xóa ${item.name}`}
                      className="absolute top-3.5 right-3.5 p-1.5 rounded-lg text-washi-500 hover:text-shu-400 hover:bg-shu-950/60 border border-transparent hover:border-shu-500/30 transition-all shrink-0"
                      title="Xóa món khỏi giỏ"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Selected Options / Customizations (Refined Luxury Tags) */}
                  {item.selectedOptions && item.selectedOptions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {item.selectedOptions.map((opt) => (
                        <span
                          key={opt.optionId}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] bg-sumi-950/90 border border-sumi-700/60 text-washi-300 font-sans tracking-tight"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-kin-400/80 shrink-0" />
                          <span className="truncate max-w-[200px]">{opt.optionName}</span>
                          {opt.priceAdjustment > 0 ? (
                            <span className="font-mono text-[10px] text-kin-400 font-semibold shrink-0">
                              +{opt.priceAdjustment.toLocaleString('vi-VN')}₫
                            </span>
                          ) : (
                            <span className="text-[9px] text-washi-400 font-medium shrink-0">
                              (Chuẩn vị)
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Special Chef Instructions */}
                  {item.specialInstructions && (
                    <div className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-sumi-950/70 border border-kin-500/15 text-[11px] text-washi-300">
                      <MessageSquareText className="w-3.5 h-3.5 text-kin-400/80 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">
                        <strong className="text-kin-400 font-medium not-italic">Ghi chú bếp:</strong>{' '}
                        <span className="italic text-washi-300">{item.specialInstructions}</span>
                      </span>
                    </div>
                  )}

                  {/* Bottom: Price and Quantity Stepper */}
                  <div className="pt-2.5 border-t border-sumi-800/80 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase tracking-wider text-washi-400 block font-medium">Thành tiền</span>
                      <span className="font-serif text-sm sm:text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-kin-300 via-kin-400 to-kin-200">
                        {(item.totalUnitPrice * item.quantity).toLocaleString('vi-VN')}₫
                      </span>
                    </div>

                    {/* Luxury Stepper */}
                    <div className="flex items-center rounded-xl bg-sumi-950 border border-kin-500/30 p-0.5 shadow-inner shrink-0">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        aria-label="Giảm số lượng"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-washi-400 hover:text-white hover:bg-sumi-800 active:scale-95 transition-all"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center text-xs font-bold text-washi-100 font-mono select-none">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        aria-label="Tăng số lượng"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-kin-300 hover:text-sumi-950 hover:bg-kin-400 active:scale-95 transition-all"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer & Actions */}
          {items.length > 0 && (
            <div className="p-4 sm:p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] border-t border-kin-500/20 bg-sumi-950/95 backdrop-blur-xl space-y-3.5 shrink-0 shadow-2xl">
              {/* Bill Breakdown Card */}
              <div className="p-3.5 rounded-2xl bg-sumi-900/60 border border-kin-500/20 space-y-2 text-xs">
                <div className="flex justify-between items-center text-washi-300">
                  <span>Tổng giá trị món ({totalCount} món):</span>
                  <span className="font-mono font-semibold text-washi-100">{subtotal.toLocaleString('vi-VN')}₫</span>
                </div>
                <div className="flex justify-between items-center text-kin-400">
                  <span className="flex items-center gap-1 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-kin-400 shrink-0" />
                    Tiền cọc cần chuyển (50%):
                  </span>
                  <span className="font-mono font-bold text-kin-300">{deposit50.toLocaleString('vi-VN')}₫</span>
                </div>
                <div className="flex justify-between items-center text-washi-400 text-[11px]">
                  <span>Còn lại khi nhận hàng (COD):</span>
                  <span className="font-mono">{(subtotal - deposit50).toLocaleString('vi-VN')}₫</span>
                </div>
                <div className="pt-2 border-t border-sumi-800 flex justify-between items-baseline">
                  <span className="font-bold text-washi-100 text-sm">Tổng thanh toán:</span>
                  <span className="font-serif text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-kin-300 via-kin-400 to-kin-200">
                    {subtotal.toLocaleString('vi-VN')}₫
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2.5">
                <Link
                  to="/cart"
                  onClick={() => setIsCartOpen(false)}
                  className="px-3.5 py-3 rounded-xl text-center text-xs font-semibold text-kin-300 bg-sumi-900 hover:bg-sumi-800 border border-kin-500/30 hover:border-kin-400/60 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span>Xem Giỏ Chi Tiết</span>
                </Link>

                {!isAuthenticated ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCartOpen(false);
                      openAuthModal('login', 'Quý khách vui lòng đăng nhập để tiến hành đặt hàng.');
                    }}
                    className="px-3.5 py-3 rounded-xl text-center text-xs font-semibold text-white bg-gradient-to-r from-shu-700 via-shu-600 to-shu-700 hover:from-shu-600 hover:to-shu-500 border border-kin-500/40 shadow-lg shadow-shu-950/60 flex items-center justify-center space-x-1.5 hover:brightness-110 active:scale-[0.99] transition-all"
                  >
                    <LogIn className="w-3.5 h-3.5 shrink-0" />
                    <span>Đăng Nhập Đặt Món</span>
                  </button>
                ) : (
                  <Link
                    to="/checkout"
                    onClick={() => setIsCartOpen(false)}
                    className="px-3.5 py-3 rounded-xl text-center text-xs font-semibold text-white bg-gradient-to-r from-shu-700 via-shu-600 to-shu-700 hover:from-shu-600 hover:to-shu-500 border border-kin-500/40 shadow-lg shadow-shu-950/60 flex items-center justify-center space-x-1.5 hover:brightness-110 active:scale-[0.99] transition-all"
                  >
                    <span>Đặt Hàng Ngay</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
