import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  Banknote,
  QrCode,
  Tag,
  UserCheck,
  Check,
  AlertCircle,
  Calculator,
} from 'lucide-react';
import { posService, PosTable, PosCustomer, VietQrResponse } from '@/services/posService';
import { getErrorMessage } from '@/services/apiClient';
import { formatVND } from '@/utils/dateUtils';
import { useAuth } from '@/context/AuthContext';
import { PosReceiptData, roundCashChange, roundBillAmount } from './PosReceiptModal';

interface PosCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: PosTable | null;
  orderItems: Array<{
    id: number;
    name: string;
    quantity: number;
    price: number;
    total: number;
    modifiers?: string;
  }>;
  subtotal: number;
  taxAmount?: number;
  totalAmount?: number;
  onPaymentSuccess: (receiptData: PosReceiptData) => void;
  onCancelEmptyTable?: (tableId: number) => Promise<void>;
}

export const PosCheckoutModal: React.FC<PosCheckoutModalProps> = ({
  isOpen,
  onClose,
  table,
  orderItems,
  subtotal,
  taxAmount,
  totalAmount,
  onPaymentSuccess,
  onCancelEmptyTable,
}) => {
  const { currentUser } = useAuth();

  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'VIETQR'>('CASH');
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<{ code: string; discountAmount: number } | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [isCheckingVoucher, setIsCheckingVoucher] = useState(false);

  const [customerPhone, setCustomerPhone] = useState('');
  const [customer, setCustomer] = useState<PosCustomer | null>(null);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [usePoints, setUsePoints] = useState(false);
  const [pointsToUse, setPointsToUse] = useState(0);

  const actualTax = taxAmount ?? Math.round(subtotal * 0.08);
  const baseBeforeDiscount = totalAmount ?? (subtotal + actualTax);
  const voucherDiscount = appliedVoucher ? appliedVoucher.discountAmount : 0;
  const pointsDiscountValue = usePoints ? Math.min(pointsToUse * 100, Math.max(0, baseBeforeDiscount - voucherDiscount)) : 0;
  const finalTotal = Math.max(0, baseBeforeDiscount - voucherDiscount - pointsDiscountValue);
  const roundedBill = roundBillAmount(finalTotal);
  const billRoundingDiff = roundedBill - finalTotal;

  const [amountGiven, setAmountGiven] = useState<number>(roundedBill);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const [vietQr, setVietQr] = useState<VietQrResponse | null>(null);
  const [isLoadingQr, setIsLoadingQr] = useState(false);

  const rawChangeAmount = Math.max(0, amountGiven - finalTotal);
  const changeAmount = Math.max(0, amountGiven - roundedBill);
  const changeRoundingDiff = changeAmount - rawChangeAmount;
  const isCashSufficient = amountGiven >= roundedBill;

  useEffect(() => {
    setAmountGiven(roundedBill);
  }, [roundedBill, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setPaymentError(null);
      setVoucherError(null);
    }
  }, [isOpen, table?.tableId]);

  useEffect(() => {
    const orderId = table?.currentOrderId ?? table?.activeOrderId;
    if (isOpen && paymentMethod === 'VIETQR' && orderId) {
      setIsLoadingQr(true);
      posService
        .getVietQr(orderId)
        .then((qr) => setVietQr(qr))
        .catch((err) => {
          setVietQr(null);
          setPaymentError(getErrorMessage(err));
        })
        .finally(() => setIsLoadingQr(false));
    }
  }, [isOpen, paymentMethod, finalTotal, table]);

  if (!isOpen || !table) return null;

  const activeOrderId = table.currentOrderId ?? table.activeOrderId;

  const handleLookupCustomer = async () => {
    if (!customerPhone.trim()) return;
    setIsSearchingCustomer(true);
    try {
      const found = await posService.lookupCustomer(customerPhone.trim());
      if (found) {
        setCustomer(found);
        setPointsToUse(Math.min(found.loyaltyPoints, Math.floor(subtotal / 100)));
      } else {
        setCustomer(null);
      }
    } finally {
      setIsSearchingCustomer(false);
    }
  };

  const handleApplyVoucher = async () => {
    const code = voucherCode.trim().toUpperCase();
    if (!code) return;
    setIsCheckingVoucher(true);
    setVoucherError(null);
    try {
      if (activeOrderId) {
        try {
          const updated = await posService.applyOrderVoucher(activeOrderId, code);
          setAppliedVoucher({
            code: updated.voucherCode || code,
            discountAmount: Number(updated.discountAmount ?? 0),
          });
          return;
        } catch (orderErr: any) {
          if (orderErr?.response?.status !== 404) {
            setVoucherError(getErrorMessage(orderErr));
            return;
          }
        }
      }
      const res = await posService.applyVoucher(code, subtotal);
      if (res.valid) {
        setAppliedVoucher({
          code,
          discountAmount: res.discountAmount,
        });
      } else {
        setVoucherError(res.message || 'Mã ưu đãi không hợp lệ.');
      }
    } finally {
      setIsCheckingVoucher(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (paymentMethod === 'CASH' && !isCashSufficient) {
      setPaymentError('Số tiền khách đưa chưa đủ để thanh toán.');
      return;
    }

    setIsSubmitting(true);
    setPaymentError(null);
    try {
      const pointsEarned = customer ? Math.floor(finalTotal / 10000) : 0;
      const newTotalPts = customer
        ? customer.loyaltyPoints + pointsEarned - (usePoints ? pointsToUse : 0)
        : undefined;

      let orderNumber = `ORD-${table.tableNumber}-${Date.now().toString().slice(-6)}`;
      let serverChangeAmount = changeAmount;

      if (paymentMethod === 'CASH' && activeOrderId) {
        const res = await posService.confirmCashPayment({
          orderId: activeOrderId,
          amountGiven,
          customerPhone: customer?.phoneNumber,
        });
        orderNumber = res.orderNumber || orderNumber;
        serverChangeAmount = res.changeAmount ?? changeAmount;
      }

      window.dispatchEvent(new CustomEvent('pos-shift-updated'));

      const receipt: PosReceiptData = {
        orderNumber,
        tableId: table.tableId,
        tableName: table.tableNumber,
        cashierName: currentUser?.fullName || 'Thu ngân',
        createdAt: new Date().toLocaleString('vi-VN'),
        customerName: customer?.fullName,
        customerPhone: customer?.phoneNumber,
        membershipTier: customer?.membershipTier,
        items: orderItems,
        subtotal,
        voucherCode: appliedVoucher?.code,
        discountAmount: appliedVoucher?.discountAmount,
        pointsDiscount: pointsDiscountValue,
        taxAmount: actualTax,
        totalAmount: finalTotal,
        paidAmount: paymentMethod === 'CASH' ? roundedBill : finalTotal,
        remainingAmount: 0,
        paymentMethod,
        amountGiven: paymentMethod === 'CASH' ? amountGiven : finalTotal,
        changeAmount: paymentMethod === 'CASH' ? serverChangeAmount : 0,
        rawChangeAmount: paymentMethod === 'CASH' ? rawChangeAmount : 0,
        pointsEarned: customer && pointsEarned > 0 ? pointsEarned : undefined,
        newTotalPoints: newTotalPts,
      };

      onPaymentSuccess(receipt);
    } catch (err) {
      setPaymentError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickCashOptions = [
    { label: 'Đúng số tiền', value: roundedBill },
    { label: '100.000đ', value: 100000 },
    { label: '200.000đ', value: 200000 },
    { label: '500.000đ', value: 500000 },
    { label: '1.000.000đ', value: 1000000 },
    { label: '2.000.000đ', value: 2000000 },
    { label: '5.000.000đ', value: 5000000 },
  ].filter((opt) => opt.value >= roundedBill || opt.label === 'Đúng số tiền');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-4xl bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-950 flex items-center gap-2">
                Thanh Toán Hóa Đơn • {table.tableNumber}
              </h2>
              <p className="text-xs text-slate-500">
                Khu vực: {table.areaName} • Khách: {table.guestCount || 2} người
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng thanh toán"
            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6 bg-slate-50">
          {/* Left Column */}
          <div className="md:col-span-5 space-y-4">
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 mb-3">
                Chi tiết thực đơn ({orderItems.length} món)
              </h3>
              <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 pr-1 text-xs space-y-2">
                {orderItems.map((item, idx) => (
                  <div key={idx} className="pt-2 first:pt-0 flex justify-between items-start">
                    <div className="flex-1 pr-2">
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      {item.modifiers && (
                        <p className="text-[11px] text-slate-500 italic">+ {item.modifiers}</p>
                      )}
                      <p className="text-[11px] text-slate-500">
                        {formatVND(item.price)} x {item.quantity}
                      </p>
                    </div>
                    <span className="font-bold text-slate-900">{formatVND(item.total)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between text-xs text-slate-600">
                <span>Tổng tiền món:</span>
                <span className="font-bold text-slate-950">{formatVND(subtotal)}</span>
              </div>
            </div>

            {/* Voucher input */}
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-800 mb-2 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-600" />
                <span>Mã Ưu Đãi / Voucher</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nhập mã voucher..."
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                  className="flex-1 bg-white border border-slate-300 focus:border-emerald-600 rounded-lg px-3 py-2 text-xs uppercase tracking-wider text-slate-900 outline-none"
                />
                <button
                  type="button"
                  onClick={() => void handleApplyVoucher()}
                  disabled={isCheckingVoucher || !voucherCode.trim()}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 transition-colors"
                >
                  {isCheckingVoucher ? 'Kiểm tra...' : 'Áp Dụng'}
                </button>
              </div>
              {appliedVoucher && (
                <div className="mt-2 text-xs text-emerald-800 flex items-center justify-between bg-emerald-50 border border-emerald-200 p-2 rounded-lg">
                  <span>Mã {appliedVoucher.code} đã áp dụng:</span>
                  <span className="font-bold">-{formatVND(appliedVoucher.discountAmount)}</span>
                </div>
              )}
              {voucherError && (
                <p className="mt-1.5 text-[11px] text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {voucherError}
                </p>
              )}
            </div>

            {/* Customer & Loyalty Points */}
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-800 mb-2 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Hội Viên & Tích Điểm</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nhập SĐT khách hàng..."
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="flex-1 bg-white border border-slate-300 focus:border-emerald-600 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none"
                />
                <button
                  type="button"
                  onClick={() => void handleLookupCustomer()}
                  disabled={isSearchingCustomer || !customerPhone.trim()}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold disabled:opacity-50 transition-colors"
                >
                  {isSearchingCustomer ? 'Tìm...' : 'Tra Cứu'}
                </button>
              </div>

              {customer && (
                <div className="mt-3 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-950">{customer.fullName}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">
                      {customer.membershipTier}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600 text-[11px]">
                    <span>Điểm khả dụng:</span>
                    <span className="font-semibold text-emerald-700">{customer.loyaltyPoints} pts</span>
                  </div>
                  {customer.loyaltyPoints > 0 && (
                    <div className="pt-2 border-t border-slate-200">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={usePoints}
                          onChange={(e) => setUsePoints(e.target.checked)}
                          className="rounded border-slate-300 text-emerald-600"
                        />
                        <span className="text-[11px] text-slate-700">
                          Dùng {pointsToUse} điểm để giảm {formatVND(pointsDiscountValue)}
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="md:col-span-7 flex flex-col justify-between space-y-4">
            {paymentError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{paymentError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod('CASH')}
                className={`p-3.5 rounded-xl border flex items-center justify-center gap-2.5 font-bold text-sm transition-colors ${
                  paymentMethod === 'CASH'
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Banknote className="w-5 h-5" />
                <span>Tiền Mặt (Cash)</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('VIETQR')}
                className={`p-3.5 rounded-xl border flex items-center justify-center gap-2.5 font-bold text-sm transition-colors ${
                  paymentMethod === 'VIETQR'
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <QrCode className="w-5 h-5" />
                <span>Chuyển Khoản (VietQR)</span>
              </button>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Tổng tiền món:</span>
                <span>{formatVND(subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Thuế GTGT (VAT 8%):</span>
                <span>+{formatVND(actualTax)}</span>
              </div>
              {voucherDiscount > 0 && (
                <div className="flex justify-between text-xs text-emerald-700 font-medium">
                  <span>Giảm giá Voucher:</span>
                  <span>-{formatVND(voucherDiscount)}</span>
                </div>
              )}
              {pointsDiscountValue > 0 && (
                <div className="flex justify-between text-xs text-emerald-700 font-medium">
                  <span>Giảm trừ điểm thành viên:</span>
                  <span>-{formatVND(pointsDiscountValue)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                <span className="font-extrabold text-sm uppercase text-slate-900">
                  Số Tiền Cần Thanh Toán:
                </span>
                <span className="text-2xl font-black text-red-600 font-mono">
                  {formatVND(finalTotal)}
                </span>
              </div>
            </div>

            {table && (orderItems.length === 0 || finalTotal === 0) && onCancelEmptyTable && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between gap-3">
                <span className="text-xs text-amber-900 font-medium">Bàn này chưa phát sinh tiền món (0đ).</span>
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm(`Xác nhận hủy phiên phục vụ bàn ${table.tableNumber} (khách không dùng món và trả lại bàn)?`)) {
                      await onCancelEmptyTable(table.tableId);
                      onClose();
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition-colors shadow-sm"
                >
                  Hủy Bàn Khách Rời Đi (0đ)
                </button>
              </div>
            )}

            {paymentMethod === 'CASH' && (
              <div className="space-y-4 bg-white p-4 rounded-xl border border-slate-200">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Tiền Khách Đưa (VNĐ)
                    </label>
                    <span className="text-xs text-slate-500">Nhập số tiền hoặc chọn nhanh</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step={1000}
                      value={amountGiven || ''}
                      onChange={(e) => setAmountGiven(Number(e.target.value) || 0)}
                      className="w-full bg-white border border-slate-300 focus:border-emerald-600 rounded-xl px-4 py-3 text-xl font-bold text-slate-950 outline-none"
                    />
                    <span className="absolute right-4 top-3.5 text-xs text-slate-400 font-mono">VND</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {quickCashOptions.map((opt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setAmountGiven(opt.value)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                        amountGiven === opt.value
                          ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div
                  className={`p-4 rounded-xl border flex items-center justify-between ${
                    isCashSufficient
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-red-50 border-red-200 text-red-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-white ${
                        isCashSufficient ? 'bg-emerald-600' : 'bg-red-600'
                      }`}
                    >
                      <Calculator className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs uppercase font-bold tracking-wider">
                        {isCashSufficient ? 'Tiền Thối Lại Cho Khách' : 'Khách Đưa Chưa Đủ'}
                      </p>
                      <p className="text-[11px] opacity-80">
                        {isCashSufficient
                          ? `(Khách đưa ${formatVND(amountGiven)} - Cần thanh toán ${formatVND(finalTotal)})`
                          : `Còn thiếu ${formatVND(roundedBill - amountGiven)}`}
                      </p>
                      {isCashSufficient && changeRoundingDiff !== 0 && (
                        <p className="text-[11px] font-semibold text-amber-700">
                          Thực tế {formatVND(rawChangeAmount)} → làm tròn{' '}
                          {changeRoundingDiff > 0 ? 'lên' : 'xuống'} {formatVND(Math.abs(changeRoundingDiff))}
                          {billRoundingDiff !== 0 && (
                            <span className="text-[10px] block opacity-90">
                              (Hóa đơn {formatVND(finalTotal)} làm tròn {billRoundingDiff < 0 ? 'xuống' : 'lên'}{' '}
                              {formatVND(roundedBill)})
                            </span>
                          )}
                        </p>
                      )}
                      {isCashSufficient && (
                        <p className="text-[10px] opacity-70">
                          Hóa đơn lẻ ≤ 700đ làm tròn xuống, &gt; 700đ làm tròn lên (bội số 1.000đ)
                        </p>
                      )}
                    </div>
                  </div>
                  <p className={`text-2xl font-black font-mono ${isCashSufficient ? 'text-emerald-700' : 'text-red-700'}`}>
                    {formatVND(changeAmount)}
                  </p>
                </div>
              </div>
            )}

            {paymentMethod === 'VIETQR' && (
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col items-center justify-center text-center space-y-3">
                {isLoadingQr ? (
                  <div className="py-10 text-xs text-slate-500">Đang khởi tạo mã VietQR NAPAS 247...</div>
                ) : vietQr ? (
                  <>
                    <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200 inline-block">
                      <img
                        src={vietQr.qrImageUrl || vietQr.qrDataUrl}
                        alt="VietQR Payment"
                        className="w-48 h-48 object-contain rounded-lg"
                      />
                    </div>
                    <div className="space-y-1 text-xs">
                      <p className="font-bold text-slate-900 uppercase">{vietQr.accountName}</p>
                      <p className="text-slate-600">
                        STK: <span className="text-slate-950 font-mono font-bold">{vietQr.accountNumber}</span>
                      </p>
                      <p className="text-slate-600">
                        Nội dung: <span className="font-mono font-bold text-emerald-700">{vietQr.description}</span>
                      </p>
                      <p className="text-emerald-700 font-bold pt-1">
                        Số tiền: {formatVND(vietQr.amount)}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="py-8 text-xs text-red-600">
                    Không thể tạo mã VietQR cho đơn hàng này. Vui lòng kiểm tra kết nối máy chủ.
                  </div>
                )}
              </div>
            )}

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => void handleConfirmPayment()}
                disabled={isSubmitting || (paymentMethod === 'CASH' && !isCashSufficient)}
                className="flex-1 py-3.5 px-6 rounded-xl font-bold text-sm text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2 transition-colors"
              >
                <Check className="w-5 h-5" />
                <span>
                  {isSubmitting
                    ? 'Đang xử lý...'
                    : paymentMethod === 'CASH'
                    ? 'Xác Nhận Thu Tiền & In Hóa Đơn'
                    : 'Xác Nhận Đã Nhận Chuyển Khoản & In Hóa Đơn'}
                </span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="py-3.5 px-5 rounded-xl text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800 transition-colors"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
