import React from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, CheckCircle2, FileText } from 'lucide-react';
import { formatVND } from '@/utils/dateUtils';

export interface PosReceiptData {
  orderNumber: string;
  tableId?: number;
  tableName: string;
  cashierName: string;
  createdAt: string;
  completedAt?: string | null;
  customerName?: string;
  customerPhone?: string;
  membershipTier?: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
    modifiers?: string;
  }>;
  subtotal: number;
  voucherCode?: string;
  discountAmount?: number;
  pointsDiscount?: number;
  taxAmount?: number;
  totalAmount: number;
  paidAmount?: number;
  remainingAmount?: number;
  paymentMethod: 'CASH' | 'VIETQR' | string;
  amountGiven?: number;
  changeAmount?: number;
  rawChangeAmount?: number;
  pointsEarned?: number;
  newTotalPoints?: number;
  isReprint?: boolean;
  isProvisional?: boolean;
}

/**
 * Quy tắc làm tròn hóa đơn / tiền thối (bội số 1.000đ):
 * Phần lẻ hóa đơn <= 700đ: làm tròn XUỐNG cho khách (bội số 1.000đ). VD: 22.700đ -> 22.000đ (khách đưa 30k thối 8k).
 * Phần lẻ hóa đơn > 700đ: làm tròn LÊN (bội số 1.000đ). VD: 22.701đ -> 23.000đ (khách đưa 30k thối 7k).
 */
export function roundBillAmount(rawBill: number): number {
  if (!rawBill || rawBill <= 0) return 0;
  const thousands = Math.floor(rawBill / 1000) * 1000;
  const remainder = rawBill - thousands;
  return remainder <= 700 ? thousands : thousands + 1000;
}

export function roundCashChange(rawChange: number): number {
  if (!rawChange || rawChange <= 0) return 0;
  const thousands = Math.floor(rawChange / 1000) * 1000;
  const remainder = rawChange - thousands;
  if (remainder === 0) return thousands;
  return remainder >= 300 ? thousands + 1000 : thousands;
}

interface PosReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: PosReceiptData | null;
  onCompleteTable?: (tableId: number) => Promise<void> | void;
}

export const PosReceiptModal: React.FC<PosReceiptModalProps> = ({
  isOpen,
  onClose,
  receipt,
  onCompleteTable,
}) => {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen || !receipt || typeof document === 'undefined') return null;

  const handlePrint = () => {
    window.print();
  };

  const titleText = receipt.isProvisional
    ? 'PHIẾU TẠM TÍNH'
    : receipt.isReprint
    ? 'HÓA ĐƠN THANH TOÁN (BẢN IN LẠI)'
    : 'HÓA ĐƠN THANH TOÁN';

  const paymentLabel =
    receipt.paymentMethod === 'CASH' || receipt.paymentMethod === 'Cash'
      ? 'TIỀN MẶT'
      : receipt.paymentMethod === 'VIETQR' || receipt.paymentMethod === 'FullBank'
      ? 'CHUYỂN KHOẢN (VietQR)'
      : receipt.paymentMethod || 'TIỀN MẶT';

  return createPortal(
    <div
      className="thermal-modal-backdrop fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="thermal-modal-card relative w-full max-w-md bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-300 max-h-[92vh] flex flex-col my-auto overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="no-print shrink-0 flex items-center justify-between px-5 py-3.5 bg-slate-100 border-b border-slate-200 z-10">
          <div className="flex items-center gap-2 text-emerald-700">
            {receipt.isProvisional ? (
              <FileText className="w-5 h-5" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
            <span className="font-bold text-xs uppercase tracking-wider">
              {receipt.isProvisional
                ? 'Phiếu Tạm Tính • Khổ 80mm'
                : receipt.isReprint
                ? 'In Lại Hóa Đơn • Khổ 80mm'
                : 'Thanh Toán Thành Công • Hóa Đơn 80mm'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hóa đơn"
            title="Đóng (Esc)"
            className="w-8 h-8 flex items-center justify-center bg-slate-200 hover:bg-red-500 hover:text-white text-slate-700 rounded-full transition-all shadow-sm"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 80mm Receipt Content */}
        <div
          className="p-6 font-mono text-xs leading-relaxed max-h-[75vh] overflow-y-auto bg-white text-black"
          id="printable-pos-receipt"
        >
          {/* Brand Header */}
          <div className="text-center pb-4 border-b-2 border-dashed border-slate-400">
            <h1 className="text-xl font-black uppercase tracking-wider text-black">
              SAKURA JAPAN FOOD
            </h1>
            <p className="text-[11px] text-slate-700 font-sans mt-0.5">
              15A/2 Lê Thánh Tôn, Bến Nghé, Quận 1, TP. Hồ Chí Minh
            </p>
            <p className="text-[11px] text-slate-700">Hotline: 0903 123 456 / 028 3822 8899</p>
            <div className="mt-2 text-sm font-bold uppercase tracking-wider text-black">
              {titleText}
            </div>
          </div>

          {/* Info Details */}
          <div className="py-3 border-b border-dashed border-slate-300 space-y-1 text-slate-800">
            <div className="flex justify-between">
              <span>Mã hóa đơn:</span>
              <span className="font-bold text-black">{receipt.orderNumber}</span>
            </div>
            <div className="flex justify-between font-bold text-black text-sm">
              <span>BÀN:</span>
              <span className="px-2 rounded border border-slate-400">{receipt.tableName}</span>
            </div>
            <div className="flex justify-between">
              <span>Thời gian:</span>
              <span>{receipt.completedAt || receipt.createdAt}</span>
            </div>
            <div className="flex justify-between">
              <span>Thu ngân:</span>
              <span>{receipt.cashierName}</span>
            </div>
            {receipt.customerName && (
              <div className="pt-1 mt-1 border-t border-slate-200 flex justify-between font-medium">
                <span>Khách hàng:</span>
                <span>
                  {receipt.customerName}
                  {receipt.membershipTier ? ` (${receipt.membershipTier})` : ''}
                </span>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="py-3 border-b-2 border-dashed border-slate-400">
            <div className="grid grid-cols-12 font-bold text-black pb-1.5 border-b border-slate-300 uppercase text-[11px]">
              <span className="col-span-6">Tên món</span>
              <span className="col-span-2 text-center">SL</span>
              <span className="col-span-4 text-right">T.Tiền</span>
            </div>
            <div className="divide-y divide-slate-200 py-1">
              {receipt.items.map((it, idx) => (
                <div key={idx} className="py-1.5 text-black">
                  <div className="grid grid-cols-12">
                    <span className="col-span-6 font-semibold">{it.name}</span>
                    <span className="col-span-2 text-center font-bold">x{it.quantity}</span>
                    <span className="col-span-4 text-right font-medium">{formatVND(it.total)}</span>
                  </div>
                  {it.modifiers && (
                    <p className="text-[10px] text-slate-600 italic mt-0.5 pl-2">+ {it.modifiers}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Financial Calculation */}
          <div className="py-3 border-b-2 border-dashed border-slate-400 space-y-1.5">
            <div className="flex justify-between text-slate-700">
              <span>Tổng tiền món:</span>
              <span>{formatVND(receipt.subtotal)}</span>
            </div>

            {receipt.discountAmount ? (
              <div className="flex justify-between text-emerald-800">
                <span>Voucher ({receipt.voucherCode || 'Ưu đãi'}):</span>
                <span>-{formatVND(receipt.discountAmount)}</span>
              </div>
            ) : null}

            {receipt.pointsDiscount ? (
              <div className="flex justify-between text-emerald-800">
                <span>Giảm trừ điểm tích lũy:</span>
                <span>-{formatVND(receipt.pointsDiscount)}</span>
              </div>
            ) : null}

            <div className="flex justify-between text-slate-700">
              <span>Thuế VAT (8%):</span>
              <span>+{formatVND(receipt.taxAmount ?? Math.round(receipt.subtotal * 0.08))}</span>
            </div>

            <div className="pt-2 border-t border-slate-300 flex justify-between items-baseline text-base font-black text-black">
              <span>{receipt.isProvisional ? 'TỔNG TẠM TÍNH:' : 'TỔNG THANH TOÁN:'}</span>
              <span className="text-lg">{formatVND(receipt.totalAmount)}</span>
            </div>

            {!receipt.isProvisional && (
              <div className="pt-2 mt-2 border-t border-dashed border-slate-300 text-xs space-y-1">
                <div className="flex justify-between font-bold">
                  <span>Hình thức:</span>
                  <span>{paymentLabel}</span>
                </div>

                {typeof receipt.paidAmount === 'number' && receipt.paidAmount > 0 && (
                  <div className="flex justify-between text-slate-800">
                    <span>Đã thanh toán:</span>
                    <span className="font-semibold">{formatVND(receipt.paidAmount)}</span>
                  </div>
                )}

                {typeof receipt.remainingAmount === 'number' && receipt.remainingAmount > 0 && (
                  <div className="flex justify-between font-bold text-red-700">
                    <span>Còn lại cần thu:</span>
                    <span>{formatVND(receipt.remainingAmount)}</span>
                  </div>
                )}

                {(receipt.paymentMethod === 'CASH' || receipt.paymentMethod === 'Cash') && (
                  <>
                    <div className="flex justify-between text-slate-800">
                      <span>Tiền khách đưa:</span>
                      <span className="font-semibold">
                        {formatVND(receipt.amountGiven ?? receipt.totalAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold bg-slate-100 px-2 py-1 rounded border border-slate-300">
                      <span>TIỀN THỐI LẠI:</span>
                      <span>{formatVND(receipt.changeAmount || 0)}</span>
                    </div>
                    {typeof receipt.rawChangeAmount === 'number' &&
                      receipt.rawChangeAmount !== (receipt.changeAmount || 0) && (
                        <div className="flex justify-between text-[10px] text-slate-600">
                          <span>(Thối thực tế {formatVND(receipt.rawChangeAmount)})</span>
                          <span>
                            Làm tròn {(receipt.changeAmount || 0) > receipt.rawChangeAmount ? '+' : '-'}
                            {formatVND(Math.abs((receipt.changeAmount || 0) - receipt.rawChangeAmount))}
                          </span>
                        </div>
                      )}
                    <p className="text-[10px] italic text-slate-600 leading-snug pt-0.5">
                      * Quy tắc làm tròn hóa đơn (bội số 1.000đ): Hóa đơn lẻ ≤ 700đ làm tròn xuống, &gt; 700đ làm tròn lên. VD: 22.700đ làm tròn 22.000đ (đưa 30k thối 8k); 22.701đ làm tròn 23.000đ (đưa 30k thối 7k).
                    </p>
                  </>
                )}
              </div>
            )}

            {Boolean(receipt.customerName && receipt.pointsEarned && receipt.pointsEarned > 0) && (
              <div className="pt-2 border-t border-slate-200 flex justify-between text-[11px] font-medium">
                <span>Tích lũy điểm lượt này:</span>
                <span className="font-bold">
                  +{receipt.pointsEarned} pts
                  {typeof receipt.newTotalPoints === 'number'
                    ? ` (Tổng: ${receipt.newTotalPoints} pts)`
                    : ''}
                </span>
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="pt-4 text-center font-sans text-xs text-slate-700 space-y-1">
            <p className="font-semibold text-black">CẢM ƠN QUÝ KHÁCH - HẸN GẶP LẠI!</p>
            <p className="italic text-[11px]">Arigatou Gozaimasu! (ありがとうございます)</p>
            <p className="text-[10px] text-slate-500 mt-1">Wifi: Sakura_Guest • Pass: sakura8888</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="no-print flex items-center gap-3 p-4 bg-slate-50 border-t border-slate-200">
          {!receipt.isProvisional && receipt.tableId && onCompleteTable ? (
            /* After real payment: single button that prints AND completes table */
            <button
              type="button"
              onClick={async () => {
                window.print();
                await onCompleteTable(receipt.tableId!);
                onClose();
              }}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-sm transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>In & Hoàn Tất Giải Phóng Bàn</span>
            </button>
          ) : (
            /* Provisional / reprint: just print button */
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-sm transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>{receipt.isProvisional ? 'In Phiếu Tạm Tính' : 'In Hóa Đơn (Máy In Nhiệt)'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="py-3 px-5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl text-sm transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
