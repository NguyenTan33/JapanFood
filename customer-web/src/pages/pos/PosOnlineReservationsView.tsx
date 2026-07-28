import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CalendarCheck,
  Search,
  CheckCircle2,
  Clock,
  UserCheck,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Phone,
  User,
  MapPin,
  X,
  Ban,
  Calendar,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RotateCcw,
  Users,
  CreditCard,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  reservationService,
  type ManagedReservationDto,
  type ReservationStatusCounts,
  type TableArea,
} from '@/services/reservationService';
import { getErrorMessage } from '@/services/apiClient';
import { formatVND, getLocalDateString, formatVietnameseDate } from '@/utils/dateUtils';

type DatePreset = 'all' | 'today' | 'tomorrow' | 'next7days' | 'custom';

const getDateRangeForPreset = (
  preset: DatePreset,
  customFrom?: string,
  customTo?: string
): { fromDate?: string; toDate?: string } => {
  const now = new Date();
  switch (preset) {
    case 'today': {
      const todayStr = getLocalDateString(now);
      return { fromDate: todayStr, toDate: todayStr };
    }
    case 'tomorrow': {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = getLocalDateString(tomorrow);
      return { fromDate: tomorrowStr, toDate: tomorrowStr };
    }
    case 'next7days': {
      const startStr = getLocalDateString(now);
      const next7 = new Date(now);
      next7.setDate(next7.getDate() + 7);
      const endStr = getLocalDateString(next7);
      return { fromDate: startStr, toDate: endStr };
    }
    case 'custom': {
      return {
        fromDate: customFrom || undefined,
        toDate: customTo || undefined,
      };
    }
    case 'all':
    default:
      return { fromDate: undefined, toDate: undefined };
  }
};

export const PosOnlineReservationsView: React.FC = () => {
  // Main Data
  const [reservations, setReservations] = useState<ManagedReservationDto[]>([]);
  const [areas, setAreas] = useState<TableArea[]>([]);
  const [counts, setCounts] = useState<ReservationStatusCounts>({
    total: 0,
    pending: 0,
    confirmed: 0,
    seated: 0,
    completed: 0,
    cancelled: 0,
    noShow: 0,
  });

  // Pagination states (Tránh fetch full và render quá tải)
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(12); // Mặc định 12 thẻ/trang: Tối ưu hiệu năng, không đơ lag
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Filter states
  const [activeTab, setActiveTab] = useState<string>('Pending');
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  // Date filters
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customFromDate, setCustomFromDate] = useState<string>(getLocalDateString());
  const [customToDate, setCustomToDate] = useState<string>(getLocalDateString());

  // Advanced filters
  const [selectedAreaId, setSelectedAreaId] = useState<string>('all');
  const [guestFilter, setGuestFilter] = useState<string>('all'); // 'all' | '1-2' | '3-4' | '5-8' | '9+'
  const [sessionFilter, setSessionFilter] = useState<string>('all'); // 'all' | 'lunch' | 'dinner'
  const [depositFilter, setDepositFilter] = useState<string>('all'); // 'all' | 'has_deposit' | 'no_deposit'
  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);

  // Status & Notifications
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Cancellation modal
  const [cancellingReservation, setCancellingReservation] = useState<ManagedReservationDto | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('Khách bận đột xuất xin hủy');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Load Table Areas once on mount
  useEffect(() => {
    void reservationService
      .getAreas()
      .then((data) => setAreas(data || []))
      .catch(() => {});
  }, []);

  // Debounce search input (350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Main data fetch with Server-Side Filtering & Pagination
  const loadReservations = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { fromDate, toDate } = getDateRangeForPreset(datePreset, customFromDate, customToDate);

      const filterParams = {
        status: activeTab === 'ALL' ? undefined : activeTab,
        search: debouncedSearch.trim() || undefined,
        areaId: selectedAreaId !== 'all' ? Number(selectedAreaId) : undefined,
        fromDate,
        toDate,
        page,
        pageSize,
      };

      const res = await reservationService.getManagedReservations(filterParams);

      setReservations(res.items || []);
      setTotalCount(res.totalCount || 0);
      setTotalPages(Math.max(1, res.totalPages || 1));
      setCounts(
        res.counts || {
          total: 0,
          pending: 0,
          confirmed: 0,
          seated: 0,
          completed: 0,
          cancelled: 0,
          noShow: 0,
        }
      );

      // Dispatch event to update sidebar badge
      window.dispatchEvent(
        new CustomEvent('pos-reservations-updated', {
          detail: { pendingCount: res.counts?.pending || 0 },
        })
      );
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, debouncedSearch, datePreset, customFromDate, customToDate, selectedAreaId, page, pageSize]);

  useEffect(() => {
    void loadReservations();
  }, [loadReservations]);

  // Client-side fine-tuning on current page (Guest count, Session, Deposit)
  const displayedReservations = useMemo(() => {
    return reservations.filter((r) => {
      // Guest count filter
      if (guestFilter === '1-2' && (r.guestCount < 1 || r.guestCount > 2)) return false;
      if (guestFilter === '3-4' && (r.guestCount < 3 || r.guestCount > 4)) return false;
      if (guestFilter === '5-8' && (r.guestCount < 5 || r.guestCount > 8)) return false;
      if (guestFilter === '9+' && r.guestCount < 9) return false;

      // Meal session filter (Trưa 10h-15h, Tối 16h-23h)
      if (sessionFilter !== 'all') {
        const hour = new Date(r.reservationTime).getHours();
        if (sessionFilter === 'lunch' && (hour < 10 || hour >= 15)) return false;
        if (sessionFilter === 'dinner' && (hour < 16 || hour >= 23)) return false;
      }

      // Deposit filter
      if (depositFilter === 'has_deposit' && (!r.depositAmount || r.depositAmount <= 0)) return false;
      if (depositFilter === 'no_deposit' && r.depositAmount && r.depositAmount > 0) return false;

      return true;
    });
  }, [reservations, guestFilter, sessionFilter, depositFilter]);

  // Reset all filters to default
  const handleResetFilters = () => {
    setDatePreset('all');
    setCustomFromDate(getLocalDateString());
    setCustomToDate(getLocalDateString());
    setSelectedAreaId('all');
    setGuestFilter('all');
    setSessionFilter('all');
    setDepositFilter('all');
    setSearch('');
    setPage(1);
  };

  // Active filter chips computation
  const activeChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; onRemove: () => void }> = [];

    if (datePreset === 'today') {
      chips.push({
        id: 'date',
        label: `📅 Hôm nay (${formatVietnameseDate(getLocalDateString())})`,
        onRemove: () => {
          setDatePreset('all');
          setPage(1);
        },
      });
    } else if (datePreset === 'tomorrow') {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      chips.push({
        id: 'date',
        label: `📅 Ngày mai (${formatVietnameseDate(getLocalDateString(d))})`,
        onRemove: () => {
          setDatePreset('all');
          setPage(1);
        },
      });
    } else if (datePreset === 'next7days') {
      chips.push({
        id: 'date',
        label: '📅 7 ngày tới',
        onRemove: () => {
          setDatePreset('all');
          setPage(1);
        },
      });
    } else if (datePreset === 'custom') {
      chips.push({
        id: 'date',
        label: `📅 ${formatVietnameseDate(customFromDate)} - ${formatVietnameseDate(customToDate)}`,
        onRemove: () => {
          setDatePreset('all');
          setPage(1);
        },
      });
    }

    if (selectedAreaId !== 'all') {
      const area = areas.find((a) => String(a.dbId) === selectedAreaId);
      chips.push({
        id: 'area',
        label: `📍 Khu: ${area?.name || selectedAreaId}`,
        onRemove: () => {
          setSelectedAreaId('all');
          setPage(1);
        },
      });
    }

    if (guestFilter !== 'all') {
      const labels: Record<string, string> = {
        '1-2': '1 - 2 người',
        '3-4': '3 - 4 người',
        '5-8': '5 - 8 người',
        '9+': 'Tiệc lớn (9+ người)',
      };
      chips.push({
        id: 'guest',
        label: `👥 ${labels[guestFilter] || guestFilter}`,
        onRemove: () => setGuestFilter('all'),
      });
    }

    if (sessionFilter !== 'all') {
      chips.push({
        id: 'session',
        label: sessionFilter === 'lunch' ? '☀️ Ca Trưa (10h-15h)' : '🌙 Ca Tối (16h-23h)',
        onRemove: () => setSessionFilter('all'),
      });
    }

    if (depositFilter !== 'all') {
      chips.push({
        id: 'deposit',
        label: depositFilter === 'has_deposit' ? '💵 Có đặt cọc' : '⚪ Không cọc',
        onRemove: () => setDepositFilter('all'),
      });
    }

    if (search.trim()) {
      chips.push({
        id: 'search',
        label: `🔍 "${search.trim()}"`,
        onRemove: () => setSearch(''),
      });
    }

    return chips;
  }, [datePreset, customFromDate, customToDate, selectedAreaId, areas, guestFilter, sessionFilter, depositFilter, search]);

  const activeFiltersCount = activeChips.length;

  // Actions
  const handleConfirmReservation = async (res: ManagedReservationDto) => {
    setErrorMsg(null);
    try {
      await reservationService.confirmReservation(res.reservationId);
      setSuccessMsg(`Đã duyệt nhận đặt bàn "${res.reservationCode}" của khách ${res.customerName}.`);
      await loadReservations();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    }
  };

  const handleCheckInGuest = async (res: ManagedReservationDto) => {
    setErrorMsg(null);
    try {
      await reservationService.checkInGuest(res.reservationId);
      setSuccessMsg(`Đã check-in đón khách ${res.customerName} vào bàn.`);
      await loadReservations();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    }
  };

  const handleMarkNoShow = async (res: ManagedReservationDto) => {
    if (!window.confirm(`Đánh dấu khách ${res.customerName} không đến (No-Show)?`)) return;
    setErrorMsg(null);
    try {
      await reservationService.markNoShow(res.reservationId, 'Khách quá giờ không đến');
      setSuccessMsg(`Đã đánh dấu No-Show cho đơn đặt bàn ${res.reservationCode}.`);
      await loadReservations();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    }
  };

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingReservation) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await reservationService.cancelReservation(cancellingReservation.reservationId, cancelReason);
      setSuccessMsg(`Đã hủy đặt bàn "${cancellingReservation.reservationCode}".`);
      setCancellingReservation(null);
      await loadReservations();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'Pending':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-50 text-amber-800 border border-amber-300">
            Chờ xác nhận
          </span>
        );
      case 'Confirmed':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-50 text-blue-700 border border-blue-200">
            Đã xác nhận
          </span>
        );
      case 'Seated':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
            Đang phục vụ
          </span>
        );
      case 'Completed':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-slate-100 text-slate-700 border border-slate-200">
            Đã hoàn thành
          </span>
        );
      case 'Cancelled':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-50 text-rose-700 border border-rose-200">
            Đã hủy
          </span>
        );
      case 'NoShow':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-50 text-purple-700 border border-purple-200">
            Không đến
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  // Render Numeric Page Buttons
  const renderPaginationButtons = () => {
    const buttons: React.ReactNode[] = [];
    const maxVisible = 5;
    let startPage = Math.max(1, page - 2);
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
      buttons.push(
        <button
          key={1}
          type="button"
          onClick={() => setPage(1)}
          className="w-8 h-8 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          1
        </button>
      );
      if (startPage > 2) {
        buttons.push(
          <span key="dots-start" className="px-1 text-xs text-slate-400 select-none">
            ...
          </span>
        );
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <button
          key={i}
          type="button"
          onClick={() => setPage(i)}
          className={`w-8 h-8 rounded-lg text-xs font-extrabold transition-all ${
            page === i
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          {i}
        </button>
      );
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        buttons.push(
          <span key="dots-end" className="px-1 text-xs text-slate-400 select-none">
            ...
          </span>
        );
      }
      buttons.push(
        <button
          key={totalPages}
          type="button"
          onClick={() => setPage(totalPages)}
          className="w-8 h-8 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          {totalPages}
        </button>
      );
    }

    return buttons;
  };

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black uppercase text-slate-950 flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-emerald-600 shrink-0" />
            <span>Quản Lý Lịch Đặt Bàn Trực Tuyến</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Theo dõi khách hàng đặt bàn trước trên website, số lượng khách, tiền cọc và duyệt đón tiếp vào bàn
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void loadReservations()}
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 transition-colors"
            title="Tải lại danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg(null)} className="text-red-600 hover:text-red-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Control Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3.5">
        {/* Row 1: Quick Date Presets & Search & Advanced Toggle */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
            <span className="text-slate-400 text-[11px] uppercase tracking-wider mr-1 font-extrabold flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Thời gian:</span>
            </span>

            <button
              type="button"
              onClick={() => {
                setDatePreset('all');
                setPage(1);
              }}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                datePreset === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Tất Cả
            </button>

            <button
              type="button"
              onClick={() => {
                setDatePreset('today');
                setPage(1);
              }}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                datePreset === 'today'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Hôm Nay
            </button>

            <button
              type="button"
              onClick={() => {
                setDatePreset('tomorrow');
                setPage(1);
              }}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                datePreset === 'tomorrow'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Ngày Mai
            </button>

            <button
              type="button"
              onClick={() => {
                setDatePreset('next7days');
                setPage(1);
              }}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                datePreset === 'next7days'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              7 Ngày Tới
            </button>

            <button
              type="button"
              onClick={() => {
                setDatePreset('custom');
                setIsAdvancedOpen(true);
                setPage(1);
              }}
              className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                datePreset === 'custom'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>Khoảng Ngày</span>
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          {/* Search Box & Advanced Toggle */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm tên khách, số điện thoại, mã..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-600 transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                isAdvancedOpen || activeFiltersCount > 0
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
              title="Bộ lọc nâng cao"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Bộ Lọc</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
              {isAdvancedOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Collapsible Advanced Filters Panel */}
        {isAdvancedOpen && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-slate-50/60 p-3.5 rounded-xl">
            {/* Custom Date Range */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-500" />
                <span>Từ ngày:</span>
              </label>
              <input
                type="date"
                value={customFromDate}
                onChange={(e) => {
                  setCustomFromDate(e.target.value);
                  setDatePreset('custom');
                  setPage(1);
                }}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-600"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-500" />
                <span>Đến ngày:</span>
              </label>
              <input
                type="date"
                value={customToDate}
                onChange={(e) => {
                  setCustomToDate(e.target.value);
                  setDatePreset('custom');
                  setPage(1);
                }}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-600"
              />
            </div>

            {/* Area Filter */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-500" />
                <span>Khu vực bàn:</span>
              </label>
              <select
                value={selectedAreaId}
                onChange={(e) => {
                  setSelectedAreaId(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600"
              >
                <option value="all">Tất cả khu vực</option>
                {areas.map((a) => (
                  <option key={a.dbId} value={String(a.dbId)}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Guest Count Range */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700 flex items-center gap-1">
                <Users className="w-3 h-3 text-slate-500" />
                <span>Số lượng khách:</span>
              </label>
              <select
                value={guestFilter}
                onChange={(e) => setGuestFilter(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600"
              >
                <option value="all">Tất cả số khách</option>
                <option value="1-2">1 - 2 người (Bàn đôi)</option>
                <option value="3-4">3 - 4 người (Gia đình)</option>
                <option value="5-8">5 - 8 người (Nhóm vừa)</option>
                <option value="9+">Từ 9 khách trở lên (Tiệc)</option>
              </select>
            </div>

            {/* Meal Session & Deposit Status */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" />
                <span>Khung giờ / Ca:</span>
              </label>
              <select
                value={sessionFilter}
                onChange={(e) => setSessionFilter(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600"
              >
                <option value="all">Tất cả khung giờ</option>
                <option value="lunch">Ca Trưa (10:00 - 15:00)</option>
                <option value="dinner">Ca Tối (16:00 - 23:00)</option>
              </select>
            </div>
          </div>
        )}

        {/* Row 2: Status Tab Filters */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold pt-1 border-t border-slate-100">
          <button
            type="button"
            onClick={() => {
              setActiveTab('Pending');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'Pending'
                ? 'bg-amber-600 text-white shadow-sm font-black'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>Chờ Xác Nhận</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono">
              {counts.pending}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('Confirmed');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'Confirmed'
                ? 'bg-blue-600 text-white shadow-sm font-black'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>Đã Xác Nhận</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono">
              {counts.confirmed}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('Seated');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'Seated'
                ? 'bg-emerald-600 text-white shadow-sm font-black'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>Đang Phục Vụ</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono">
              {counts.seated}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('Completed');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'Completed'
                ? 'bg-slate-800 text-white shadow-sm font-black'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>Hoàn Tất</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono">
              {counts.completed}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('Cancelled');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'Cancelled'
                ? 'bg-rose-700 text-white shadow-sm font-black'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>Đã Hủy</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono">
              {counts.cancelled}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('NoShow');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'NoShow'
                ? 'bg-purple-700 text-white shadow-sm font-black'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>Không Đến</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono">
              {counts.noShow}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('ALL');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'ALL'
                ? 'bg-slate-950 text-white shadow-sm font-black'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>Tất Cả</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono">
              {counts.total}
            </span>
          </button>
        </div>

        {/* Row 3: Active Filter Chips */}
        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-400 font-semibold text-[11px]">Đang lọc theo:</span>
            {activeChips.map((chip) => (
              <span
                key={chip.id}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium"
              >
                <span>{chip.label}</span>
                <button
                  type="button"
                  onClick={chip.onRemove}
                  className="p-0.5 rounded-full hover:bg-emerald-200/50 text-emerald-600 hover:text-emerald-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            <button
              type="button"
              onClick={handleResetFilters}
              className="text-slate-500 hover:text-red-600 text-xs font-semibold flex items-center gap-1 ml-auto"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Đặt lại bộ lọc</span>
            </button>
          </div>
        )}
      </div>

      {/* Summary count info bar */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <div>
          Tổng cộng tìm thấy <strong className="text-slate-900">{totalCount}</strong> lịch đặt bàn
          {displayedReservations.length !== reservations.length && (
            <span> (Hiển thị {displayedReservations.length} thẻ khớp bộ lọc nâng cao)</span>
          )}
        </div>
        <div className="text-[11px] text-slate-400">
          Trang {page} / {totalPages}
        </div>
      </div>

      {/* Reservations Grid List */}
      <div className="space-y-4">
        {isLoading && reservations.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-xs text-slate-500 space-y-2">
            <RefreshCw className="w-6 h-6 mx-auto text-emerald-600 animate-spin" />
            <p>Đang tải danh sách đặt bàn từ SQL Server...</p>
          </div>
        ) : displayedReservations.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3 shadow-xs">
            <CalendarCheck className="w-10 h-10 mx-auto text-slate-300" />
            <h3 className="text-sm font-bold text-slate-800">Không tìm thấy lịch đặt bàn nào</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Không có dữ liệu phù hợp với khoảng thời gian, khu vực hoặc trạng thái bạn đang chọn.
            </p>
            {activeChips.length > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Xóa bộ lọc để xem toàn bộ</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedReservations.map((r) => (
              <div
                key={r.reservationId}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3 hover:border-slate-300 transition-all hover:shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                    <div>
                      <span className="font-mono font-black text-xs text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {r.reservationCode}
                      </span>
                      <h3 className="font-extrabold text-sm text-slate-950 mt-1">{r.customerName}</h3>
                    </div>
                    {renderStatusBadge(r.status)}
                  </div>

                  <div className="pt-2.5 space-y-1.5 text-xs">
                    <p className="text-slate-700 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-semibold">{r.customerPhone}</span>
                    </p>

                    <p className="text-slate-700 flex items-center gap-1.5 font-semibold text-emerald-700">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Giờ đến:{' '}
                        {new Date(r.reservationTime).toLocaleString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </span>
                    </p>

                    <p className="text-slate-600 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        Số khách: <strong>{r.guestCount} người</strong>
                        {r.preferredAreaName ? ` • Khu: ${r.preferredAreaName}` : ''}
                      </span>
                    </p>

                    {r.assignedTableNumber && (
                      <p className="text-emerald-700 flex items-center gap-1.5 font-bold">
                        <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>Bàn chỉ định: {r.assignedTableNumber}</span>
                      </p>
                    )}

                    {r.depositAmount > 0 && (
                      <p className="text-amber-800 text-[11px] font-semibold flex items-center gap-1">
                        <CreditCard className="w-3 h-3 text-amber-600 shrink-0" />
                        <span>
                          Tiền cọc: {formatVND(r.depositAmount)} ({r.depositStatus})
                        </span>
                      </p>
                    )}

                    {r.specialRequests && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[11px] text-amber-900 mt-1">
                        Yêu cầu đặc biệt: {r.specialRequests}
                      </div>
                    )}

                    {r.allergies && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-[11px] text-red-900 mt-1">
                        Dị ứng món: {r.allergies}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                  {r.status === 'Pending' && (
                    <button
                      type="button"
                      onClick={() => void handleConfirmReservation(r)}
                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Duyệt Nhận Bàn</span>
                    </button>
                  )}

                  {r.status === 'Confirmed' && (
                    <button
                      type="button"
                      onClick={() => void handleCheckInGuest(r)}
                      className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1 transition-colors"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Đón Khách Vào Bàn</span>
                    </button>
                  )}

                  {(r.status === 'Pending' || r.status === 'Confirmed') && (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleMarkNoShow(r)}
                        className="p-2 border border-slate-200 hover:bg-amber-50 text-amber-700 rounded-xl transition-colors"
                        title="Báo khách không đến (No-Show)"
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setCancellingReservation(r);
                          setCancelReason('Khách bận đột xuất xin hủy');
                        }}
                        className="p-2 border border-slate-200 hover:bg-red-50 text-red-600 rounded-xl transition-colors"
                        title="Hủy đặt bàn"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination Controls - Tối ưu chống nặng máy */}
      {totalPages > 1 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500 font-medium">
            Hiển thị <span className="font-bold text-slate-900">{(page - 1) * pageSize + 1}</span> -{' '}
            <span className="font-bold text-slate-900">{Math.min(page * pageSize, totalCount)}</span> trên tổng số{' '}
            <span className="font-bold text-emerald-700">{totalCount}</span> lịch đặt bàn
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => {
                setPage(1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="Trang đầu"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              disabled={page <= 1}
              onClick={() => {
                setPage((p) => Math.max(1, p - 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="Trang trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Numeric buttons */}
            {renderPaginationButtons()}

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => {
                setPage((p) => Math.min(totalPages, p + 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="Trang sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => {
                setPage(totalPages);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="Trang cuối"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>

          {/* Page size select */}
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span>Hiển thị:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600"
            >
              <option value={12}>12 thẻ / trang (Mặc định)</option>
              <option value={24}>24 thẻ / trang</option>
              <option value={36}>36 thẻ / trang</option>
              <option value={48}>48 thẻ / trang</option>
            </select>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancellingReservation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-extrabold text-sm uppercase text-slate-950 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-600" />
                <span>Hủy Đặt Bàn</span>
              </h3>
              <button
                type="button"
                onClick={() => setCancellingReservation(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmCancel} className="p-5 space-y-3.5">
              <p className="text-xs text-slate-600">
                Bạn đang thực hiện hủy lịch đặt của khách{' '}
                <strong>{cancellingReservation.customerName}</strong> ({cancellingReservation.reservationCode}).
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Lý do hủy:</label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-900 outline-none focus:border-red-600"
                >
                  <option value="Khách bận đột xuất xin hủy">Khách bận đột xuất xin hủy</option>
                  <option value="Nhà hàng hết bàn vào giờ này">Nhà hàng hết bàn vào giờ này</option>
                  <option value="Không liên lạc được với khách">Không liên lạc được với khách</option>
                  <option value="Khách yêu cầu đổi ngày khác">Khách yêu cầu đổi ngày khác</option>
                </select>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs uppercase rounded-xl transition-colors"
                >
                  {isSubmitting ? 'Đang hủy...' : 'Xác Nhận Hủy Lịch'}
                </button>
                <button
                  type="button"
                  onClick={() => setCancellingReservation(null)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
                >
                  Đóng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
