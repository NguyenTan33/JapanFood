import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Trash2, 
  Plus, 
  Minus, 
  ArrowRight, 
  ShoppingBag, 
  ShieldAlert, 
  Tag, 
  Check, 
  ArrowLeft,
  Sparkles,
  MessageSquareText
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { voucherService } from '@/services/voucherService';

export const CartPage: React.FC = () => {
  const navigate = useNavigate();
  const { items, updateQuantity, removeFromCart, clearCart, subtotal, totalCount } = useCart();
  const { isAuthenticated, openAuthModal } = useAuth();

  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<{ code: string; discount: number } | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);

  const handleApplyVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    setVoucherError(null);
    const code = voucherCode.trim().toUpperCase();
    if (!code) return;

    if (!isAuthenticated) {
      openAuthModal('login', 'Quý khách vui lòng đăng nhập để áp dụng mã giảm giá.');
      return;
    }

    try {
      const res = await voucherService.applyVoucher(code, subtotal);
      setAppliedVoucher({ code: res.voucherCode || res.code || code, discount: res.discountAmount });
    } catch (err: any) {
      setVoucherError(err?.response?.data?.message || err?.message || 'Mã ưu đãi không hợp lệ hoặc đã hết hạn.');
    }
  };

  const discountAmount = appliedVoucher ? appliedVoucher.discount : 0;
  const finalTotal = Math.max(0, subtotal - discountAmount);
  const deposit50 = Math.round(finalTotal * 0.5);

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[60vh]">
        <div className="w-20 h-20 rounded-full bg-sumi-900 border border-kin-500/30 flex items-center justify-center text-washi-500 mb-5 shadow-gold-glow">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-washi-100">
          Giỏ Hàng Của Bạn Đang Trống
        </h1>
        <p className="text-xs sm:text-sm text-washi-300 max-w-md mt-2 mb-6">
          Thực đơn Omakase, Sashimi cá ngừ đại dương và Bò Wagyu A5 đang chờ đón quý khách!
        </p>
        <Link
          to="/menu"
          className="px-6 py-3 rounded-full text-xs font-semibold text-white bg-shu-700 hover:bg-shu-600 border border-kin-500/40 shadow-lg flex items-center space-x-2 transition-all"
        >
          <span>Khám Phá Menu Lật Sách 3D</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col py-8 sm:py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-kin-500/20 gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-kin-400">Đơn Hàng Trực Tuyến</span>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-washi-100 mt-1">Giỏ Hàng ({totalCount} Món)</h1>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            to="/menu"
            className="text-xs text-kin-400 hover:text-kin-300 flex items-center space-x-1 whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
            <span>Tiếp tục chọn món</span>
          </Link>
          <button
            type="button"
            onClick={clearCart}
            className="text-xs text-washi-500 hover:text-shu-400 transition-colors whitespace-nowrap"
          >
            Xóa hết giỏ hàng
          </button>
        </div>
      </div>

      {/* Strict Anti-Bom Deposit Warning Banner */}
      <div className="my-6 p-4 rounded-2xl bg-shu-950/70 border border-kin-500/40 flex items-start gap-3 sm:gap-3.5 shadow-lg">
        <ShieldAlert className="w-5 h-5 text-kin-400 shrink-0 mt-0.5" />
        <div className="text-xs text-washi-200 space-y-1 min-w-0 flex-1">
          <p className="font-semibold text-kin-300">
            QUY ĐỊNH THANH TOÁN VÀ ĐẶT CỌC (Tránh Huỷ/Bom Đơn):
          </p>
          <p className="leading-relaxed text-washi-300">
            Do nguyên liệu ẩm thực Nhật (Sashimi cá tươi, Bò Wagyu A5) được chế biến tươi sống ngay khi chốt đơn, nhà hàng chỉ áp dụng 2 hình thức: 
            <strong className="text-white"> 1. Chuyển khoản 100%</strong> hoặc 
            <strong className="text-white"> 2. Giao hàng COD với điều kiện chuyển khoản đặt cọc trước 50%</strong> ({deposit50.toLocaleString('vi-VN')}₫). 50% còn lại thanh toán tiền mặt cho shipper.
          </p>
        </div>
      </div>

      {/* Main Grid: Items List + Checkout Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left: Items List */}
        <div className="lg:col-span-2 space-y-4 min-w-0">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-sumi-900/90 via-sumi-900/70 to-sumi-950/90 border border-kin-500/20 hover:border-kin-500/40 shadow-lg shadow-black/30 transition-all flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between group"
            >
              <div className="flex items-start sm:items-center gap-3.5 sm:gap-4 w-full min-w-0 flex-1">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-kin-500/30 bg-sumi-950 shrink-0 shadow-md">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  {item.japaneseName && (
                    <p className="text-[11px] font-kanji text-kin-400 font-bold truncate">{item.japaneseName}</p>
                  )}
                  <h3 className="font-serif text-base font-bold text-washi-100 line-clamp-2 sm:truncate leading-snug">{item.name}</h3>
                  <p className="text-xs text-washi-400 font-mono">
                    Đơn giá: {item.totalUnitPrice.toLocaleString('vi-VN')}₫
                  </p>

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

                  {item.specialInstructions && (
                    <div className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-sumi-950/70 border border-kin-500/15 text-[11px] text-washi-300 mt-1">
                      <MessageSquareText className="w-3.5 h-3.5 text-kin-400/80 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">
                        <strong className="text-kin-400 font-medium not-italic">Ghi chú bếp:</strong>{' '}
                        <span className="italic text-washi-300">{item.specialInstructions}</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quantity & Actions */}
              <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto shrink-0 gap-3 sm:gap-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-sumi-800">
                <div className="flex items-center space-x-2 bg-sumi-950 rounded-xl border border-sumi-700 px-3 py-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    aria-label="Giảm số lượng"
                    className="text-washi-400 hover:text-washi-100 p-0.5"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-bold text-washi-100 px-2 min-w-[1.5rem] text-center">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    aria-label="Tăng số lượng"
                    className="text-washi-400 hover:text-washi-100 p-0.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <div className="text-right min-w-[5.25rem] sm:min-w-[6rem]">
                    <span className="text-sm font-bold text-kin-400 whitespace-nowrap">
                      {(item.totalUnitPrice * item.quantity).toLocaleString('vi-VN')}₫
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeFromCart(item.id)}
                    aria-label={`Xóa ${item.name}`}
                    className="text-washi-500 hover:text-shu-400 p-2 transition-colors shrink-0"
                    title="Xóa món"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right: Order Summary & Voucher */}
        <div className="bg-sumi-900/90 border border-kin-500/30 rounded-2xl p-4 sm:p-6 shadow-xl space-y-6 min-w-0">
          <h2 className="font-serif text-lg font-bold text-washi-100 pb-3 border-b border-sumi-800">
            Tóm Tắt Đơn Hàng
          </h2>

          {/* Voucher input */}
          <form onSubmit={handleApplyVoucher} className="space-y-2">
            <label className="block text-xs font-semibold text-kin-400">Mã Khuyến Mại (Voucher)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value)}
                placeholder="Nhập: SAKURAVIP20 hoặc FREESHIP"
                className="flex-1 min-w-0 bg-sumi-950 border border-sumi-700 rounded-xl px-3 py-2 text-base sm:text-xs text-washi-100 uppercase placeholder:normal-case placeholder:text-washi-500 focus:outline-none focus:border-kin-400"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-sumi-800 hover:bg-sumi-700 border border-kin-500/30 transition-colors shrink-0 whitespace-nowrap"
              >
                Áp Dụng
              </button>
            </div>
            {voucherError && <p className="text-[11px] text-shu-400">{voucherError}</p>}
            {appliedVoucher && (
              <p className="text-[11px] text-emerald-400 flex items-start gap-1.5">
                <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Đã áp dụng mã {appliedVoucher.code}: -{appliedVoucher.discount.toLocaleString('vi-VN')}₫</span>
              </p>
            )}
          </form>

          {/* Pricing breakdown */}
          <div className="space-y-2.5 text-xs border-t border-sumi-800 pt-4">
            <div className="flex justify-between gap-2 text-washi-300">
              <span>Tổng tiền món:</span>
              <span className="font-semibold shrink-0 whitespace-nowrap">{subtotal.toLocaleString('vi-VN')}₫</span>
            </div>

            {appliedVoucher && (
              <div className="flex justify-between gap-2 text-emerald-400">
                <span>Ưu đãi voucher:</span>
                <span className="shrink-0 whitespace-nowrap">-{discountAmount.toLocaleString('vi-VN')}₫</span>
              </div>
            )}

            <div className="flex justify-between gap-2 text-washi-300">
              <span>Phí giao hàng:</span>
              <span className="text-emerald-400 font-medium text-right">Miễn phí (Toyosu Express)</span>
            </div>

            <div className="flex justify-between gap-2 text-sm font-bold text-washi-100 pt-3 border-t border-sumi-800">
              <span>Tổng giá trị đơn:</span>
              <span className="text-base text-kin-400 shrink-0 whitespace-nowrap">{finalTotal.toLocaleString('vi-VN')}₫</span>
            </div>

            <div className="p-3 rounded-xl bg-sumi-950 border border-kin-500/30 text-[11px] space-y-1">
              <div className="flex justify-between gap-2 text-kin-300 font-semibold">
                <span>Số tiền cọc trước (50%):</span>
                <span className="shrink-0 whitespace-nowrap">{deposit50.toLocaleString('vi-VN')}₫</span>
              </div>
              <p className="text-[10px] text-washi-400">
                Áp dụng khi chọn Ship COD. Chuyển khoản 100% không cần cọc lại.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!isAuthenticated) {
                openAuthModal('login', 'Quý khách vui lòng đăng nhập để tiến hành đặt hàng.');
                return;
              }
              navigate('/checkout');
            }}
            className="w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-shu-700 via-shu-600 to-shu-700 hover:from-shu-600 hover:to-shu-500 border border-kin-500/40 shadow-xl shadow-shu-950/80 flex items-center justify-center space-x-2 transition-all"
          >
            <span>{!isAuthenticated ? 'Đăng Nhập Để Đặt Hàng' : 'Tiến Hành Đặt Hàng & Thanh Toán'}</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
};
