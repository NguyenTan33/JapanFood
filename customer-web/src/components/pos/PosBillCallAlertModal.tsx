import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CreditCard, Bell, X, CheckCircle2, Clock } from 'lucide-react';
import { posService, TableAlert } from '@/services/posService';
import { formatVND } from '@/utils/dateUtils';
import { useTableAlertPolling, playAlertChime } from '@/hooks/useTableAlertPolling';

interface PosBillCallAlertModalProps {
  onOpenCheckoutForTable?: (tableId: number, tableNumber: string) => void;
}

export const PosBillCallAlertModal: React.FC<PosBillCallAlertModalProps> = ({
  onOpenCheckoutForTable,
}) => {
  const [queue, setQueue] = useState<TableAlert[]>([]);
  const [currentAlert, setCurrentAlert] = useState<TableAlert | null>(null);

  // Polling table-alerts từ server (BILL_CALL)
  useTableAlertPolling('BILL_CALL', true, 3000);

  // Kiểm tra ban đầu khi vừa vào trang xem có yêu cầu nào chưa xử lý không
  const checkPending = useCallback(async () => {
    try {
      const pending = await posService.getPendingBillCalls();
      if (pending && pending.length > 0) {
        setQueue((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          const newItems = pending.filter((p) => !ids.has(p.id));
          return [...prev, ...newItems];
        });
      }
    } catch {
      // bỏ qua
    }
  }, []);

  useEffect(() => {
    void checkPending();
    const interval = setInterval(() => void checkPending(), 10000);
    return () => clearInterval(interval);
  }, [checkPending]);

  // Lắng nghe sự kiện bill call được phát từ polling
  useEffect(() => {
    const handleBillCall = (e: any) => {
      const detail = e.detail;
      if (!detail?.tableId) return;

      const alertItem: TableAlert = {
        id: detail.id || Date.now(),
        type: 'BILL_CALL',
        tableId: detail.tableId,
        tableNumber: detail.tableNumber || `Bàn #${detail.tableId}`,
        totalAmount: Number(detail.totalAmount || 0),
        note: detail.note,
        createdAt: new Date().toISOString(),
        isAcknowledged: false,
      };

      setQueue((prev) => {
        if (prev.some((p) => p.id === alertItem.id || p.tableId === alertItem.tableId)) {
          return prev;
        }
        return [...prev, alertItem];
      });

      playAlertChime(4);
    };

    window.addEventListener('torisakura_bill_call', handleBillCall);
    return () => window.removeEventListener('torisakura_bill_call', handleBillCall);
  }, []);

  // Đưa phần tử đầu hàng đợi ra làm alert hiện tại
  useEffect(() => {
    if (!currentAlert && queue.length > 0) {
      setCurrentAlert(queue[0]);
      setQueue((prev) => prev.slice(1));
    }
  }, [currentAlert, queue]);

  if (!currentAlert || typeof document === 'undefined') return null;

  const handleAcknowledgeAndClose = async () => {
    const alertId = currentAlert.id;
    setCurrentAlert(null);
    try {
      await posService.acknowledgeTableAlert(alertId);
    } catch {
      // ignore
    }
  };

  const handleGoToCheckout = async () => {
    const targetTableId = currentAlert.tableId;
    const targetTableNumber = currentAlert.tableNumber;
    await handleAcknowledgeAndClose();
    if (onOpenCheckoutForTable) {
      onOpenCheckoutForTable(targetTableId, targetTableNumber);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in"
      onClick={handleAcknowledgeAndClose}
    >
      <div
        className="relative w-full max-w-md bg-white text-slate-900 rounded-2xl shadow-2xl border-2 border-red-500 overflow-hidden transform transition-all animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Alert Ribbon */}
        <div className="bg-red-600 text-white px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-200 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-white"></span>
            </span>
            <div className="flex items-center gap-1.5 font-black text-xs uppercase tracking-wider">
              <Bell className="w-4 h-4 animate-bounce" />
              <span>YÊU CẦU TÍNH TIỀN TẠI BÀN</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAcknowledgeAndClose}
            aria-label="Đóng thông báo"
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-red-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl p-4">
            <div>
              <p className="text-xs text-red-700 font-bold uppercase tracking-wider">Bàn Yêu Cầu</p>
              <h3 className="text-3xl font-black text-slate-950 mt-0.5 tracking-tight font-mono">
                {currentAlert.tableNumber}
              </h3>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Tạm Tính Đơn</p>
              <p className="text-2xl font-black text-emerald-700 font-mono mt-0.5">
                {formatVND(currentAlert.totalAmount)}
              </p>
            </div>
          </div>

          <div className="space-y-1.5 text-xs text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              <span>
                Thời gian yêu cầu:{' '}
                <strong className="text-slate-800">
                  {new Date().toLocaleTimeString('vi-VN')}
                </strong>
              </span>
            </div>
            <p className="text-[12px] text-slate-600 italic pt-1 border-t border-slate-200">
              🔔 Khách ngồi tại bàn vừa nhấn nút{' '}
              <strong className="text-red-700 font-bold">"Gọi Tính Tiền"</strong>. Quý thu ngân vui
              lòng đến bàn mang hóa đơn hoặc hỗ trợ khách thanh toán.
            </p>
          </div>

          {queue.length > 0 && (
            <p className="text-[11px] text-amber-700 font-bold text-center">
              ⚠️ Còn {queue.length} yêu cầu tính tiền khác đang chờ trong hàng đợi.
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleGoToCheckout}
              className="w-full flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transition-all"
            >
              <CreditCard className="w-4 h-4" />
              <span>Đến Thanh Toán Ngay</span>
            </button>
            <button
              type="button"
              onClick={handleAcknowledgeAndClose}
              className="w-full sm:w-auto py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 flex items-center justify-center gap-1.5 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Đã Biết</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
