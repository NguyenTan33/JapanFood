import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Flame,
  Search,
  RefreshCw,
  Printer,
  LogOut,
  XCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  kdsService,
  KdsTab,
  KitchenItemCardDto,
  KitchenTabCountsDto,
  KdsPrintTicketDto,
} from '@/services/kdsService';
import { getErrorMessage } from '@/services/apiClient';
import { useAuth } from '@/context/AuthContext';
import { normalizeUserRole } from '@/types';
import { KdsPrintFramePortal } from '@/components/pos/KdsPrintTicketModal';
import { useTableAlertPolling, playAlertChime } from '@/hooks/useTableAlertPolling';

export function formatVnClock(iso?: string | null): string {
  if (!iso) return '';
  const s = String(iso).trim();
  const normalized = s.endsWith('Z') || s.includes('+') ? s : `${s}Z`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const h = parts.find((p) => p.type === 'hour')?.value ?? '0';
  const m = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${Number(h)}h${m}`;
}

/** Normalize a UTC datetime string from SQL Server (may lack 'Z' suffix) */
function parseKdsUtcMs(iso: string | null | undefined): number {
  if (!iso) return NaN;
  const s = String(iso).trim();
  const normalized = s.endsWith('Z') || s.includes('+') ? s : `${s}Z`;
  return new Date(normalized).getTime();
}

export function getDisplayElapsedSeconds(item: KitchenItemCardDto, nowMs: number): number {
  const isFinished =
    item.status === 'Ready' ||
    item.status === 'Served' ||
    item.status === 'Cancelled' ||
    Boolean(item.completedAt);

  if (isFinished) {
    if (item.completedAt) {
      const completedMs = parseKdsUtcMs(item.completedAt);
      const createdMs = parseKdsUtcMs(item.createdAt);
      const diffSec = Math.floor((completedMs - createdMs) / 1000);
      return Math.max(0, Number.isNaN(diffSec) ? 0 : diffSec);
    }
    return Math.max(0, Math.round((item.elapsedMinutes || 0) * 60));
  }

  const startMs = parseKdsUtcMs(item.createdAt);
  if (Number.isNaN(startMs)) return 0;
  return Math.max(0, Math.floor((nowMs - startMs) / 1000));
}

function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) {
    return `${hours}h${String(mins).padStart(2, '0')}p`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

type KdsDateFilterMode = 'TODAY' | 'YESTERDAY' | 'DATE' | 'MONTH' | 'YEAR';

function getTodayDateInputStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function computeKdsDateRange(
  mode: KdsDateFilterMode,
  selectedDate: string,
  selectedMonth: number,
  selectedYear: number
): { fromDate: string; toDate: string; label: string } {
  const now = new Date();
  if (mode === 'TODAY') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    return {
      fromDate: start.toISOString(),
      toDate: end.toISOString(),
      label: `Hôm nay (${start.toLocaleDateString('vi-VN')})`,
    };
  }
  if (mode === 'YESTERDAY') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    return {
      fromDate: start.toISOString(),
      toDate: end.toISOString(),
      label: `Hôm qua (${start.toLocaleDateString('vi-VN')})`,
    };
  }
  if (mode === 'DATE') {
    const parts = (selectedDate || getTodayDateInputStr()).split('-').map(Number);
    const y = parts[0] || now.getFullYear();
    const m = (parts[1] || now.getMonth() + 1) - 1;
    const d = parts[2] || now.getDate();
    const start = new Date(y, m, d, 0, 0, 0);
    const end = new Date(y, m, d + 1, 0, 0, 0);
    return {
      fromDate: start.toISOString(),
      toDate: end.toISOString(),
      label: `Ngày ${start.toLocaleDateString('vi-VN')}`,
    };
  }
  if (mode === 'MONTH') {
    const start = new Date(selectedYear, selectedMonth - 1, 1, 0, 0, 0);
    const end = new Date(selectedYear, selectedMonth, 1, 0, 0, 0);
    return {
      fromDate: start.toISOString(),
      toDate: end.toISOString(),
      label: `Tháng ${String(selectedMonth).padStart(2, '0')}/${selectedYear}`,
    };
  }
  // YEAR
  const start = new Date(selectedYear, 0, 1, 0, 0, 0);
  const end = new Date(selectedYear + 1, 0, 1, 0, 0, 0);
  return {
    fromDate: start.toISOString(),
    toDate: end.toISOString(),
    label: `Năm ${selectedYear}`,
  };
}

const KDS_PAGE_SIZE = 24;

export const KdsScreen: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();

  const isStandalone = !location.pathname.startsWith('/pos');

  const [activeTab, setActiveTab] = useState<KdsTab>('unfinished');
  const [items, setItems] = useState<KitchenItemCardDto[]>([]);
  const [counts, setCounts] = useState<KitchenTabCountsDto>({
    unfinished: 0,
    completed: 0,
    cancelled: 0,
    overdue: 0,
  });

  const [selectedTableFilter, setSelectedTableFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [toastBanner, setToastBanner] = useState<string | null>(null);
  const [completingIds, setCompletingIds] = useState<number[]>([]);
  const [reprintingIds, setReprintingIds] = useState<number[]>([]);

  // Advanced Date Filter State for Completed / Cancelled items
  const [dateFilterMode, setDateFilterMode] = useState<KdsDateFilterMode>('TODAY');
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayDateInputStr());
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [currentPage, setCurrentPage] = useState<number>(1);

  const dateRange = useMemo(
    () => computeKdsDateRange(dateFilterMode, selectedDate, selectedMonth, selectedYear),
    [dateFilterMode, selectedDate, selectedMonth, selectedYear]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, selectedTableFilter, searchQuery, dateFilterMode, selectedDate, selectedMonth, selectedYear]);

  // Live 1s timer tick (only meaningful on unfinished items; finished items ignore nowMs)
  const [nowMs, setNowMs] = useState<number>(Date.now());

  // 7-second Kitchen Buzz Shake state per table (khách bấm "Giục món" → rung thẻ món của bàn 7s)
  const [buzzedTables, setBuzzedTables] = useState<Record<string, number>>({});

  // Nhận thông báo giục món từ server (khách quét QR tại bàn)
  useTableAlertPolling('KITCHEN_BUZZ');

  useEffect(() => {
    const handleKitchenBuzz = (e: any) => {
      const detail = e.detail;
      const tblName = (detail?.tableNumber || '').trim().toUpperCase();
      if (tblName) {
        const expiry = Date.now() + 7000;
        setBuzzedTables((prev) => ({
          ...prev,
          [tblName]: expiry,
        }));
        setNowMs(Date.now());
        playAlertChime(3);
        setToastBanner(`🔔 ${tblName} vừa giục món! Ưu tiên làm nhanh các món của bàn này.`);
        setTimeout(() => setToastBanner(null), 7000);
        setTimeout(() => setNowMs(Date.now()), 7100);
      }
    };

    window.addEventListener('torisakura_kitchen_buzz', handleKitchenBuzz);
    return () => window.removeEventListener('torisakura_kitchen_buzz', handleKitchenBuzz);
  }, []);

  // Print portal state (1-copy 80mm FIFO serial print queue)
  const [activePrintTicket, setActivePrintTicket] = useState<KdsPrintTicketDto | null>(null);

  const pollSeqRef = useRef(0);
  const manualFetchSeqRef = useRef(0);
  const inFlightCompleteIdsRef = useRef<Set<number>>(new Set());
  const printQueueRef = useRef<KdsPrintTicketDto[]>([]);
  const isPrintingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const handleAfterPrint = () => {
      if (!isPrintingRef.current && printQueueRef.current.length === 0) {
        setActivePrintTicket(null);
      }
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  useEffect(() => {
    if (activeTab !== 'unfinished' || items.length === 0) return;
    const interval = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        setNowMs(Date.now());
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTab, items.length]);

  const fetchItems = useCallback(
    async (silent = false) => {
      const seq = ++pollSeqRef.current;
      let manualSeq = 0;
      if (!silent) {
        manualSeq = ++manualFetchSeqRef.current;
        setIsLoading(true);
      }
      try {
        const numericTableId = /^\d+$/.test(selectedTableFilter)
          ? Number(selectedTableFilter)
          : undefined;

        const res = await kdsService.getItems({
          tab: activeTab,
          tableId: numericTableId,
          search: searchQuery.trim() || undefined,
          fromDate: dateRange.fromDate,
          toDate: dateRange.toDate,
        });

        if (seq !== pollSeqRef.current) return;

        const filteredInFlight = res.items.filter(
          (it) => !inFlightCompleteIdsRef.current.has(it.ticketItemId)
        );
        setItems(filteredInFlight);
        setCounts(res.counts);
        setErrorBanner(null);
      } catch (err) {
        if (seq !== pollSeqRef.current) return;
        setErrorBanner(getErrorMessage(err));
      } finally {
        if (!silent && manualSeq === manualFetchSeqRef.current) {
          setIsLoading(false);
        }
      }
    },
    [activeTab, selectedTableFilter, searchQuery, dateRange.fromDate, dateRange.toDate]
  );

  useEffect(() => {
    void fetchItems(false);
    const interval = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void fetchItems(true);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchItems]);

  const waitForNextFrames = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    });

  const drainPrintQueue = useCallback(async () => {
    if (isPrintingRef.current) return;
    isPrintingRef.current = true;
    try {
      while (printQueueRef.current.length > 0 && isMountedRef.current) {
        const nextTicket = printQueueRef.current.shift()!;
        setActivePrintTicket(nextTicket);
        await waitForNextFrames();
        if (!isMountedRef.current) break;
        window.print();
      }
    } finally {
      isPrintingRef.current = false;
      if (isMountedRef.current && printQueueRef.current.length === 0) {
        setActivePrintTicket(null);
      }
    }
  }, []);

  const enqueueThermalPrint = useCallback(
    (ticket: KdsPrintTicketDto) => {
      printQueueRef.current.push(ticket);
      void drainPrintQueue();
    },
    [drainPrintQueue]
  );

  const handleCompleteItem = async (item: KitchenItemCardDto) => {
    if (inFlightCompleteIdsRef.current.has(item.ticketItemId)) return;
    inFlightCompleteIdsRef.current.add(item.ticketItemId);
    setCompletingIds((prev) => [...prev, item.ticketItemId]);

    try {
      const res = await kdsService.completeItem(item.ticketItemId);

      // Invalidate any pre-mutation in-flight poll before updating state
      pollSeqRef.current += 1;

      // Immediately update UI non-blockingly before triggering print
      setItems((prev) => prev.filter((x) => x.ticketItemId !== item.ticketItemId));
      setCounts((prev) => ({
        ...prev,
        unfinished: Math.max(0, prev.unfinished - 1),
        completed: prev.completed + 1,
        overdue: item.isOverdue ? Math.max(0, prev.overdue - 1) : prev.overdue,
      }));

      const completedClock =
        res.item?.completedTimeDisplay ||
        res.printTicket?.completedAtDisplay ||
        formatVnClock(res.item?.completedAt || new Date().toISOString());

      setToastBanner(
        `Đã hoàn thành "${res.item?.dishName || item.dishName}" (${res.item?.tableName || item.tableName}) lúc ${completedClock} — Đang in 1 bản`
      );
      setTimeout(() => setToastBanner(null), 5000);

      const printPayload: KdsPrintTicketDto = res.printTicket ?? {
        restaurantName: 'SAKURA JAPAN FOOD',
        tableName: item.tableName,
        dishName: item.dishName,
        quantity: item.quantity,
        modifiersSummary: item.modifiersSummary,
        specialInstructions: item.specialInstructions,
        orderedAtDisplay: formatVnClock(item.createdAt),
        completedAtDisplay: completedClock,
        copyNumber: 1,
      };
      enqueueThermalPrint(printPayload);
    } catch (err) {
      setErrorBanner(getErrorMessage(err));
    } finally {
      inFlightCompleteIdsRef.current.delete(item.ticketItemId);
      setCompletingIds((prev) => prev.filter((id) => id !== item.ticketItemId));
    }
  };

  const handleReprintItem = async (item: KitchenItemCardDto) => {
    if (reprintingIds.includes(item.ticketItemId)) return;
    setReprintingIds((prev) => [...prev, item.ticketItemId]);
    try {
      const res = await kdsService.reprintItem(item.ticketItemId);
      setItems((prev) =>
        prev.map((x) => (x.ticketItemId === item.ticketItemId && res.item ? res.item : x))
      );

      const printPayload: KdsPrintTicketDto = res.printTicket ?? {
        restaurantName: 'SAKURA JAPAN FOOD',
        tableName: item.tableName,
        dishName: item.dishName,
        quantity: item.quantity,
        modifiersSummary: item.modifiersSummary,
        specialInstructions: item.specialInstructions,
        orderedAtDisplay: formatVnClock(item.createdAt),
        completedAtDisplay: item.completedTimeDisplay || formatVnClock(item.completedAt),
        copyNumber: (item.printCount || 1) + 1,
      };
      enqueueThermalPrint(printPayload);
    } catch (err) {
      setErrorBanner(getErrorMessage(err));
    } finally {
      setReprintingIds((prev) => prev.filter((id) => id !== item.ticketItemId));
    }
  };

  // Distinct tables from current items for dropdown
  const tableFilterOptions = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((it) => {
      const key = it.tableId !== null && it.tableId !== undefined ? String(it.tableId) : `NAME:${it.tableName}`;
      if (!map.has(key)) {
        map.set(key, it.tableName);
      }
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [items]);

  // Keep selectedTableFilter synced if its last item completes or disappears
  useEffect(() => {
    if (selectedTableFilter === 'ALL' || isLoading) return;
    const stillExists = tableFilterOptions.some((opt) => opt.value === selectedTableFilter);
    if (!stillExists) {
      setSelectedTableFilter('ALL');
    }
  }, [selectedTableFilter, tableFilterOptions, isLoading]);

  // Client filter for tableName-only rows (e.g. Mang về / Online) + search safety
  const displayedItems = useMemo(() => {
    const filtered = items.filter((it) => {
      if (selectedTableFilter !== 'ALL') {
        if (selectedTableFilter.startsWith('NAME:')) {
          if (it.tableName !== selectedTableFilter.slice(5)) return false;
        } else if (String(it.tableId) !== selectedTableFilter) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDish = it.dishName.toLowerCase().includes(q);
        const matchTable = it.tableName.toLowerCase().includes(q);
        if (!matchDish && !matchTable) return false;
      }
      return true;
    });

    if (activeTab === 'unfinished') {
      return [...filtered].sort((a, b) => {
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
        return parseKdsUtcMs(a.createdAt) - parseKdsUtcMs(b.createdAt);
      });
    }
    return filtered;
  }, [items, selectedTableFilter, searchQuery, activeTab]);

  const totalPages = Math.max(1, Math.ceil(displayedItems.length / KDS_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * KDS_PAGE_SIZE;
    return displayedItems.slice(start, start + KDS_PAGE_SIZE);
  }, [displayedItems, safePage]);

  const role = normalizeUserRole(currentUser?.role);

  return (
    <div className={`${isStandalone ? 'min-h-screen' : 'min-h-full'} bg-slate-50 text-slate-900 font-sans`}>
      {/* Compact Top Bar ONLY when mounted standalone at /kds */}
      {isStandalone && (
        <header className="h-14 bg-white border-b border-slate-200 px-4 lg:px-6 flex items-center justify-between gap-3 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Flame className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-extrabold uppercase tracking-wide text-slate-950 truncate">
                SAKURA KDS • BẾP CHẾ BIẾN
              </h1>
              <p className="text-[11px] text-slate-500 truncate">
                {currentUser?.fullName} ({role})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/pos/login', { replace: true });
              }}
              className="h-9 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </header>
      )}

      <div className="p-4 lg:p-5 space-y-4 max-w-[1680px] mx-auto">
        {/* Header & 3-Tab Filter Card (QL_JBillard OrderQueueView.xaml) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
          {/* Row 1: Title, live counters, refresh */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-base font-extrabold text-slate-950 uppercase tracking-wide">
                DANH SÁCH MÓN CHẾ BIẾN (KDS)
              </h2>

              <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                {counts.unfinished} chưa hoàn thành
              </span>

              {counts.overdue > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-600 text-xs font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                  <span>{counts.overdue} món quá hạn</span>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => void fetchItems(false)}
              className="h-9 px-3.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Làm Mới</span>
            </button>
          </div>

          {/* Row 2: ONLY 3 Tabs + Table filter + Search */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {/* 3 Segmented Filter Tabs (NO "Tất cả") */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('unfinished')}
                className={`h-9 px-3.5 rounded-lg text-xs font-bold transition-colors ${
                  activeTab === 'unfinished'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                }`}
              >
                Chưa hoàn thành ({counts.unfinished})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('completed')}
                className={`h-9 px-3.5 rounded-lg text-xs font-bold transition-colors ${
                  activeTab === 'completed'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                }`}
              >
                Hoàn thành ({counts.completed})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('cancelled')}
                className={`h-9 px-3.5 rounded-lg text-xs font-bold transition-colors ${
                  activeTab === 'cancelled'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                }`}
              >
                Hủy ({counts.cancelled})
              </button>
            </div>

            {/* Table dropdown & Search */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedTableFilter}
                onChange={(e) => setSelectedTableFilter(e.target.value)}
                aria-label="Lọc theo bàn"
                className="h-9 w-44 bg-white border border-slate-300 rounded-lg px-3 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600"
              >
                <option value="ALL">Tất cả bàn</option>
                {tableFilterOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <div className="relative w-60">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm tên món hoặc bàn..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 bg-white border border-slate-300 rounded-lg pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-emerald-600"
                />
              </div>
            </div>
          </div>

          {/* Row 3: Advanced Date / Month / Year Filter for Completed & Cancelled History */}
          <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 mr-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                <span>Lọc lịch sử hoàn thành/hủy:</span>
              </span>

              {(
                [
                  { key: 'TODAY', label: 'Hôm nay' },
                  { key: 'YESTERDAY', label: 'Hôm qua' },
                  { key: 'DATE', label: 'Chọn ngày' },
                  { key: 'MONTH', label: 'Theo tháng' },
                  { key: 'YEAR', label: 'Theo năm' },
                ] as Array<{ key: KdsDateFilterMode; label: string }>
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setDateFilterMode(opt.key)}
                  className={`h-8 px-2.5 rounded-lg text-xs font-bold transition-colors ${
                    dateFilterMode === opt.key
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}

              {dateFilterMode === 'DATE' && (
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  aria-label="Chọn ngày lọc KDS"
                  className="h-8 bg-white border border-slate-300 rounded-lg px-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-600"
                />
              )}

              {dateFilterMode === 'MONTH' && (
                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    aria-label="Chọn tháng"
                    className="h-8 bg-white border border-slate-300 rounded-lg px-2 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-600"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        Tháng {m}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    aria-label="Chọn năm"
                    className="h-8 bg-white border border-slate-300 rounded-lg px-2 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-600"
                  >
                    {[2024, 2025, 2026, 2027].map((y) => (
                      <option key={y} value={y}>
                        Năm {y}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {dateFilterMode === 'YEAR' && (
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  aria-label="Chọn năm"
                  className="h-8 bg-white border border-slate-300 rounded-lg px-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-600"
                >
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>
                      Năm {y}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="text-[11px] font-semibold text-slate-500">
              Đang xem kỳ: <strong className="text-emerald-700">{dateRange.label}</strong>
              {displayedItems.length > KDS_PAGE_SIZE && (
                <span className="ml-2 text-slate-600">
                  • Trang {safePage}/{totalPages} ({displayedItems.length} món)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Toast / Error Banners */}
        {toastBanner && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastBanner}</span>
          </div>
        )}

        {errorBanner && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>Không thể tải dữ liệu KDS: {errorBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => void fetchItems(false)}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold shrink-0"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Flat Per-Dish Cards Grid */}
        {displayedItems.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-2 shadow-sm">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              {activeTab === 'cancelled' ? (
                <XCircle className="w-6 h-6 text-slate-400" />
              ) : (
                <CheckCircle2 className="w-6 h-6" />
              )}
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              {activeTab === 'unfinished'
                ? 'Không Có Món Chưa Hoàn Thành'
                : activeTab === 'completed'
                ? 'Chưa Có Món Đã Hoàn Thành'
                : 'Không Có Món Đã Hủy'}
            </h3>
            <p className="text-xs text-slate-500">
              Dữ liệu được đồng bộ tự động mỗi 5 giây từ máy chủ nhà bếp.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {paginatedItems.map((item) => {
              const elapsedSeconds = getDisplayElapsedSeconds(item, nowMs);
              const isOverdue = activeTab === 'unfinished' && (item.isOverdue || elapsedSeconds >= 15 * 60);
              const isWarning = activeTab === 'unfinished' && !isOverdue && elapsedSeconds >= 10 * 60;
              const formattedDuration = formatDuration(elapsedSeconds);
              const completedClock =
                item.completedTimeDisplay || formatVnClock(item.completedAt);
              const orderedClock = formatVnClock(item.createdAt);

              const itemTbl = (item.tableName || '').trim().toUpperCase();
              const isBuzzed = Boolean(
                activeTab === 'unfinished' &&
                itemTbl &&
                Object.entries(buzzedTables).some(([bTbl, expiry]) =>
                  expiry > nowMs && (
                    itemTbl === bTbl ||
                    itemTbl.includes(bTbl) ||
                    bTbl.includes(itemTbl)
                  )
                )
              );

              const cardSurface =
                isBuzzed
                  ? 'bg-red-50/95 border-red-600 ring-4 ring-red-500/80 shadow-2xl shadow-red-500/40 animate-buzz-shake'
                  : activeTab === 'unfinished' && isOverdue
                  ? 'bg-red-50 border-red-500'
                  : activeTab === 'unfinished'
                  ? 'bg-white border-slate-200'
                  : activeTab === 'completed'
                  ? 'bg-white border-slate-300'
                  : 'bg-rose-50/40 border-rose-200';

              return (
                <article
                  key={item.ticketItemId}
                  className={`rounded-xl border-[1.5px] ${cardSurface} p-3.5 flex flex-col justify-between gap-3 shadow-sm transition-all`}
                >
                  {/* Buzz Banner if customer is buzzing kitchen */}
                  {isBuzzed && (
                    <div className="bg-red-600 text-white text-[11px] font-black uppercase tracking-wider py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 animate-pulse shadow-md">
                      <Flame className="w-4 h-4 animate-bounce" />
                      <span>🔥 KHÁCH ĐANG GIỤC MÓN! ƯU TIÊN LÀM NGAY</span>
                    </div>
                  )}

                  {/* Card Header: Timer/Status on Left, Table Name pinned TOP-RIGHT */}
                  <div className="flex items-start justify-between gap-2">
                    {activeTab === 'unfinished' ? (
                      <div
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold font-mono shrink-0 ${
                          isOverdue
                            ? 'bg-red-600 text-white'
                            : isWarning
                            ? 'bg-amber-50 text-amber-700 border border-amber-300'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formattedDuration}</span>
                        {isOverdue && <span>• TRỄ</span>}
                      </div>
                    ) : activeTab === 'completed' ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold font-mono shrink-0 bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {completedClock ? `${completedClock} • ` : ''}
                          {formattedDuration}
                        </span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold font-mono shrink-0 bg-rose-100 text-rose-700 border border-rose-200">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Đã hủy • {formattedDuration}</span>
                      </div>
                    )}

                    {/* Top-Right Table Badge (MANDATORY R2 PLACEMENT) */}
                    <span className="px-2.5 py-1 rounded-md bg-emerald-600 text-white font-extrabold text-xs tracking-wide text-right leading-tight break-words max-w-[200px] min-w-0">
                      {item.tableName}
                    </span>
                  </div>

                  <div className="h-px bg-slate-100" />

                  {/* Card Body: Dish Name + Quantity (NO dishCode, NO ticketNumber, NO STT) */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2.5">
                      <h3 className="text-sm font-extrabold text-slate-950 leading-snug break-words">
                        {item.dishName}
                      </h3>
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold text-base shrink-0">
                        x{item.quantity}
                      </span>
                    </div>

                    {item.modifiersSummary && item.modifiersSummary.trim() && (
                      <p className="text-xs text-slate-600 italic">+ {item.modifiersSummary}</p>
                    )}

                    {item.specialInstructions && item.specialInstructions.trim() && (
                      <div className="px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 font-medium">
                        Ghi chú: {item.specialInstructions}
                      </div>
                    )}

                    <p className="text-[11px] text-slate-500">
                      Gọi lúc: <span className="font-semibold text-slate-700">{orderedClock || '--'}</span>
                    </p>

                    {activeTab === 'completed' && (
                      <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg px-2.5 py-1.5 text-xs text-emerald-800 flex items-center justify-between gap-2">
                        <span>
                          Hoàn thành: <strong>{completedClock || '--'}</strong>
                        </span>
                        <span className="font-mono font-bold">{formattedDuration}</span>
                      </div>
                    )}

                    {activeTab === 'cancelled' && item.cancellationReason && (
                      <div className="bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5 text-xs text-rose-800">
                        Lý do hủy: {item.cancellationReason}
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Single Action */}
                  <div className="pt-1">
                    {activeTab === 'unfinished' && (
                      <button
                        type="button"
                        disabled={completingIds.includes(item.ticketItemId)}
                        onClick={() => void handleCompleteItem(item)}
                        className="w-full h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {completingIds.includes(item.ticketItemId)
                            ? 'Đang hoàn thành...'
                            : 'Hoàn thành'}
                        </span>
                      </button>
                    )}

                    {activeTab === 'completed' && (
                      <button
                        type="button"
                        disabled={reprintingIds.includes(item.ticketItemId)}
                        onClick={() => void handleReprintItem(item)}
                        className="w-full h-9 rounded-lg bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Printer className="w-4 h-4" />
                        <span>
                          {reprintingIds.includes(item.ticketItemId) ? 'Đang in...' : 'In lại'}
                        </span>
                      </button>
                    )}

                    {activeTab === 'cancelled' && (
                      <div className="w-full h-8 rounded-lg bg-rose-100 text-rose-700 text-[11px] font-extrabold uppercase tracking-wider flex items-center justify-center">
                        ĐÃ HỦY MÓN
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
            </div>

            {totalPages > 1 && (
              <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 shadow-xs">
                <span className="text-xs font-semibold text-slate-600">
                  Hiển thị {(safePage - 1) * KDS_PAGE_SIZE + 1}–
                  {Math.min(safePage * KDS_PAGE_SIZE, displayedItems.length)} trong tổng số{' '}
                  <strong>{displayedItems.length}</strong> món ({dateRange.label})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="h-8 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 text-xs font-bold text-slate-800 flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Trang trước</span>
                  </button>
                  <span className="text-xs font-bold text-slate-800 px-2">
                    Trang {safePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="h-8 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 text-xs font-bold text-slate-800 flex items-center gap-1"
                  >
                    <span>Trang sau</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Non-blocking 1-copy 80mm Thermal Print Portal */}
      <KdsPrintFramePortal ticket={activePrintTicket} />
    </div>
  );
};
