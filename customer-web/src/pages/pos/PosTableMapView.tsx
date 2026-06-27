import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Utensils,
  RefreshCw,
  Plus,
  Clock,
  CreditCard,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Users,
  X,
  QrCode,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { posService, PosTable, PosArea } from '@/services/posService';
import { shiftService } from '@/services/shiftService';
import { getErrorMessage } from '@/services/apiClient';
import { formatVND } from '@/utils/dateUtils';
import { PosOpenTableModal } from '@/components/pos/PosOpenTableModal';
import { PosTableDetailModal } from '@/components/pos/PosTableDetailModal';
import { PosCheckoutModal } from '@/components/pos/PosCheckoutModal';
import { PosReceiptModal, PosReceiptData } from '@/components/pos/PosReceiptModal';
import { PosTableQrSlipModal } from '@/components/pos/PosTableQrSlipModal';

interface CheckoutOrderState {
  table: PosTable;
  subtotal: number;
  taxAmount?: number;
  totalAmount?: number;
  items: Array<{
    id: number;
    name: string;
    quantity: number;
    price: number;
    total: number;
    modifiers?: string;
  }>;
}

function deriveAreaFloorLabel(area: PosArea): string {
  if (area.floor && area.floor.trim()) return area.floor.trim();
  const text = `${area.code} ${area.name}`.toLowerCase();
  if (text.includes('vip') || text.includes('tatami') || text.includes('lầu') || text.includes('tầng 2')) {
    return 'Tầng 2 / Phòng Riêng & VIP';
  }
  if (text.includes('sân') || text.includes('vườn') || text.includes('garden')) {
    return 'Khu Ngoài Trời';
  }
  return 'Tầng 1 / Sảnh Chính';
}

function parseUtcDate(dateStr?: string | null): number {
  if (!dateStr) return 0;
  const raw = String(dateStr).trim();
  const normalized = raw.endsWith('Z') || raw.includes('+') ? raw : `${raw}Z`;
  let time = new Date(normalized).getTime();
  if (Number.isNaN(time)) {
    time = new Date(raw).getTime();
  }
  return Number.isNaN(time) ? 0 : time;
}

function formatElapsedHms(openedAt?: string | null, nowMs = Date.now()): string {
  if (!openedAt) return '00:00:00';
  const start = parseUtcDate(openedAt);
  if (!start) return '00:00:00';
  let diffSec = Math.floor((nowMs - start) / 1000);
  if (diffSec < 0) {
    const rawLocal = new Date(String(openedAt).replace('Z', '')).getTime();
    if (!Number.isNaN(rawLocal)) {
      const localDiff = Math.floor((nowMs - rawLocal) / 1000);
      diffSec = localDiff >= 0 ? localDiff : 0;
    } else {
      diffSec = 0;
    }
  }
  const hrs = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const PosTableMapView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tables, setTables] = useState<PosTable[]>([]);
  const [areas, setAreas] = useState<PosArea[]>([]);
  const [hasOpenShift, setHasOpenShift] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [callingBillTableIds, setCallingBillTableIds] = useState<Record<number, boolean>>({});

  // Filters
  const [searchTable, setSearchTable] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('ALL');
  const [selectedAreaId, setSelectedAreaId] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Modals & session tokens
  const [openTableTarget, setOpenTableTarget] = useState<PosTable | null>(null);
  const [detailTableTarget, setDetailTableTarget] = useState<PosTable | null>(null);
  const [checkoutOrderState, setCheckoutOrderState] = useState<CheckoutOrderState | null>(null);
  const [isLoadingCheckoutId, setIsLoadingCheckoutId] = useState<number | null>(null);
  const [receiptData, setReceiptData] = useState<PosReceiptData | null>(null);
  const [qrSlipTableTarget, setQrSlipTableTarget] = useState<PosTable | null>(null);
  const [tableSessionTokens, setTableSessionTokens] = useState<Record<number, string>>({});
  const [tablePins, setTablePins] = useState<Record<number, string>>({});

  const handleRegeneratePin = async (tbl: PosTable, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Bạn có chắc chắn muốn ĐỔI MÃ PIN cho bàn ${tbl.tableNumber}? Các phiên quét mã QR cũ sẽ bị vô hiệu hóa ngay lập tức.`)) return;
    try {
      const res = await posService.regenerateTablePin(tbl.tableId);
      setTablePins((prev) => ({ ...prev, [tbl.tableId]: res.newPinCode }));
      setTableSessionTokens((prev) => ({ ...prev, [tbl.tableId]: res.sessionToken }));
      addNotification('ĐỔI MÃ PIN THÀNH CÔNG', `Bàn ${tbl.tableNumber}: Mã PIN mới là ${res.newPinCode}`);
    } catch (err) {
      addNotification('LỖI ĐỔI PIN', getErrorMessage(err), 'warning');
    }
  };

  // Floating toast notifications
  const [notifications, setNotifications] = useState<
    Array<{ id: number; title: string; message: string; variant?: 'success' | 'warning' }>
  >([]);

  const addNotification = useCallback(
    (title: string, message: string, variant: 'success' | 'warning' = 'success') => {
      const notif = { id: Date.now() + Math.floor(Math.random() * 1000), title, message, variant };
      setNotifications((prev) => [notif, ...prev.slice(0, 2)]);
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
      }, 7000);
    },
    []
  );

  // Live 1s timer for occupied tables (only ticks when at least 1 table is Serving & tab is visible)
  const hasServingTables = useMemo(() => tables.some((t) => t.status === 'Serving'), [tables]);
  useEffect(() => {
    if (!hasServingTables) return;
    const timer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        setNowMs(Date.now());
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [hasServingTables]);

  // Listen to customer QR table buzz / bill call events
  useEffect(() => {
    const handleKitchenBuzz = (e: any) => {
      const detail = e.detail;
      addNotification('KHÁCH GIỤC MÓN', `${detail.tableNumber} vừa giục món: "${detail.note}"`, 'warning');
    };
    const handleBillCall = (e: any) => {
      const detail = e.detail;
      if (detail?.tableId) {
        setCallingBillTableIds((prev) => ({ ...prev, [detail.tableId]: true }));
      }
      addNotification(
        'YÊU CẦU THANH TOÁN',
        `${detail.tableNumber} yêu cầu thanh toán hóa đơn (${formatVND(detail.totalAmount)})`,
        'warning'
      );
    };

    window.addEventListener('torisakura_kitchen_buzz', handleKitchenBuzz);
    window.addEventListener('torisakura_bill_call', handleBillCall);
    return () => {
      window.removeEventListener('torisakura_kitchen_buzz', handleKitchenBuzz);
      window.removeEventListener('torisakura_bill_call', handleBillCall);
    };
  }, [addNotification]);

  // Handle openCheckout from URL param (khi thu ngân bấm "Đến Thanh Toán Ngay" từ popup)
  useEffect(() => {
    const openCheckoutId = searchParams.get('openCheckout');
    if (openCheckoutId && tables.length > 0) {
      const id = Number(openCheckoutId);
      const tbl = tables.find((t) => t.tableId === id);
      if (tbl) {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete('openCheckout');
            return next;
          },
          { replace: true }
        );
        void handleOpenCheckoutForTable(tbl);
      }
    }
  }, [searchParams, tables, setSearchParams]);

  const fetchTablesAndShift = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setFetchError(null);
    try {
      const [areaRes, tableRes, shiftRes] = await Promise.all([
        posService.getAreas(),
        posService.getTables(),
        shiftService.getCurrentShift().catch(() => ({ hasOpenShift: false, shift: null })),
      ]);
      setAreas(areaRes);
      setTables(tableRes);
      setHasOpenShift(shiftRes.hasOpenShift);
    } catch (err) {
      const msg = getErrorMessage(err);
      setFetchError(msg);
      if (!silent) {
        addNotification('LỖI TẢI DỮ LIỆU', msg, 'warning');
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    void fetchTablesAndShift(false);
    const poll = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void fetchTablesAndShift(true);
      }
    }, 15000);
    return () => clearInterval(poll);
  }, [fetchTablesAndShift]);

  // Floor options derived dynamically from API areas so filter is always truthful
  const areaFloorMap = useMemo(() => {
    const map = new Map<number, string>();
    areas.forEach((a) => {
      map.set(a.areaId, deriveAreaFloorLabel(a));
    });
    return map;
  }, [areas]);

  const floorOptions = useMemo(() => {
    return Array.from(new Set(areas.map((a) => deriveAreaFloorLabel(a))));
  }, [areas]);

  // KPI metrics
  const totalTables = tables.length;
  const servingCount = tables.filter((t) => t.status === 'Serving').length;
  const emptyCount = tables.filter((t) => t.status === 'Empty').length;
  const reservedCount = tables.filter((t) => t.status === 'Reserved').length;
  const cleaningCount = tables.filter((t) => t.status === 'Cleaning').length;
  const totalLiveSubtotal = tables
    .filter((t) => t.status === 'Serving')
    .reduce((acc, curr) => acc + Number(curr.totalAmount ?? curr.currentTotal ?? 0), 0);

  // Open-Shift Gate before opening table (R4)
  const handleRequestOpenTable = async (tbl: PosTable) => {
    try {
      const shiftRes = await shiftService.getCurrentShift();
      setHasOpenShift(shiftRes.hasOpenShift);
      if (!shiftRes.hasOpenShift) {
        addNotification(
          'CHƯA MỞ CA TRỰC',
          '⚠️ CHƯA MỞ CA TRỰC! Vui lòng mở ca trước khi mở bàn phục vụ khách.',
          'warning'
        );
        navigate('/pos/shifts');
        return;
      }
      setOpenTableTarget(tbl);
    } catch (err) {
      addNotification('LỖI KIỂM TRA CA TRỰC', getErrorMessage(err), 'warning');
    }
  };

  const handleConfirmOpenTable = async (guestCount: number, notes?: string) => {
    if (!openTableTarget) return;
    const response = await posService.openTable(openTableTarget.tableId, guestCount, notes);
    if (response.sessionToken) {
      setTableSessionTokens((prev) => ({
        ...prev,
        [openTableTarget.tableId]: response.sessionToken,
      }));
    }
    if (response.pinCode) {
      setTablePins((prev) => ({
        ...prev,
        [openTableTarget.tableId]: response.pinCode,
      }));
    }
    const updatedTable: PosTable = {
      ...openTableTarget,
      status: 'Serving',
      currentOrderId: response.orderId,
      activeOrderId: response.orderId,
      openedAt: response.openedAt
        ? (response.openedAt.endsWith('Z') || response.openedAt.includes('+') ? response.openedAt : `${response.openedAt}Z`)
        : new Date().toISOString(),
      guestCount,
      totalAmount: 0,
      currentTotal: 0,
    };
    addNotification('MỞ BÀN THÀNH CÔNG', `Đã mở ${openTableTarget.tableNumber} (${guestCount} khách).`);
    setOpenTableTarget(null);
    await fetchTablesAndShift(true);
    setQrSlipTableTarget(updatedTable);
  };

  const handleCompleteCleaning = async (tableId: number) => {
    try {
      await posService.completeCleaning(tableId);
      addNotification('HOÀN TẤT DỌN BÀN', 'Bàn đã dọn sạch và sẵn sàng đón khách mới.');
      await fetchTablesAndShift(true);
    } catch (err) {
      addNotification('KHÔNG THỂ CẬP NHẬT BÀN', getErrorMessage(err), 'warning');
    }
  };

  const handleOpenCheckoutForTable = async (tbl: PosTable) => {
    setCallingBillTableIds((prev) => ({ ...prev, [tbl.tableId]: false }));
    const orderId = tbl.currentOrderId ?? tbl.activeOrderId;
    if (!orderId) {
      addNotification('CHƯA CÓ ORDER', `${tbl.tableNumber} chưa có mã đơn hàng hoạt động.`, 'warning');
      return;
    }
    setIsLoadingCheckoutId(tbl.tableId);
    try {
      const order = await posService.getOrder(orderId);
      const activeItems = (order.items || [])
        .filter((it) => it.itemStatus !== 'Cancelled')
        .map((it) => ({
          id: it.orderItemId,
          name: it.itemName,
          quantity: it.quantity,
          price: Number(it.unitPrice ?? 0),
          total: Number(it.totalPrice ?? 0),
          modifiers: (it.modifiers || []).map((m) => m.modifierOptionName).filter(Boolean).join(', '),
        }));
      setDetailTableTarget(null);
      setCheckoutOrderState({
        table: tbl,
        subtotal: Number(order.subTotal ?? tbl.totalAmount ?? 0),
        taxAmount: Number(order.taxAmount ?? 0),
        totalAmount: Number(order.totalAmount ?? tbl.totalAmount ?? 0),
        items: activeItems,
      });
    } catch (err) {
      addNotification('LỖI TẢI ĐƠN HÀNG', getErrorMessage(err), 'warning');
    } finally {
      setIsLoadingCheckoutId(null);
    }
  };

  const handleCancelEmptyTable = async (tableId: number) => {
    try {
      await posService.cancelEmptyTable(tableId);
      addNotification('HỦY BÀN THÀNH CÔNG', 'Đã hủy phiên phục vụ và đưa bàn về trạng thái Trống.');
      await fetchTablesAndShift(true);
    } catch (err) {
      addNotification('LỖI HỦY BÀN', getErrorMessage(err), 'warning');
    }
  };

  const handlePaymentSuccess = async (receipt: PosReceiptData) => {
    const paidTable = checkoutOrderState?.table;
    if (paidTable) {
      setCallingBillTableIds((prev) => ({ ...prev, [paidTable.tableId]: false }));
    }
    setReceiptData(receipt);
    setCheckoutOrderState(null);
    setDetailTableTarget(null);
    if (paidTable) {
      addNotification(
        'THANH TOÁN THÀNH CÔNG',
        `Đã thu tiền ${paidTable.tableNumber}. Bàn chuyển sang chờ dọn.`
      );
    }
    await fetchTablesAndShift(true);
  };

  const handleClearFilters = () => {
    setSearchTable('');
    setSelectedFloor('ALL');
    setSelectedAreaId('ALL');
    setSelectedStatus('ALL');
  };

  const filteredTables = tables.filter((t) => {
    if (searchTable.trim()) {
      const q = searchTable.toLowerCase();
      if (!t.tableNumber.toLowerCase().includes(q) && !t.areaName.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (selectedFloor !== 'ALL') {
      const tableFloor = t.floor?.trim() || areaFloorMap.get(t.areaId) || '';
      if (tableFloor !== selectedFloor) return false;
    }
    if (selectedAreaId !== 'ALL' && String(t.areaId) !== selectedAreaId) {
      return false;
    }
    if (selectedStatus !== 'ALL' && t.status !== selectedStatus) {
      return false;
    }
    return true;
  });

  const hasActiveFilters =
    searchTable.trim() !== '' ||
    selectedFloor !== 'ALL' ||
    selectedAreaId !== 'ALL' ||
    selectedStatus !== 'ALL';

  return (
    <div className="p-4 lg:p-5 space-y-4 max-w-[1680px] mx-auto relative">
      {/* Top-right Toast Stack (QL_JBillard style) */}
      <div className="fixed top-16 right-5 z-50 space-y-2 pointer-events-none">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`w-80 p-3.5 rounded-xl shadow-xl border bg-white flex items-start gap-3 pointer-events-auto ${
              n.variant === 'warning' ? 'border-amber-300' : 'border-emerald-300'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                n.variant === 'warning'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-600 text-white'
              }`}
            >
              {n.variant === 'warning' ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
            </div>
            <div className="flex-1 text-xs min-w-0">
              <p
                className={`font-extrabold uppercase tracking-tight ${
                  n.variant === 'warning' ? 'text-amber-800' : 'text-emerald-700'
                }`}
              >
                {n.title}
              </p>
              <p className="text-slate-700 mt-0.5 break-words">{n.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setNotifications((prev) => prev.filter((item) => item.id !== n.id))}
              className="text-slate-400 hover:text-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Warning Banner when No Open Shift */}
      {hasOpenShift === false && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Chưa mở ca trực:</strong> Vui lòng mở ca trước khi thực hiện mở bàn hoặc thu tiền khách hàng.
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/pos/shifts')}
            className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors"
          >
            Đi Đến Mở Ca Trực
          </button>
        </div>
      )}

      {/* ROW 1: TOP KPI SUMMARY BAR */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
            <span className="font-semibold text-slate-600">TỔNG SỐ BÀN:</span>
            <span className="font-extrabold text-slate-950 text-sm">{totalTables}</span>
          </div>

          <div className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="font-semibold text-rose-700">ĐANG PHỤC VỤ:</span>
            <span className="font-extrabold text-rose-700 text-sm">{servingCount}</span>
          </div>

          <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="font-semibold text-emerald-700">BÀN TRỐNG:</span>
            <span className="font-extrabold text-emerald-700 text-sm">{emptyCount}</span>
          </div>

          <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="font-semibold text-amber-700">ĐÃ ĐẶT:</span>
            <span className="font-extrabold text-amber-700 text-sm">{reservedCount}</span>
          </div>

          <div className="px-3 py-2 rounded-lg bg-sky-50 border border-sky-200 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
            <span className="font-semibold text-sky-700">CHỜ DỌN:</span>
            <span className="font-extrabold text-sky-700 text-sm">{cleaningCount}</span>
          </div>

          <div className="px-3 py-2 rounded-lg bg-violet-50 border border-violet-200 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-600" />
            <span className="font-semibold text-violet-700">TỔNG TẠM TÍNH:</span>
            <span className="font-black text-violet-700 text-sm font-mono">
              {formatVND(totalLiveSubtotal)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void fetchTablesAndShift(false)}
          className="h-9 px-3.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Làm Mới Dữ Liệu</span>
        </button>
      </div>

      {/* ROW 2: FILTER BAR */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold uppercase text-slate-600 whitespace-nowrap">TÌM BÀN:</span>
          <input
            type="text"
            placeholder="Nhập tên bàn, khu vực..."
            value={searchTable}
            onChange={(e) => setSearchTable(e.target.value)}
            className="w-44 h-9 bg-white border border-slate-300 rounded-lg px-3 text-xs text-slate-900 outline-none focus:border-emerald-600"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="font-bold uppercase text-slate-600 whitespace-nowrap">TẦNG:</span>
          <select
            value={selectedFloor}
            onChange={(e) => setSelectedFloor(e.target.value)}
            className="h-9 bg-white border border-slate-300 rounded-lg px-2.5 text-xs text-slate-900 outline-none focus:border-emerald-600"
          >
            <option value="ALL">— Tất Cả Tầng —</option>
            {floorOptions.map((fl) => (
              <option key={fl} value={fl}>
                {fl}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-bold uppercase text-slate-600 whitespace-nowrap">KHU VỰC:</span>
          <select
            value={selectedAreaId}
            onChange={(e) => setSelectedAreaId(e.target.value)}
            className="h-9 bg-white border border-slate-300 rounded-lg px-2.5 text-xs text-slate-900 outline-none focus:border-emerald-600"
          >
            <option value="ALL">— Tất Cả Khu Vực —</option>
            {areas.map((a) => (
              <option key={a.areaId} value={String(a.areaId)}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-bold uppercase text-slate-600 whitespace-nowrap">TRẠNG THÁI:</span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-9 bg-white border border-slate-300 rounded-lg px-2.5 text-xs text-slate-900 outline-none focus:border-emerald-600"
          >
            <option value="ALL">Tất Cả Bàn</option>
            <option value="Empty">Bàn Trống</option>
            <option value="Serving">Đang Phục Vụ</option>
            <option value="Reserved">Đã Đặt</option>
            <option value="Cleaning">Chờ Dọn</option>
          </select>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="h-9 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold flex items-center gap-1.5 transition-colors ml-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Xóa Bộ Lọc</span>
          </button>
        )}
      </div>

      {/* Fetch error banner */}
      {fetchError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between gap-3 text-xs text-red-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>Không thể tải danh sách bàn từ máy chủ: {fetchError}</span>
          </div>
          <button
            type="button"
            onClick={() => void fetchTablesAndShift(false)}
            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* ROW 3: UNIFORM STATUS-BORDERED TABLE CARD GRID */}
      {filteredTables.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3 shadow-sm">
          <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
            <Utensils className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            {tables.length === 0 ? 'Chưa Có Dữ Liệu Bàn Ăn' : 'Không Tìm Thấy Bàn Phù Hợp'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {tables.length === 0
              ? 'Hệ thống chưa tải được bàn nào từ SQL Server hoặc nhà hàng chưa cấu hình bàn.'
              : 'Thử điều chỉnh từ khóa tìm kiếm, tầng, khu vực hoặc xóa bộ lọc hiện tại.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
            >
              Xóa Bộ Lọc
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 min-[1750px]:grid-cols-5 gap-4">
          {filteredTables.map((tbl) => {
            const isServing = tbl.status === 'Serving';
            const isEmpty = tbl.status === 'Empty';
            const isReserved = tbl.status === 'Reserved';
            const isCleaning = tbl.status === 'Cleaning';
            const liveAmount = Number(tbl.totalAmount ?? tbl.currentTotal ?? 0);
            const isCallingBill = Boolean(callingBillTableIds[tbl.tableId]);

            const borderClass = isCallingBill
              ? 'border-red-600 ring-4 ring-red-500/70 shadow-xl shadow-red-500/30'
              : isServing
              ? 'border-red-500'
              : isEmpty
              ? 'border-emerald-500'
              : isReserved
              ? 'border-amber-500'
              : 'border-sky-500';

            const badgeClass = isCallingBill
              ? 'bg-red-600 animate-pulse font-black'
              : isServing
              ? 'bg-red-600'
              : isEmpty
              ? 'bg-emerald-600'
              : isReserved
              ? 'bg-amber-600'
              : 'bg-sky-600';

            const badgeLabel = isCallingBill
              ? '🔔 GỌI TÍNH TIỀN'
              : isServing
              ? 'ĐANG PHỤC VỤ'
              : isEmpty
              ? 'BÀN TRỐNG'
              : isReserved
              ? 'ĐÃ ĐẶT'
              : 'CHỜ DỌN';

            return (
              <div
                key={tbl.tableId}
                className={`bg-white rounded-xl border-2 ${borderClass} p-3.5 shadow-sm flex flex-col justify-between min-h-[268px] transition-shadow hover:shadow-md`}
              >
                {/* Card Header */}
                <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                  <div className="min-w-0">
                    <h3 className="text-base font-extrabold text-slate-950 tracking-tight truncate">
                      {tbl.tableNumber}
                    </h3>
                    <p className="text-[11px] font-medium text-slate-500 truncate">
                      {tbl.areaName}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold text-white shrink-0 whitespace-nowrap ${badgeClass}`}
                  >
                    {badgeLabel}
                  </span>
                </div>

                {/* Card Body */}
                <div className="flex-1 flex flex-col justify-center py-3 space-y-2.5">
                  {isServing ? (
                    <>
                      <div className="bg-amber-50/80 border border-amber-200/90 rounded-lg py-1.5 px-3 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-amber-800 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                          <span>Thời gian ngồi:</span>
                        </span>
                        <span className="font-mono text-base font-black text-amber-700">
                          {formatElapsedHms(tbl.openedAt, nowMs)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-600 px-1">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>Khách tại bàn:</span>
                        </span>
                        <span className="font-bold text-slate-900">
                          {tbl.guestCount || 2} / {tbl.capacity}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between px-1">
                        <span className="text-[11px] font-bold uppercase text-slate-500">
                          Tạm tính:
                        </span>
                        <span className="text-base font-black text-emerald-700 font-mono">
                          {formatVND(liveAmount)}
                        </span>
                      </div>
                    </>
                  ) : isReserved ? (
                    <div className="text-center space-y-1.5">
                      <div className="w-11 h-11 mx-auto rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-extrabold text-amber-700 uppercase">
                        BÀN ĐÃ ĐƯỢC ĐẶT
                      </p>
                      <p className="text-[11px] text-slate-600">
                        {tbl.reservationTime
                          ? `Lịch hẹn: ${new Date(tbl.reservationTime).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}`
                          : 'Đã có lịch giữ chỗ'}
                      </p>
                      <p className="text-[11px] text-slate-500">Sức chứa: {tbl.capacity} người</p>
                    </div>
                  ) : isCleaning ? (
                    <div className="text-center space-y-1.5">
                      <div className="w-11 h-11 mx-auto rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-extrabold text-sky-700 uppercase">CHỜ DỌN DẸP</p>
                      <p className="text-[11px] text-slate-500">Cần thu dọn &amp; set bàn mới</p>
                    </div>
                  ) : (
                    <div className="text-center space-y-1.5">
                      <div className="w-11 h-11 mx-auto rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                        <Utensils className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-bold text-slate-800">
                        Sức chứa: {tbl.capacity} người
                      </p>
                      <p className="text-[11px] text-slate-500">Sẵn sàng đón khách</p>
                    </div>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="pt-2.5 border-t border-slate-100 flex items-center gap-1">
                  {isEmpty && (
                    <button
                      type="button"
                      onClick={() => void handleRequestOpenTable(tbl)}
                      className="flex-1 h-9 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>MỞ BÀN</span>
                    </button>
                  )}

                  {isReserved && (
                    <button
                      type="button"
                      onClick={() => void handleRequestOpenTable(tbl)}
                      className="flex-1 h-9 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>MỞ BÀN ĐÃ ĐẶT</span>
                    </button>
                  )}

                  {isServing && (
                    <>
                      <button
                        type="button"
                        onClick={() => setQrSlipTableTarget(tbl)}
                        className="w-9 h-9 shrink-0 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg flex items-center justify-center transition-colors"
                        title="In / Xem Phiếu QR gọi món tại bàn"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetailTableTarget(tbl)}
                        className="flex-1 min-w-0 h-9 px-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-[11px] rounded-lg flex items-center justify-center transition-colors whitespace-nowrap"
                      >
                        <span>Chi tiết</span>
                      </button>
                      <button
                        type="button"
                        disabled={isLoadingCheckoutId === tbl.tableId}
                        onClick={() => void handleOpenCheckoutForTable(tbl)}
                        className={`flex-1 min-w-0 h-9 px-2 ${
                          isCallingBill
                            ? 'bg-red-600 hover:bg-red-700 animate-pulse ring-2 ring-red-300 font-black'
                            : 'bg-red-600 hover:bg-red-700 font-bold'
                        } disabled:opacity-50 text-white text-[11px] rounded-lg flex items-center justify-center gap-1 transition-colors whitespace-nowrap`}
                      >
                        <CreditCard className="w-3.5 h-3.5 shrink-0 hidden 2xl:inline-block" />
                        <span>
                          {isLoadingCheckoutId === tbl.tableId
                            ? 'Đang tải...'
                            : isCallingBill
                            ? '🔔 THANH TOÁN'
                            : 'THANH TOÁN'}
                        </span>
                      </button>
                    </>
                  )}

                  {isCleaning && (
                    <button
                      type="button"
                      onClick={() => void handleCompleteCleaning(tbl.tableId)}
                      className="w-full h-9 px-3 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>HOÀN TẤT DỌN</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODALS */}
      <PosOpenTableModal
        isOpen={Boolean(openTableTarget)}
        onClose={() => setOpenTableTarget(null)}
        table={openTableTarget}
        onConfirm={handleConfirmOpenTable}
      />

      <PosTableDetailModal
        isOpen={Boolean(detailTableTarget) && !checkoutOrderState}
        onClose={() => setDetailTableTarget(null)}
        table={detailTableTarget}
        allTables={tables}
        onOpenCheckout={() => {
          if (detailTableTarget) {
            void handleOpenCheckoutForTable(detailTableTarget);
          }
        }}
        onRefreshTables={() => void fetchTablesAndShift(true)}
      />

      <PosCheckoutModal
        isOpen={Boolean(checkoutOrderState)}
        onClose={() => setCheckoutOrderState(null)}
        table={checkoutOrderState?.table ?? null}
        subtotal={checkoutOrderState?.subtotal ?? 0}
        taxAmount={checkoutOrderState?.taxAmount}
        totalAmount={checkoutOrderState?.totalAmount}
        orderItems={checkoutOrderState?.items ?? []}
        onPaymentSuccess={(receipt) => void handlePaymentSuccess(receipt)}
        onCancelEmptyTable={handleCancelEmptyTable}
      />

      <PosReceiptModal
        isOpen={Boolean(receiptData)}
        onClose={() => setReceiptData(null)}
        receipt={receiptData}
        onCompleteTable={handleCompleteCleaning}
      />

      <PosTableQrSlipModal
        isOpen={Boolean(qrSlipTableTarget)}
        onClose={() => setQrSlipTableTarget(null)}
        table={qrSlipTableTarget}
        sessionToken={
          (qrSlipTableTarget && tableSessionTokens[qrSlipTableTarget.tableId]) ||
          qrSlipTableTarget?.sessionToken
        }
        pinCode={
          (qrSlipTableTarget && tablePins[qrSlipTableTarget.tableId]) ||
          qrSlipTableTarget?.pinCode
        }
      />
    </div>
  );
};
