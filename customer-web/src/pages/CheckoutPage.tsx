import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  CreditCard, 
  Truck, 
  QrCode, 
  Copy, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ShoppingBag,
  Sparkles,
  MapPin,
  Plus,
  Check
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { addressService, UserAddress, CreateAddressRequest } from '@/services/addressService';
import { orderService } from '@/services/orderService';
import { restaurantInfoService } from '@/services/restaurantInfoService';
import { BankAccountInfo } from '@/types';
import confetti from 'canvas-confetti';

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { items, subtotal, clearCart } = useCart();
  const { currentUser, isAuthenticated, openAuthModal } = useAuth();

  const [bankAccount, setBankAccount] = useState<BankAccountInfo>({
    bankName: 'Ngân hàng Quân Đội (MB Bank)',
    bankCode: 'MB',
    accountNumber: '0903123456888',
    accountHolder: 'TORI SAKURA RESTAURANT CO LTD',
    branch: 'Chi nhánh Nam Sài Gòn',
    defaultQrTemplate: 'compact2',
  });

  useEffect(() => {
    restaurantInfoService.getBankAccountInfo()
      .then(setBankAccount)
      .catch(err => console.error('Lỗi tải thông tin ngân hàng:', err));
  }, []);

  // If cart empty
  useEffect(() => {
    if (items.length === 0 && !isOrderComplete) {
      navigate('/cart');
    }
  }, [items]);

  // Address state
  const [savedAddresses, setSavedAddresses] = useState<UserAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | 'new'>('new');
  const [saveAddressForNextTime, setSaveAddressForNextTime] = useState(true);

  // Form State initialized from authenticated user
  const [recipientName, setRecipientName] = useState(() => currentUser?.fullName || '');
  const [recipientPhone, setRecipientPhone] = useState(() => currentUser?.phoneNumber || '');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');

  // Fetch saved addresses
  useEffect(() => {
    if (isAuthenticated) {
      addressService.getAddresses().then((addrs) => {
        setSavedAddresses(addrs);
        if (addrs && addrs.length > 0) {
          const defaultAddr = addrs.find((a) => a.isDefault) || addrs[0];
          setSelectedAddressId(defaultAddr.addressId);
          setRecipientName(defaultAddr.recipientName);
          setRecipientPhone(defaultAddr.phoneNumber);
          setRecipientAddress(defaultAddr.fullAddress || defaultAddr.streetAddress);
        } else {
          setSelectedAddressId('new');
          if (currentUser) {
            setRecipientName(currentUser.fullName || '');
            setRecipientPhone(currentUser.phoneNumber || '');
          }
        }
      }).catch((e) => console.warn('Failed to load saved addresses', e));
    }
  }, [isAuthenticated, currentUser]);

  const handleSelectAddress = (addr: UserAddress) => {
    setSelectedAddressId(addr.addressId);
    setRecipientName(addr.recipientName);
    setRecipientPhone(addr.phoneNumber);
    setRecipientAddress(addr.fullAddress || addr.streetAddress);
  };

  const handleSelectNewAddress = () => {
    setSelectedAddressId('new');
    setRecipientAddress('');
  };

  // Payment method: ONLY 2 VALID OPTIONS
  const [paymentMethod, setPaymentMethod] = useState<'FULL_BANK' | 'COD_50_DEPOSIT'>('FULL_BANK');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(900); // 15 minutes
  const [isOrderComplete, setIsOrderComplete] = useState(false);
  const [orderCode, setOrderCode] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const finalTotal = subtotal;
  const depositAmount = Math.round(finalTotal * 0.5);
  const transferAmount = paymentMethod === 'FULL_BANK' ? finalTotal : depositAmount;
  const remainingCod = paymentMethod === 'FULL_BANK' ? 0 : finalTotal - depositAmount;

  const currentOrderNum = orderCode || `SAKURA-ORD-${Math.floor(100000 + Math.random() * 900000)}`;
  const transferMessage = `SAKURA ${currentOrderNum.split('-').pop()}`;

  // VietQR Image URL
  const vietQrUrl = `https://img.vietqr.io/image/${bankAccount.bankCode}-${bankAccount.accountNumber}-${bankAccount.defaultQrTemplate || 'compact2'}.png?amount=${transferAmount}&addInfo=${encodeURIComponent(transferMessage)}&accountName=${encodeURIComponent(bankAccount.accountHolder)}`;

  // Countdown timer
  useEffect(() => {
    if (isOrderComplete) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOrderComplete]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!recipientName.trim() || !recipientPhone.trim() || !recipientAddress.trim()) {
      setSubmitError('Vui lòng điền đầy đủ tên người nhận, số điện thoại và địa chỉ nhận hàng.');
      return;
    }

    setSubmittingOrder(true);

    try {
      // Save address if user created a new address and opted to save
      if (selectedAddressId === 'new' && saveAddressForNextTime) {
        try {
          await addressService.createAddress({
            recipientName,
            phoneNumber: recipientPhone,
            streetAddress: recipientAddress,
            isDefault: savedAddresses.length === 0,
          });
        } catch (e) {
          console.warn('Address saving failed in background', e);
        }
      }

      // Map cart items for backend order creation
      const orderItems = items.map((ci) => ({
        menuItemId: ci.dishId,
        quantity: ci.quantity,
        modifierOptionIds: ci.selectedOptions?.map((o) => o.optionId) || [],
        specialInstructions: ci.specialInstructions || undefined,
      }));

      const res = await orderService.createOrder({
        orderType: 'Delivery',
        deliveryAddress: recipientAddress,
        recipientName,
        recipientPhone,
        paymentMethod: paymentMethod === 'FULL_BANK' ? 'FullBank' : 'Cod50Deposit',
        notes: deliveryNote.trim() || undefined,
        items: orderItems,
      });

      setOrderCode(res.orderNumber || currentOrderNum);
      setIsOrderComplete(true);
      clearCart();

      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#D4A359', '#8B1E1E', '#FFFFFF'],
        });
      } catch (e) {
        // Ignore
      }
    } catch (err: any) {
      console.error('Order creation error', err);
      const errMsg =
        err?.response?.data?.message ||
        err?.message ||
        'Không thể tạo đơn hàng lúc này. Vui lòng kiểm tra thông tin và thử lại.';
      setSubmitError(errMsg);
    } finally {
      setSubmittingOrder(false);
    }
  };

  if (!isAuthenticated && !isOrderComplete) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center w-full px-4 py-12 sm:py-16 text-center max-w-lg mx-auto my-4 sm:my-8">
        <div className="bg-sumi-900/90 border-2 border-kin-500/40 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl w-full space-y-6">
          <div className="w-16 h-16 rounded-full bg-sumi-800 border-2 border-kin-400 mx-auto flex items-center justify-center text-kin-400 shadow-gold-glow">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <span className="text-xs font-kanji text-kin-400 tracking-widest font-bold">会員認証</span>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-washi-100 mt-1">
              Yêu Cầu Đăng Nhập
            </h1>
            <p className="text-xs sm:text-sm text-washi-300 mt-2 leading-relaxed">
              Quý khách vui lòng đăng nhập hoặc tạo tài khoản thành viên để tiếp tục đặt món, bảo mật thông tin giao hàng và tích lũy điểm thưởng ẩm thực.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={() => openAuthModal('login', 'Quý khách vui lòng đăng nhập để tiến hành đặt hàng.')}
              className="flex-1 py-3 px-5 rounded-xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-shu-700 via-shu-600 to-shu-700 hover:from-shu-600 hover:to-shu-500 border border-kin-500/40 shadow-lg shadow-shu-950 transition-all"
            >
              Đăng Nhập Ngay
            </button>
            <Link
              to="/cart"
              className="py-3 px-5 rounded-xl font-semibold text-xs sm:text-sm text-kin-300 bg-sumi-800 hover:bg-sumi-700 border border-kin-500/30 transition-all"
            >
              Quay Lại Giỏ Hàng
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isOrderComplete) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center w-full px-4 py-8 sm:p-6 text-center max-w-xl mx-auto my-4 sm:my-12">
        <div className="bg-sumi-900 border-2 border-kin-500/50 rounded-3xl p-5 sm:p-8 shadow-2xl backdrop-blur-xl w-full space-y-6">
          <div className="w-16 h-16 rounded-full bg-shu-900/80 border-2 border-kin-400 mx-auto flex items-center justify-center text-kin-400 shadow-gold-glow animate-bounce">
            <CheckCircle2 className="w-8 h-8 text-kin-400" />
          </div>

          <div>
            <span className="text-xs font-kanji text-kin-400 tracking-widest font-bold">注文完了</span>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-washi-100 mt-1">
              Đặt Hàng Thành Công!
            </h1>
            <p className="text-xs text-washi-300 mt-1">
              Đơn hàng của quý khách <strong className="text-kin-400">{recipientName}</strong> đang được bếp trưởng tiếp nhận và chuẩn bị.
            </p>
          </div>

          <div className="bg-sumi-950 border border-kin-500/30 rounded-2xl p-4 sm:p-5 text-left text-xs space-y-2.5">
            <div className="flex flex-wrap justify-between items-center gap-2 pb-2 border-b border-sumi-800">
              <span className="text-washi-400">Mã Đơn Hàng:</span>
              <span className="font-mono font-bold text-kin-400 text-sm shrink-0 whitespace-nowrap">{orderCode}</span>
            </div>
            <div className="flex flex-wrap justify-between gap-2 text-washi-300">
              <span>Hình thức:</span>
              <span className="font-medium text-white text-right">
                {paymentMethod === 'FULL_BANK' ? 'Đã Chuyển Khoản 100%' : 'Ship COD (Đã cọc 50%)'}
              </span>
            </div>
            <div className="flex justify-between gap-2 text-washi-300">
              <span>Đã thanh toán / cọc:</span>
              <span className="font-bold text-emerald-400 shrink-0 whitespace-nowrap">{transferAmount.toLocaleString('vi-VN')}₫</span>
            </div>
            {remainingCod > 0 && (
              <div className="flex justify-between gap-2 text-washi-300">
                <span>Còn lại thanh toán khi nhận hàng:</span>
                <span className="font-bold text-kin-400 shrink-0 whitespace-nowrap">{remainingCod.toLocaleString('vi-VN')}₫</span>
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4 text-washi-300">
              <span className="shrink-0">Địa chỉ giao hàng:</span>
              <span className="sm:text-right text-[11px] text-washi-100 break-words">{recipientAddress}</span>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/profile?tab=orders"
              className="px-6 py-3 rounded-full text-xs font-semibold text-white bg-shu-700 hover:bg-shu-600 border border-kin-500/40 whitespace-nowrap"
            >
              Theo Dõi Đơn Hàng Tại Hồ Sơ
            </Link>
            <Link
              to="/menu"
              className="px-6 py-3 rounded-full text-xs font-semibold text-kin-300 bg-sumi-950 border border-kin-500/30 hover:border-kin-400 whitespace-nowrap"
            >
              Tiếp Tục Khám Phá Menu
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col py-8 sm:py-10 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full">
      {/* Title */}
      <div className="text-center max-w-xl mx-auto mb-8">
        <span className="text-xs font-semibold uppercase tracking-widest text-kin-400">Thanh Toán An Toàn</span>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-washi-100 mt-1">Xác Nhận & Đặt Hàng</h1>
      </div>

      {submitError && (
        <div className="mb-6 p-4 rounded-xl bg-red-950/70 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{submitError}</span>
        </div>
      )}

      <form onSubmit={handleConfirmPayment} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Delivery Address & Payment Method (7 cols) */}
        <div className="lg:col-span-7 space-y-6 min-w-0">
          {/* Delivery Information & Address Book Integration */}
          <div className="bg-sumi-900/90 border border-kin-500/25 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-sumi-800">
              <div className="flex items-center space-x-2">
                <Truck className="w-4 h-4 text-kin-400 shrink-0" />
                <h2 className="font-serif text-base font-bold text-washi-100">Thông Tin Giao Hàng</h2>
              </div>
              {savedAddresses.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectNewAddress}
                  className="text-xs text-kin-300 hover:text-kin-200 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nhập địa chỉ mới</span>
                </button>
              )}
            </div>

            {/* Saved Addresses List (if any exist) */}
            {savedAddresses.length > 0 && (
              <div className="space-y-2.5 mb-4">
                <span className="text-xs text-washi-400 block">Chọn từ địa chỉ đã lưu:</span>
                <div className="grid grid-cols-1 gap-2.5">
                  {savedAddresses.map((addr) => {
                    const isSelected = selectedAddressId === addr.addressId;
                    return (
                      <div
                        key={addr.addressId}
                        onClick={() => handleSelectAddress(addr)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                          isSelected
                            ? 'bg-shu-950/80 border-kin-400 shadow-md'
                            : 'bg-sumi-950/80 border-sumi-800 hover:border-sumi-700'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-kin-400 bg-shu-700' : 'border-sumi-600'
                        }`}>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-kin-300" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-washi-100">{addr.recipientName}</span>
                            <span className="text-[11px] text-washi-400 font-mono">({addr.phoneNumber})</span>
                            {addr.isDefault && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                                Mặc định
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-washi-300 mt-0.5 truncate">
                            {addr.fullAddress || addr.streetAddress}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Address inputs (shown when entering new address or when user has no saved addresses) */}
            {(selectedAddressId === 'new' || savedAddresses.length === 0) && (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-washi-300 mb-1">Họ tên người nhận *</label>
                    <input
                      type="text"
                      required
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="w-full bg-sumi-950 border border-sumi-700 rounded-xl px-3 py-2 text-base sm:text-xs text-washi-100 focus:outline-none focus:border-kin-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-washi-300 mb-1">Số điện thoại nhận hàng *</label>
                    <input
                      type="tel"
                      required
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      className="w-full bg-sumi-950 border border-sumi-700 rounded-xl px-3 py-2 text-base sm:text-xs text-washi-100 focus:outline-none focus:border-kin-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-washi-300 mb-1">Địa chỉ giao hàng chi tiết *</label>
                  <input
                    type="text"
                    required
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    placeholder="Số nhà, tên đường, phường, quận..."
                    className="w-full bg-sumi-950 border border-sumi-700 rounded-xl px-3 py-2 text-base sm:text-xs text-washi-100 focus:outline-none focus:border-kin-400"
                  />
                </div>

                {/* Checkbox to save address for next time as requested */}
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={saveAddressForNextTime}
                    onChange={(e) => setSaveAddressForNextTime(e.target.checked)}
                    className="rounded border-sumi-700 text-shu-600 focus:ring-kin-400"
                  />
                  <span className="text-xs text-kin-300">
                    Lưu địa chỉ này vào Sổ địa chỉ để dùng cho các lần đặt tiếp theo
                  </span>
                </label>
              </div>
            )}

            <div>
              <label className="block text-xs text-washi-300 mb-1">Ghi chú giao hàng</label>
              <input
                type="text"
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                placeholder="ví dụ: Giao trước 19h, gọi trước khi đến 10 phút..."
                className="w-full bg-sumi-950 border border-sumi-700 rounded-xl px-3 py-2 text-base sm:text-xs text-washi-100 focus:outline-none focus:border-kin-400"
              />
            </div>
          </div>

          {/* Payment Method Enforcement (STRICT 2 METHODS) */}
          <div className="bg-sumi-900/90 border border-kin-500/25 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-sumi-800">
              <CreditCard className="w-4 h-4 text-kin-400 shrink-0" />
              <h2 className="font-serif text-base font-bold text-washi-100">Phương Thức Thanh Toán</h2>
            </div>

            <div className="space-y-3">
              {/* Method 1: 100% Bank Transfer */}
              <label
                className={`p-3.5 sm:p-4 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  paymentMethod === 'FULL_BANK'
                    ? 'bg-shu-950/80 border-kin-400 shadow-md'
                    : 'bg-sumi-950 border-sumi-800 hover:border-sumi-700'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === 'FULL_BANK'}
                  onChange={() => setPaymentMethod('FULL_BANK')}
                  className="mt-1 text-shu-600 focus:ring-kin-400 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap justify-between items-start gap-2">
                    <span className="font-bold text-xs text-washi-100">
                      Chuyển Khoản Ngân Hàng 100% (VietQR Khuyên Dùng)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40 shrink-0 whitespace-nowrap">
                      Tối ưu nhất
                    </span>
                  </div>
                  <p className="text-[11px] text-washi-300 mt-1">
                    Thanh toán toàn bộ {finalTotal.toLocaleString('vi-VN')}₫ qua mã QR ngân hàng. Đơn hàng được nhà hàng ưu tiên chuẩn bị ngay.
                  </p>
                </div>
              </label>

              {/* Method 2: COD with 50% Deposit */}
              <label
                className={`p-3.5 sm:p-4 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  paymentMethod === 'COD_50_DEPOSIT'
                    ? 'bg-shu-950/80 border-kin-400 shadow-md'
                    : 'bg-sumi-950 border-sumi-800 hover:border-sumi-700'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === 'COD_50_DEPOSIT'}
                  onChange={() => setPaymentMethod('COD_50_DEPOSIT')}
                  className="mt-1 text-shu-600 focus:ring-kin-400 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap justify-between items-start gap-2">
                    <span className="font-bold text-xs text-washi-100">
                      Ship COD (Bắt Buộc Chuyển Khoản Cọc Trước 50%)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-shu-900 text-kin-300 border border-shu-600 shrink-0 whitespace-nowrap">
                      Cọc {depositAmount.toLocaleString('vi-VN')}₫
                    </span>
                  </div>
                  <p className="text-[11px] text-washi-300 mt-1">
                    Quý khách chuyển khoản cọc trước <strong>50%</strong> ({depositAmount.toLocaleString('vi-VN')}₫). Số tiền còn lại ({remainingCod.toLocaleString('vi-VN')}₫) thanh toán tiền mặt cho shipper khi nhận món.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic VietQR Box & Final Button (5 cols) */}
        <div className="lg:col-span-5 space-y-6 min-w-0">
          <div className="bg-sumi-900 border-2 border-kin-500/40 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-5">
            <div className="flex justify-between items-center gap-2 pb-3 border-b border-sumi-800">
              <div className="flex items-center space-x-2 min-w-0">
                <QrCode className="w-5 h-5 text-kin-400 shrink-0" />
                <h3 className="font-serif text-base font-bold text-washi-100 truncate">Quét Mã VietQR Chuyển Tiền</h3>
              </div>
              <div className="flex items-center space-x-1 text-xs text-kin-400 font-mono shrink-0 whitespace-nowrap">
                <Clock className="w-3.5 h-3.5" />
                <span>{formatTimer(countdown)}</span>
              </div>
            </div>

            {/* QR Code Card */}
            <div className="bg-white p-3 rounded-2xl w-full max-w-[240px] mx-auto shadow-lg">
              <img
                src={vietQrUrl}
                alt="VietQR Transfer"
                className="w-full h-auto object-contain rounded-xl"
              />
            </div>

            {/* Account Details Box */}
            <div className="bg-sumi-950 border border-sumi-800 rounded-xl p-3.5 sm:p-4 space-y-2.5 text-xs">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <span className="text-washi-400">Ngân hàng:</span>
                <span className="font-semibold text-washi-100 text-right break-words">{bankAccount.bankName}</span>
              </div>

              <div className="flex flex-wrap justify-between items-center gap-2">
                <span className="text-washi-400">Số tài khoản:</span>
                <div className="flex items-center space-x-1.5 shrink-0">
                  <span className="font-mono font-bold text-kin-400 text-sm whitespace-nowrap">{bankAccount.accountNumber}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(bankAccount.accountNumber, 'acc')}
                    aria-label="Sao chép số tài khoản"
                    className="p-1 hover:bg-sumi-800 rounded text-washi-400 hover:text-white"
                    title="Sao chép"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap justify-between items-center gap-2">
                <span className="text-washi-400">Chủ tài khoản:</span>
                <span className="font-semibold text-washi-100 text-[11px] text-right break-words">{bankAccount.accountHolder}</span>
              </div>

              <div className="flex flex-wrap justify-between items-center gap-2 pt-2 border-t border-sumi-800">
                <span className="text-washi-400">
                  {paymentMethod === 'FULL_BANK' ? 'Số tiền thanh toán (100%):' : 'Số tiền cọc cần chuyển (50%):'}
                </span>
                <div className="flex items-center space-x-1.5 shrink-0">
                  <span className="font-bold text-kin-400 text-base whitespace-nowrap">
                    {transferAmount.toLocaleString('vi-VN')}₫
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(transferAmount.toString(), 'amount')}
                    aria-label="Sao chép số tiền"
                    className="p-1 hover:bg-sumi-800 rounded text-washi-400 hover:text-white"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap justify-between items-center gap-2">
                <span className="text-washi-400">Nội dung chuyển khoản:</span>
                <div className="flex items-center space-x-1.5 shrink-0">
                  <span className="font-mono font-bold text-kin-300 text-xs whitespace-nowrap">{transferMessage}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(transferMessage, 'msg')}
                    aria-label="Sao chép nội dung chuyển khoản"
                    className="p-1 hover:bg-sumi-800 rounded text-washi-400 hover:text-white"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {copiedField && (
              <div className="text-center text-[11px] text-emerald-400 bg-emerald-950/60 py-1 rounded-lg border border-emerald-500/30">
                Đã sao chép vào bộ nhớ tạm!
              </div>
            )}

            {/* Submit Confirmation Button */}
            <button
              type="submit"
              disabled={submittingOrder}
              className="w-full py-3.5 sm:py-4 px-4 rounded-xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-shu-700 via-shu-600 to-shu-700 hover:from-shu-600 hover:to-shu-500 border border-kin-500/40 shadow-xl shadow-shu-950/80 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4 text-kin-300 shrink-0" />
              <span>{submittingOrder ? 'Đang Xử Lý Đơn Hàng...' : 'Tôi Đã Chuyển Khoản & Xác Nhận Đơn'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
