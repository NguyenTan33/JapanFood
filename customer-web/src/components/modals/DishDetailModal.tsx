import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Star,
  Clock,
  Flame,
  Plus,
  Minus,
  ShoppingBag,
  Check,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
} from 'lucide-react';
import { Dish, DishOptionGroup, DishOption, CartItemOption } from '@/types';
import { menuService } from '@/services/menuService';
import { reviewService, ManagedReviewDto } from '@/services/reviewService';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';

interface DishDetailModalProps {
  dish: Dish | null;
  onClose: () => void;
  onAddToCart?: (dish: Dish, selectedOptions: CartItemOption[], quantity: number, specialInstructions?: string) => void;
  confirmButtonText?: string;
}

export const DishDetailModal: React.FC<DishDetailModalProps> = ({
  dish,
  onClose,
  onAddToCart,
  confirmButtonText,
}) => {
  const { addToCart } = useCart();
  const { isAuthenticated, openAuthModal } = useAuth();
  const [currentDish, setCurrentDish] = useState<Dish | null>(dish);
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<CartItemOption[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isAddedToast, setIsAddedToast] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // Dish Reviews State
  const [dishReviews, setDishReviews] = useState<ManagedReviewDto[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [showReviewsPanel, setShowReviewsPanel] = useState(false);
  const reviewsSectionRef = useRef<HTMLDivElement | null>(null);

  // Sync currentDish with prop dish and fetch complete details (with modifier groups) if missing
  useEffect(() => {
    setCurrentDish(dish);
    setShowReviewsPanel(false);
    setDishReviews([]);
    if (dish && (!dish.optionGroups || dish.optionGroups.length === 0) && dish.code) {
      menuService
        .getDishDetail(dish.code)
        .then((full) => {
          if (full) {
            setCurrentDish(full);
          }
        })
        .catch((err) => {
          console.error('Lỗi tải chi tiết tùy chọn món ăn:', err);
        });
    }
    if (dish?.id) {
      setLoadingReviews(true);
      reviewService
        .getDishReviews(Number(dish.id), 1, 20)
        .then((res) => {
          const list = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
          setDishReviews(list);
        })
        .catch(() => {
          setDishReviews([]);
        })
        .finally(() => {
          setLoadingReviews(false);
        });
    }
  }, [dish]);

  const handleToggleReviewsPanel = () => {
    const next = !showReviewsPanel;
    setShowReviewsPanel(next);
    if (next) {
      setTimeout(() => {
        reviewsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    }
  };

  useEffect(() => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }

    setQuantity(1);
    setSpecialInstructions('');
    setIsAddedToast(false);
    setValidationError(null);

    if (!currentDish?.optionGroups?.length) {
      setSelectedOptions([]);
      return;
    }

    const defaults: CartItemOption[] = [];
    for (const group of currentDish.optionGroups) {
      const isRequired = group.isRequired || group.minSelection >= 1;
      const cap = group.maxSelection > 1 ? group.maxSelection : 1;
      let defaultOpts = group.options
        .filter((opt) => opt.isDefault && opt.isAvailable !== false)
        .slice(0, cap);

      // Fallback: If group is required but has no explicit isDefault option, pick the first available option
      if (isRequired && defaultOpts.length === 0 && group.options.length > 0) {
        const firstAvailable = group.options.find((opt) => opt.isAvailable !== false);
        if (firstAvailable) {
          defaultOpts = [firstAvailable];
        }
      }

      for (const opt of defaultOpts) {
        defaults.push({
          optionId: opt.id,
          optionName: opt.name,
          priceAdjustment: opt.priceAdjustment,
          groupName: group.code,
        });
      }
    }
    setSelectedOptions(defaults);
  }, [currentDish]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!dish) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dish, onClose]);

  const activeDish = currentDish || dish;
  if (!activeDish) return null;

  const handleToggleOption = (group: DishOptionGroup, option: DishOption) => {
    if (option.isAvailable === false) return;

    const isMultiple = group.maxSelection > 1;
    const exists = selectedOptions.some((o) => o.optionId === option.id);

    if (exists) {
      if (!isMultiple && (group.isRequired || group.minSelection >= 1)) {
        setValidationError(null);
        return;
      }
      setValidationError(null);
      setSelectedOptions((prev) => prev.filter((o) => o.optionId !== option.id));
      return;
    }

    if (!isMultiple) {
      setValidationError(null);
      setSelectedOptions((prev) => {
        const filtered = prev.filter((o) => o.groupName !== group.code);
        return [
          ...filtered,
          {
            optionId: option.id,
            optionName: option.name,
            priceAdjustment: option.priceAdjustment,
            groupName: group.code,
          },
        ];
      });
      return;
    }

    const currentGroupCount = selectedOptions.filter((o) => o.groupName === group.code).length;
    if (currentGroupCount >= group.maxSelection) {
      setValidationError(`Bạn chỉ có thể chọn tối đa ${group.maxSelection} mục cho "${group.name}".`);
      return;
    }

    setValidationError(null);
    setSelectedOptions((prev) => [
      ...prev,
      {
        optionId: option.id,
        optionName: option.name,
        priceAdjustment: option.priceAdjustment,
        groupName: group.code,
      },
    ]);
  };

  const modifiersTotal = selectedOptions.reduce((sum, opt) => sum + opt.priceAdjustment, 0);
  const unitPrice = activeDish.price + modifiersTotal;
  const totalPrice = unitPrice * quantity;

  const handleAddToCart = () => {
    // Only require web login if ordering online for delivery; dine-in table ordering passes onAddToCart
    if (!isAuthenticated && !onAddToCart) {
      openAuthModal('login', 'Quý khách vui lòng đăng nhập để thêm món vào giỏ hàng và đặt món.');
      return;
    }

    if (activeDish.optionGroups && activeDish.optionGroups.length > 0) {
      for (const group of activeDish.optionGroups) {
        const requiredMin = group.isRequired ? Math.max(1, group.minSelection) : group.minSelection;
        const selectedCount = selectedOptions.filter((o) => o.groupName === group.code).length;
        if (selectedCount < requiredMin) {
          setValidationError(`Vui lòng chọn ít nhất ${requiredMin} tùy chọn cho "${group.name}".`);
          return;
        }
      }
    }

    setValidationError(null);
    if (onAddToCart) {
      onAddToCart(activeDish, selectedOptions, quantity, specialInstructions);
    } else {
      addToCart(activeDish, selectedOptions, quantity, specialInstructions);
    }
    setIsAddedToast(true);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setIsAddedToast(false);
      onClose();
    }, 600);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dish-detail-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative bg-sumi-950 border border-kin-500/30 rounded-2xl max-w-2xl w-full max-h-[85vh] sm:max-h-[88vh] flex flex-col shadow-2xl overflow-hidden text-washi-100 z-10">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng chi tiết món ăn"
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 p-2 rounded-full bg-sumi-950/80 hover:bg-sumi-800 text-washi-300 hover:text-white transition-colors border border-kin-500/20"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Dish Hero Image */}
        <div className="relative h-32 sm:h-44 w-full bg-sumi-950 overflow-hidden shrink-0">
          <img
            src={activeDish.imageUrl}
            alt={activeDish.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-sumi-950 via-sumi-950/35 to-black/50" />

          <div className="absolute top-3 left-3 sm:top-4 sm:left-4 right-14 flex flex-wrap gap-1.5">
            {activeDish.tags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-full text-xs font-bold bg-shu-800/90 text-kin-200 border border-shu-600/60 shadow-md backdrop-blur-sm"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 flex items-end justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-kanji text-kin-400 font-bold mb-0.5 truncate">{activeDish.japaneseName}</p>
              <h2
                id="dish-detail-title"
                className="font-serif text-lg sm:text-2xl font-bold text-white drop-shadow-md leading-tight line-clamp-2"
              >
                {activeDish.name}
              </h2>
            </div>
            <div className="text-right shrink-0">
              <span className="text-lg sm:text-2xl font-bold text-kin-400 drop-shadow-md whitespace-nowrap">
                {activeDish.price.toLocaleString('vi-VN')}₫
              </span>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-5 sm:space-y-6">
          {/* Quick Info bar */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-washi-300 pb-4 border-b border-sumi-800">
            <div className="flex items-center space-x-1.5 text-kin-400">
              <Star className="w-4 h-4 fill-kin-400" />
              <span className="font-bold text-washi-100">{activeDish.rating}</span>
              <span className="text-washi-400">
                ({dishReviews.length > 0 ? dishReviews.length : activeDish.reviewCount} đánh giá)
              </span>
              <button
                type="button"
                onClick={handleToggleReviewsPanel}
                className="ml-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-kin-500/15 hover:bg-kin-500/25 text-kin-300 border border-kin-500/40 transition-colors cursor-pointer"
              >
                <MessageSquare className="w-3 h-3" />
                <span>{showReviewsPanel ? 'Ẩn đánh giá' : 'Xem đánh giá'}</span>
                {showReviewsPanel ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
            <div className="flex items-center space-x-1">
              <Clock className="w-4 h-4 text-washi-400" />
              <span>{activeDish.preparationTimeMinutes} phút chuẩn bị</span>
            </div>
            {activeDish.calories && (
              <div className="flex items-center space-x-1">
                <Flame className="w-4 h-4 text-shu-400" />
                <span>{activeDish.calories} kcal</span>
              </div>
            )}
            <div className="text-kin-400/90">
              Mã: <span className="font-mono">{activeDish.code}</span>
            </div>
          </div>

          {/* Customer Reviews Panel */}
          {showReviewsPanel && (
            <div
              ref={reviewsSectionRef}
              className="rounded-xl bg-sumi-950/90 border border-kin-500/30 p-3.5 sm:p-4 space-y-3 animate-fade-in"
            >
              <div className="flex items-center justify-between border-b border-sumi-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-kin-400" />
                  <h4 className="text-xs uppercase tracking-wider text-kin-400 font-bold">
                    Đánh giá từ thực khách ({dishReviews.length})
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReviewsPanel(false)}
                  className="text-[11px] text-washi-400 hover:text-washi-200 transition-colors"
                >
                  Đóng
                </button>
              </div>

              {loadingReviews ? (
                <div className="py-4 text-center text-xs text-washi-400">
                  Đang tải đánh giá của thực khách...
                </div>
              ) : dishReviews.length === 0 ? (
                <div className="py-4 text-center text-xs text-washi-400">
                  Chưa có nhận xét chi tiết nào cho món ăn này.
                </div>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {dishReviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="p-3 rounded-lg bg-sumi-900/90 border border-sumi-800 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-kin-500/20 border border-kin-500/40 flex items-center justify-center text-[11px] font-bold text-kin-300 shrink-0">
                            {(rev.customerName || 'K').charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs font-semibold text-washi-100 truncate">
                            {rev.customerName || 'Thực khách'}
                          </span>
                          {rev.isVerifiedDining && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-700/50 shrink-0">
                              <ShieldCheck className="w-3 h-3" /> Đã thưởng thức
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-washi-500 shrink-0">
                          {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString('vi-VN') : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <Star
                            key={idx}
                            className={`w-3.5 h-3.5 ${
                              idx < Math.round(rev.rating || 5)
                                ? 'text-kin-400 fill-kin-400'
                                : 'text-sumi-700'
                            }`}
                          />
                        ))}
                      </div>

                      <p className="text-xs text-washi-200 leading-relaxed">{rev.comment}</p>

                      {rev.managerReply && (
                        <div className="mt-2 pl-2.5 border-l-2 border-kin-500/60 bg-sumi-950/60 p-2 rounded-r-lg text-[11px] text-washi-300">
                          <span className="font-semibold text-kin-400 block mb-0.5">
                            Phản hồi từ Nhà hàng Sakura:
                          </span>
                          {rev.managerReply}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <h4 className="text-xs uppercase tracking-wider text-kin-400 font-semibold mb-1">Mô tả món ăn</h4>
            <p className="text-xs sm:text-sm text-washi-300 leading-relaxed">{activeDish.description}</p>
          </div>

          {/* Ingredients */}
          {activeDish.ingredients && activeDish.ingredients.length > 0 && (
            <div>
              <h4 className="text-xs uppercase tracking-wider text-kin-400 font-semibold mb-2">Thành phần tinh tuyển</h4>
              <div className="flex flex-wrap gap-1.5">
                {activeDish.ingredients.map((ing) => (
                  <span
                    key={ing}
                    className="px-2.5 py-1 rounded-lg text-xs bg-sumi-900 border border-sumi-700 text-washi-300"
                  >
                    • {ing}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Option Groups (Modifiers / Toppings) */}
          {activeDish.optionGroups && activeDish.optionGroups.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-sumi-800">
              <h4 className="text-xs uppercase tracking-wider text-kin-400 font-semibold">Tùy Chọn Thêm (Toppings & Gia Vị)</h4>
              {activeDish.optionGroups.map((group) => {
                const requiredMin = group.isRequired ? Math.max(1, group.minSelection) : group.minSelection;
                const selectedCount = selectedOptions.filter((o) => o.groupName === group.code).length;
                const isGroupInvalid = Boolean(validationError) && selectedCount < requiredMin;
                const ruleLabel = group.isRequired
                  ? group.maxSelection > 1
                    ? `Bắt buộc (${requiredMin}–${group.maxSelection})`
                    : 'Bắt buộc chọn 1'
                  : group.maxSelection > 1
                    ? `Tùy chọn (tối đa ${group.maxSelection})`
                    : 'Tùy chọn';

                return (
                <div
                  key={group.id}
                  className={`p-4 rounded-xl bg-sumi-900/60 border space-y-2.5 ${
                    isGroupInvalid ? 'border-shu-500/80' : 'border-sumi-800'
                  }`}
                >
                  <div className="flex justify-between items-center gap-2 text-xs">
                    <span className="font-medium text-washi-200">{group.name}</span>
                    <span className="text-[11px] text-washi-400 shrink-0 whitespace-nowrap">
                      {ruleLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {group.options.map((opt) => {
                      const isSelected = selectedOptions.some((o) => o.optionId === opt.id);
                      const isUnavailable = opt.isAvailable === false;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={isUnavailable}
                          onClick={() => handleToggleOption(group, opt)}
                          className={`p-2.5 rounded-lg text-left text-xs transition-all flex items-center justify-between gap-2 border ${
                            isUnavailable
                              ? 'bg-sumi-950/60 border-sumi-800 text-washi-500 opacity-50 cursor-not-allowed'
                              : isSelected
                                ? 'bg-shu-950/80 border-kin-500/60 text-white shadow-sm'
                                : 'bg-sumi-900 border-sumi-700 hover:border-sumi-600 text-washi-300'
                          }`}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            {group.maxSelection > 1 ? (
                              <span
                                className={`w-4 h-4 rounded-md flex items-center justify-center border text-[9px] shrink-0 transition-colors ${
                                  isSelected ? 'bg-kin-500 border-kin-400 text-sumi-950 font-bold' : 'border-sumi-600 bg-sumi-950'
                                }`}
                              >
                                {isSelected && <Check className="w-2.5 h-2.5" />}
                              </span>
                            ) : (
                              <span
                                className={`w-4 h-4 rounded-full flex items-center justify-center border shrink-0 transition-colors ${
                                  isSelected ? 'border-kin-400 bg-sumi-950 ring-2 ring-kin-500/30' : 'border-sumi-600 bg-sumi-950'
                                }`}
                              >
                                {isSelected && <span className="w-2 h-2 rounded-full bg-kin-400" />}
                              </span>
                            )}
                            <span className="break-words leading-tight">{opt.name}</span>
                          </span>
                          <span className="text-kin-400 font-medium shrink-0 whitespace-nowrap">
                            {isUnavailable
                              ? 'Hết'
                              : opt.priceAdjustment > 0
                                ? `+${opt.priceAdjustment.toLocaleString('vi-VN')}₫`
                                : 'Miễn phí'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                );
              })}
            </div>
          )}

          {/* Special Instructions */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-kin-400 font-semibold mb-1">
              Ghi chú cho bếp trưởng
            </label>
            <input
              type="text"
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="ví dụ: Không hành lá, ít cay, để riêng nước sốt..."
              className="w-full bg-sumi-900 border border-sumi-700 rounded-xl px-3.5 py-2 text-base sm:text-xs text-washi-100 placeholder:text-washi-500 focus:outline-none focus:border-kin-400 transition-colors"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-5 bg-sumi-900 border-t border-kin-500/20 flex flex-col gap-3 shrink-0">
          {validationError && (
            <div
              role="alert"
              className="px-3 py-2 rounded-lg bg-shu-950/90 border border-shu-500/60 text-xs text-shu-200"
            >
              {validationError}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 w-full">
            <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-start">
              <span className="text-xs text-washi-400 whitespace-nowrap">Số lượng:</span>
              <div className="flex items-center space-x-3 bg-sumi-950 rounded-xl border border-sumi-700 px-3 py-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  aria-label="Giảm số lượng"
                  className="text-washi-400 hover:text-washi-100 p-0.5"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-sm font-bold text-washi-100 px-2 min-w-[1.5rem] text-center">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  aria-label="Tăng số lượng"
                  className="text-washi-400 hover:text-washi-100 p-0.5"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="sm:hidden text-right shrink-0">
                <span className="text-sm font-bold text-kin-400 whitespace-nowrap">{totalPrice.toLocaleString('vi-VN')}₫</span>
              </div>
            </div>

            <div className="flex items-center space-x-4 w-full sm:w-auto">
              <div className="hidden sm:block text-right shrink-0">
                <p className="text-[10px] text-washi-400 uppercase tracking-wider">Tổng cộng</p>
                <p className="text-lg font-bold text-kin-400 whitespace-nowrap">{totalPrice.toLocaleString('vi-VN')}₫</p>
              </div>

              <button
                type="button"
                onClick={handleAddToCart}
                className="flex-1 sm:flex-initial px-6 py-3 rounded-xl text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-shu-700 via-shu-600 to-shu-700 hover:from-shu-600 hover:to-shu-500 border border-kin-500/40 shadow-lg shadow-shu-950/80 flex items-center justify-center space-x-2 transition-all whitespace-nowrap"
              >
                <ShoppingBag className="w-4 h-4 shrink-0" />
                <span>{isAddedToast ? 'Đã thêm thành công!' : (confirmButtonText || 'Thêm Vào Giỏ Hàng')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
