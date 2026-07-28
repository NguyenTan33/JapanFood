import React, { useState, useEffect, useRef } from 'react';
import { X, Users, MessageSquare, Utensils, Check, AlertCircle } from 'lucide-react';
import { PosTable } from '@/services/posService';
import { getErrorMessage } from '@/services/apiClient';

interface PosOpenTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: PosTable | null;
  onConfirm: (guestCount: number, notes?: string) => Promise<void>;
}

export const PosOpenTableModal: React.FC<PosOpenTableModalProps> = ({
  isOpen,
  onClose,
  table,
  onConfirm,
}) => {
  const maxCapacity = table?.capacity || 2;
  const defaultGuests = Math.min(maxCapacity, Math.max(1, table?.minCapacity || 1));

  const [guestCount, setGuestCount] = useState<number>(defaultGuests);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [guestInput, setGuestInput] = useState<string>(String(defaultGuests));
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const tableId = table?.tableId;

  // Reset form ONLY when modal opens or a different table is chosen
  // (not on every parent re-render / polling refresh)
  useEffect(() => {
    if (isOpen && tableId != null) {
      const initial = Math.min(maxCapacity, Math.max(1, table?.minCapacity || 1));
      setGuestCount(initial);
      setGuestInput(String(initial));
      setNotes('');
      setErrorMsg(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, tableId, maxCapacity]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Sinh các nút chọn nhanh không vượt quá sức chứa tối đa của bàn
  const quickGuestOptions = React.useMemo(() => {
    if (!table) return [1, 2];
    const max = Math.max(1, table.capacity || 2);
    if (max <= 5) {
      return Array.from({ length: max }, (_, i) => i + 1);
    }
    const standard = [1, 2, 4, 6, 8, 10, 12, 16];
    const filtered = standard.filter((n) => n <= max);
    if (!filtered.includes(max)) {
      filtered.push(max);
      filtered.sort((a, b) => a - b);
    }
    return filtered;
  }, [table]);

  const selectGuests = (num: number) => {
    if (!table) return;
    const clamped = Math.max(1, Math.min(num, table.capacity));
    setGuestCount(clamped);
    setGuestInput(String(clamped));
    setErrorMsg(null);
  };

  if (!isOpen || !table) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!table) return;

    if (guestCount < 1) {
      setErrorMsg('Số lượng khách phải lớn hơn hoặc bằng 1.');
      return;
    }

    if (guestCount > table.capacity) {
      setErrorMsg(`Bàn ${table.tableNumber} chỉ chứa tối đa ${table.capacity} khách. Vui lòng chọn số lượng phù hợp.`);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onConfirm(guestCount, notes.trim() || undefined);
      onClose();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-950">
                Mở Phục Vụ • {table.tableNumber}
              </h2>
              <p className="text-xs text-slate-500">
                {table.areaName} • Sức chứa: {table.capacity} người
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại mở bàn"
            className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>Số Lượng Khách</span>
              </label>
              <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                Tối đa: <strong className="text-emerald-700 font-bold">{table.capacity}</strong> khách
              </span>
            </div>
            <div className="flex items-center gap-2">
              {quickGuestOptions.map((num) => (
                <button
                  type="button"
                  key={num}
                  onClick={() => selectGuests(num)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-colors ${
                    guestCount === num
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
            <div className="mt-2">
              <input
                type="number"
                min={1}
                max={table.capacity}
                value={guestInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  setGuestInput(raw);
                  const n = parseInt(raw, 10);
                  if (!Number.isNaN(n)) {
                    if (n > table.capacity) {
                      setGuestCount(table.capacity);
                      setErrorMsg(`Số khách không được vượt quá sức chứa tối đa của bàn (${table.capacity} khách).`);
                    } else if (n >= 1) {
                      setGuestCount(n);
                      setErrorMsg(null);
                    }
                  }
                }}
                onBlur={() => {
                  const n = parseInt(guestInput, 10);
                  if (Number.isNaN(n) || n < 1) {
                    setGuestCount(1);
                    setGuestInput('1');
                    setErrorMsg(null);
                  } else if (n > table.capacity) {
                    setGuestCount(table.capacity);
                    setGuestInput(String(table.capacity));
                    setErrorMsg(`Đã tự động giới hạn về tối đa ${table.capacity} khách theo sức chứa của bàn.`);
                  } else {
                    setGuestCount(n);
                    setGuestInput(String(n));
                    setErrorMsg(null);
                  }
                }}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600"
                placeholder={`Nhập số khách (1 - ${table.capacity})...`}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span>Ghi Chú Đón Khách (Nếu có)</span>
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="VD: Khách tổ chức sinh nhật, chuẩn bị nến; Khách có trẻ em..."
              className="w-full bg-white border border-slate-300 rounded-lg p-3 text-xs text-slate-900 outline-none focus:border-emerald-600"
            />
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Đang mở bàn...' : 'Xác Nhận Mở Bàn'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-4 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              Hủy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
