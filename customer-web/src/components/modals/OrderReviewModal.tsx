import React, { useState, useEffect } from 'react';
import { Star, X, CheckCircle2, Clock, AlertCircle, MessageSquare } from 'lucide-react';
import confetti from 'canvas-confetti';
import { reviewService, PendingReviewOrder, PendingReviewItem } from '@/services/reviewService';
import { useAuth } from '@/context/AuthContext';

interface OrderReviewModalProps {
  order?: PendingReviewOrder | null;
  isOpen?: boolean;
  onClose?: () => void;
  onSuccess?: (orderId?: number) => void;
}

const RATING_LABELS: Record<number, string> = {
  1: 'Chưa hài lòng',
  2: 'Tạm được',
  3: 'Khá ngon',
  4: 'Ngon miệng',
  5: 'Xuất sắc chuẩn vị Nhật'
};

export const OrderReviewModal: React.FC<OrderReviewModalProps> = ({
  order: propOrder,
  isOpen: propIsOpen,
  onClose: propOnClose,
  onSuccess: propOnSuccess,
}) => {
  const { isAuthenticated, currentUser } = useAuth();
  const [internalOrder, setInternalOrder] = useState<PendingReviewOrder | null>(null);
  const [isInternalOpen, setIsInternalOpen] = useState(false);
  const [ratings, setRatings] = useState<Record<number, number>>({});
  const [hoveredRating, setHoveredRating] = useState<Record<number, number>>({});
  const [comments, setComments] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeOrder = propOrder !== undefined ? propOrder : internalOrder;
  const isOpen = propIsOpen !== undefined ? propIsOpen : isInternalOpen;

  // Auto-detect pending orders on login or page entrance
  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      setIsInternalOpen(false);
      return;
    }

    let isMounted = true;

    const checkPendingOrders = async () => {
      try {
        const pendingOrders = await reviewService.getPendingOrders();
        if (!isMounted) return;

        if (pendingOrders && pendingOrders.length > 0) {
          // Find first pending order that hasn't been dismissed in this session
          const eligible = pendingOrders.find((ord) => {
            const dismissed = sessionStorage.getItem(`torisakura_dismissed_review_${ord.orderId}`);
            return !dismissed;
          });

          if (eligible) {
            setInternalOrder(eligible);
            // Default 5 stars for convenience
            const initRatings: Record<number, number> = {};
            eligible.items.forEach((item) => {
              initRatings[item.menuItemId] = 5;
            });
            setRatings(initRatings);
            setIsInternalOpen(true);
          }
        }
      } catch (e) {
        console.warn('Auto review check failed', e);
      }
    };

    // Small delay to let page stabilize before showing popup
    const timer = setTimeout(() => {
      checkPendingOrders();
    }, 1500);

    // Listen to manual open events (e.g. from Profile page)
    const handleManualOpen = (e: any) => {
      if (e.detail) {
        setInternalOrder(e.detail);
        const initRatings: Record<number, number> = {};
        e.detail.items?.forEach((item: PendingReviewItem) => {
          initRatings[item.menuItemId] = 5;
        });
        setRatings(initRatings);
        setIsInternalOpen(true);
        setIsSubmittedSuccess(false);
        setErrorMsg(null);
      }
    };

    window.addEventListener('open-order-review-modal', handleManualOpen);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      window.removeEventListener('open-order-review-modal', handleManualOpen);
    };
  }, [isAuthenticated, currentUser]);

  const handleClose = () => {
    if (activeOrder) {
      sessionStorage.setItem(`torisakura_dismissed_review_${activeOrder.orderId}`, 'true');
    }
    if (propOnClose) {
      propOnClose();
    } else {
      setIsInternalOpen(false);
    }
    setIsSubmittedSuccess(false);
    setErrorMsg(null);
  };

  const handleRatingChange = (menuItemId: number, ratingValue: number) => {
    setRatings((prev) => ({ ...prev, [menuItemId]: ratingValue }));
  };

  const handleCommentChange = (menuItemId: number, text: string) => {
    setComments((prev) => ({ ...prev, [menuItemId]: text }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder) return;

    if (activeOrder.isExpired) {
      setErrorMsg('Đơn hàng này đã hoàn thành quá 15 ngày, không thể gửi đánh giá theo quy định.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      // Submit review for each dish
      for (const item of activeOrder.items) {
        const rating = ratings[item.menuItemId] || 5;
        const comment = comments[item.menuItemId] || '';
        await reviewService.submitReview({
          menuItemId: item.menuItemId,
          orderId: activeOrder.orderId,
          rating,
          comment: comment.trim() || undefined,
        });
      }

      setIsSubmittedSuccess(true);
      sessionStorage.setItem(`torisakura_dismissed_review_${activeOrder.orderId}`, 'true');

      // Ghi nhớ mã đơn đã đánh giá vào localStorage
      try {
        const stored: number[] = JSON.parse(localStorage.getItem('torisakura_reviewed_orders') || '[]');
        if (!stored.includes(activeOrder.orderId)) {
          stored.push(activeOrder.orderId);
          localStorage.setItem('torisakura_reviewed_orders', JSON.stringify(stored));
        }
      } catch {
        // ignore
      }

      // Bắn pháo giấy ăn mừng
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          zIndex: 9999,
        });
      } catch {
        // ignore
      }

      if (propOnSuccess) propOnSuccess(activeOrder.orderId);

      setTimeout(() => {
        handleClose();
      }, 2200);
    } catch (err: any) {
      console.error('Failed to submit review', err);
      const serverMsg = err.response?.data?.message || 'Không thể gửi đánh giá lúc này. Quý khách vui lòng thử lại sau.';
      setErrorMsg(serverMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !activeOrder) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div 
        className="relative w-full max-w-2xl bg-sumi-900 border-2 border-kin-500/40 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-sumi-950 via-sumi-900 to-sumi-950 border-b border-kin-500/30 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-shu-900/60 border border-kin-500/50 flex items-center justify-center text-kin-400 shadow-gold-glow">
              <Star className="w-5 h-5 fill-kin-400 text-kin-400" />
            </div>
            <div>
              <span className="text-[10px] font-kanji text-kin-400 tracking-widest font-bold">お客様の感想</span>
              <h2 className="font-serif text-lg sm:text-xl font-bold text-washi-100">
                Đánh Giá Đơn Hàng #{activeOrder.orderCode}
              </h2>
            </div>
          </div>

          <button
            onClick={handleClose}
            aria-label="Đóng popup"
            className="p-2 rounded-full text-washi-400 hover:text-white hover:bg-sumi-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Expiration Notice Bar */}
        <div className="px-6 py-2.5 bg-sumi-950/80 border-b border-sumi-800 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-washi-300">
            <Clock className="w-3.5 h-3.5 text-kin-400 shrink-0" />
            <span>
              {activeOrder.isExpired ? (
                <span className="text-red-400 font-semibold">Đã quá hạn đánh giá (quá 15 ngày kể từ ngày nhận hàng)</span>
              ) : (
                <span>
                  Hạn chót đánh giá: còn <strong className="text-kin-400">{activeOrder.remainingDays} ngày</strong> (tối đa 15 ngày sau khi nhận món)
                </span>
              )}
            </span>
          </div>
          <span className="text-[11px] text-kin-300/80 hidden sm:inline">Tích lũy +50 điểm/lần</span>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isSubmittedSuccess ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-950/80 border-2 border-emerald-400 mx-auto flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-900/40 animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="font-serif text-2xl font-bold text-washi-100">Cảm Ơn Đóng Góp Của Bạn!</h3>
              <p className="text-xs text-washi-300 max-w-md mx-auto">
                Đánh giá của bạn đã được ghi nhận. Nhà hàng chân thành cảm ơn ý kiến đóng góp quý báu để mang lại trải nghiệm ẩm thực trọn vẹn nhất.
              </p>
            </div>
          ) : (
            <form id="review-form" onSubmit={handleSubmit} className="space-y-6">
              <p className="text-xs text-washi-300">
                Hãy cho bếp trưởng biết cảm nhận của quý khách về hương vị, độ tươi và cách bài trí của các món ăn:
              </p>

              {activeOrder.items.map((item) => {
                const currentRate = ratings[item.menuItemId] || 5;
                const hovered = hoveredRating[item.menuItemId] || 0;
                const displayRate = hovered || currentRate;

                return (
                  <div
                    key={item.menuItemId}
                    className="bg-sumi-950/90 border border-kin-500/20 rounded-2xl p-4 sm:p-5 space-y-4 transition-all hover:border-kin-500/40"
                  >
                    <div className="flex items-center space-x-3.5">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.dishName}
                          className="w-14 h-14 rounded-xl object-cover border border-kin-500/30 shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-sumi-800 border border-kin-500/20 flex items-center justify-center text-kin-400 shrink-0">
                          <MessageSquare className="w-6 h-6" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-serif text-sm sm:text-base font-bold text-washi-100 truncate">
                          {item.dishName}
                        </h4>
                        <span className="text-xs text-kin-400 font-semibold">
                          {item.price.toLocaleString('vi-VN')}₫
                        </span>
                      </div>
                    </div>

                    {/* Star Rating Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-sumi-800">
                      <div className="flex items-center space-x-1.5">
                        {[1, 2, 3, 4, 5].map((starVal) => {
                          const isActive = starVal <= displayRate;
                          return (
                            <button
                              type="button"
                              key={starVal}
                              disabled={activeOrder.isExpired || submitting}
                              onClick={() => handleRatingChange(item.menuItemId, starVal)}
                              onMouseEnter={() =>
                                setHoveredRating((prev) => ({ ...prev, [item.menuItemId]: starVal }))
                              }
                              onMouseLeave={() =>
                                setHoveredRating((prev) => ({ ...prev, [item.menuItemId]: 0 }))
                              }
                              className="p-1 focus:outline-none transition-transform hover:scale-125 disabled:opacity-40"
                            >
                              <Star
                                className={`w-6 h-6 transition-colors ${
                                  isActive
                                    ? 'fill-kin-400 text-kin-400'
                                    : 'text-sumi-600 hover:text-sumi-400'
                                }`}
                              />
                            </button>
                          );
                        })}
                      </div>

                      <span className="text-xs text-kin-300 font-medium">
                        {RATING_LABELS[displayRate] || 'Chọn mức độ hài lòng'}
                      </span>
                    </div>

                    {/* Comment Area */}
                    <div>
                      <textarea
                        rows={2}
                        disabled={activeOrder.isExpired || submitting}
                        value={comments[item.menuItemId] || ''}
                        onChange={(e) => handleCommentChange(item.menuItemId, e.target.value)}
                        placeholder="Chia sẻ nhận xét của bạn về món này (vị thanh, nguyên liệu tươi, bài trí...)"
                        className="w-full bg-sumi-900 border border-sumi-700 rounded-xl p-3 text-xs text-washi-100 placeholder:text-washi-400 focus:outline-none focus:border-kin-400 disabled:opacity-50"
                      />
                    </div>
                  </div>
                );
              })}
            </form>
          )}
        </div>

        {/* Footer Actions */}
        {!isSubmittedSuccess && (
          <div className="px-6 py-4 bg-sumi-950 border-t border-kin-500/30 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="w-full sm:w-auto px-5 py-2.5 rounded-full text-xs font-semibold text-washi-300 hover:text-white bg-sumi-800 hover:bg-sumi-700 transition-colors"
            >
              Bỏ Qua Lần Này
            </button>

            <button
              type="submit"
              form="review-form"
              disabled={activeOrder.isExpired || submitting}
              className="w-full sm:w-auto px-7 py-2.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-shu-700 via-shu-600 to-shu-700 hover:from-shu-600 hover:to-shu-500 border border-kin-500/40 shadow-lg shadow-shu-950 disabled:opacity-40 flex items-center justify-center space-x-2 transition-all"
            >
              <CheckCircle2 className="w-4 h-4 text-kin-300" />
              <span>{submitting ? 'Đang Gửi Đánh Giá...' : 'Gửi Đánh Giá Của Tôi'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
