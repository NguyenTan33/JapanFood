import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Calendar,
  Layers,
  Utensils,
  CreditCard,
  Banknote,
  RefreshCw,
  AlertTriangle,
  Download,
  Filter,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';
import {
  reportService,
  DetailedRevenueReport,
  SoldDishItemReport,
  RevenueReportPoint,
} from '@/services/reportService';
import { reservationService, TableItemDto } from '@/services/reservationService';
import { menuService } from '@/services/menuService';
import { getErrorMessage } from '@/services/apiClient';
import { formatVND } from '@/utils/dateUtils';
import { Dish, Category } from '@/types';

// SVG Line Chart Component
function RevenueLineChart({ points }: { points: RevenueReportPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!points || points.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-slate-400 italic">
        Chưa có dữ liệu doanh thu trong khoảng thời gian đã chọn.
      </div>
    );
  }

  const maxRevenue = Math.max(...points.map((p) => p.totalRevenue), 1000000);
  const chartHeight = 220;
  const chartWidth = 700;
  const paddingX = 40;
  const paddingY = 30;
  const innerWidth = chartWidth - paddingX * 2;
  const innerHeight = chartHeight - paddingY * 2;

  const getX = (idx: number) => {
    if (points.length === 1) return paddingX + innerWidth / 2;
    return paddingX + (idx / (points.length - 1)) * innerWidth;
  };

  const getY = (val: number) => {
    return paddingY + innerHeight - (val / maxRevenue) * innerHeight;
  };

  const linePath = points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(p.totalRevenue)}`)
    .join(' ');

  const areaPath = `${linePath} L ${getX(points.length - 1)} ${paddingY + innerHeight} L ${getX(
    0
  )} ${paddingY + innerHeight} Z`;

  return (
    <div className="relative w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-64 overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#059669" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = paddingY + innerHeight * (1 - ratio);
          return (
            <g key={ratio}>
              <line
                x1={paddingX}
                y1={y}
                x2={chartWidth - paddingX}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray="4 4"
              />
              <text
                x={paddingX - 8}
                y={y + 3}
                textAnchor="end"
                className="text-[9px] fill-slate-400 font-mono font-bold"
              >
                {formatVND(maxRevenue * ratio).replace('₫', '')}
              </text>
            </g>
          );
        })}

        {/* Gradient Area Fill */}
        <path d={areaPath} fill="url(#revenueGradient)" />

        {/* Line Stroke */}
        <path
          d={linePath}
          fill="none"
          stroke="#059669"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data Circles & Hover areas */}
        {points.map((p, idx) => {
          const x = getX(idx);
          const y = getY(p.totalRevenue);
          const isHovered = hoverIndex === idx;

          return (
            <g key={idx} onMouseEnter={() => setHoverIndex(idx)} onMouseLeave={() => setHoverIndex(null)}>
              {isHovered && (
                <line
                  x1={x}
                  y1={paddingY}
                  x2={x}
                  y2={paddingY + innerHeight}
                  stroke="#10b981"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
              )}
              <circle
                cx={x}
                cy={y}
                r={isHovered ? 6 : 4}
                className={`transition-all ${
                  isHovered ? 'fill-emerald-600 stroke-white stroke-2 shadow-md' : 'fill-white stroke-emerald-600 stroke-2'
                }`}
              />
              {/* X-axis labels */}
              {(points.length <= 10 || idx % Math.ceil(points.length / 8) === 0 || idx === points.length - 1) && (
                <text
                  x={x}
                  y={chartHeight - 6}
                  textAnchor="middle"
                  className="text-[10px] fill-slate-500 font-mono font-medium"
                >
                  {new Date(p.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Hover Info Tooltip */}
      {hoverIndex !== null && points[hoverIndex] && (
        <div
          className="absolute z-10 pointer-events-none bg-slate-900 text-white p-2.5 rounded-xl shadow-xl border border-slate-700 text-xs"
          style={{
            left: `${(getX(hoverIndex) / chartWidth) * 100}%`,
            top: '20px',
            transform: 'translateX(-50%)',
          }}
        >
          <p className="font-bold text-[11px] text-emerald-400">
            {new Date(points[hoverIndex].date).toLocaleDateString('vi-VN', {
              weekday: 'short',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </p>
          <p className="font-mono font-black text-sm">{formatVND(points[hoverIndex].totalRevenue)}</p>
          <p className="text-[10px] text-slate-300">{points[hoverIndex].totalOrders} đơn hàng</p>
        </div>
      )}
    </div>
  );
}

export const PosReportsView: React.FC = () => {
  const [report, setReport] = useState<DetailedRevenueReport | null>(null);
  const [tables, setTables] = useState<TableItemDto[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter States
  const [presetFilter, setPresetFilter] = useState<'today' | 'yesterday' | '7days' | 'month' | 'custom'>('7days');
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedTableId, setSelectedTableId] = useState<string>('ALL');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [selectedDishId, setSelectedDishId] = useState<string>('ALL');
  const [soldItemsSearch, setSoldItemsSearch] = useState('');

  const loadReferenceData = useCallback(async () => {
    try {
      const [tList, cList, dRes] = await Promise.all([
        reservationService.getAllTablesForAdmin().catch(() => []),
        menuService.getCategories().catch(() => []),
        menuService.getDishes({ pageSize: 200, includeUnavailable: true }).catch(() => ({ items: [] })),
      ]);
      setTables(tList || []);
      setCategories(cList || []);
      setDishes(dRes?.items || []);
    } catch {
      // Ignored
    }
  }, []);

  const filteredDishesForSelect = useMemo(() => {
    if (selectedCategoryId === 'ALL') return dishes;
    const catDbId = Number(selectedCategoryId);
    const catObj = categories.find((c) => c.dbId === catDbId);
    return dishes.filter(
      (d) =>
        d.categoryDbId === catDbId ||
        (catObj && (d.categoryId === catObj.id || d.categoryName === catObj.name))
    );
  }, [dishes, categories, selectedCategoryId]);

  const loadReport = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const start = fromDate ? `${fromDate}T00:00:00Z` : undefined;
      const end = toDate ? `${toDate}T23:59:59Z` : undefined;

      const res = await reportService.getDetailedReport({
        fromDate: start,
        toDate: end,
        tableId: selectedTableId !== 'ALL' ? Number(selectedTableId) : undefined,
        categoryId: selectedCategoryId !== 'ALL' ? Number(selectedCategoryId) : undefined,
        menuItemId: selectedDishId !== 'ALL' ? Number(selectedDishId) : undefined,
      });
      setReport(res);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, toDate, selectedTableId, selectedCategoryId, selectedDishId]);

  useEffect(() => {
    void loadReferenceData();
  }, [loadReferenceData]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const handleApplyPreset = (preset: 'today' | 'yesterday' | '7days' | 'month') => {
    setPresetFilter(preset);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (preset === 'today') {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      setFromDate(yStr);
      setToDate(yStr);
    } else if (preset === '7days') {
      const d7 = new Date();
      d7.setDate(d7.getDate() - 7);
      setFromDate(d7.toISOString().split('T')[0]);
      setToDate(todayStr);
    } else if (preset === 'month') {
      const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
      setFromDate(mStart.toISOString().split('T')[0]);
      setToDate(todayStr);
    }
  };

  const filteredSoldItems = useMemo(() => {
    if (!report?.soldItems) return [];
    if (!soldItemsSearch.trim()) return report.soldItems;
    const q = soldItemsSearch.toLowerCase().trim();
    return report.soldItems.filter(
      (it) =>
        it.dishName.toLowerCase().includes(q) ||
        it.orderNumber.toLowerCase().includes(q) ||
        (it.tableNumber && it.tableNumber.toLowerCase().includes(q))
    );
  }, [report?.soldItems, soldItemsSearch]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black uppercase text-slate-950 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-600" />
            <span>Báo Cáo Doanh Thu &amp; Phân Tích Món Ăn Bán Ra</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Dữ liệu doanh thu thực tế từ SQL Server: lọc nâng cao theo ngày, tháng, món, bàn và chi tiết từng món đã bán
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadReport()}
          className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 shrink-0"
          title="Tải lại báo cáo"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Advanced Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => handleApplyPreset('today')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                presetFilter === 'today'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Hôm Nay
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('yesterday')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                presetFilter === 'yesterday'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Hôm Qua
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('7days')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                presetFilter === '7days'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              7 Ngày Qua
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('month')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                presetFilter === 'month'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Tháng Này
            </button>
          </div>

          <div className="text-xs font-semibold text-slate-500">
            Khoảng thời gian: <strong className="text-slate-900">{fromDate}</strong> đến{' '}
            <strong className="text-slate-900">{toDate}</strong>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Từ ngày:</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPresetFilter('custom');
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-600"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Đến ngày:</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPresetFilter('custom');
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-600"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Lọc theo bàn:</label>
            <select
              value={selectedTableId}
              onChange={(e) => setSelectedTableId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-600"
            >
              <option value="ALL">Tất cả bàn</option>
              {tables.map((t) => (
                <option key={t.tableId} value={String(t.tableId)}>
                  {t.tableNumber} ({t.areaName})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Lọc theo danh mục món:</label>
            <select
              value={selectedCategoryId}
              onChange={(e) => {
                setSelectedCategoryId(e.target.value);
                setSelectedDishId('ALL');
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-600"
            >
              <option value="ALL">Tất cả danh mục</option>
              {categories.map((cat) => (
                <option key={cat.dbId || cat.id} value={String(cat.dbId || '')}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Lọc theo món ăn:</label>
            <select
              value={selectedDishId}
              onChange={(e) => setSelectedDishId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-600"
            >
              <option value="ALL">Tất cả món ăn</option>
              {filteredDishesForSelect.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1 shadow-xs">
          <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
            TỔNG DOANH THU THỰC
          </span>
          <p className="text-2xl font-black text-emerald-700 font-mono">
            {formatVND(report?.totalRevenue ?? 0)}
          </p>
          <span className="text-[11px] text-slate-600">
            Thuần: {formatVND(report?.netSales ?? 0)} • Thuế VAT: {formatVND(report?.totalTax ?? 0)}
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1 shadow-xs">
          <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
            TIỀN MẶT THU NGÂN
          </span>
          <p className="text-2xl font-black text-emerald-600 font-mono">
            {formatVND(report?.cashRevenue ?? 0)}
          </p>
          <span className="text-[11px] text-slate-500">
            Tỷ trọng:{' '}
            {report?.totalRevenue
              ? `${Math.round(((report.cashRevenue || 0) / report.totalRevenue) * 100)}%`
              : '0%'}
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1 shadow-xs">
          <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
            CHUYỂN KHOẢN VIETQR
          </span>
          <p className="text-2xl font-black text-blue-600 font-mono">
            {formatVND(report?.transferRevenue ?? 0)}
          </p>
          <span className="text-[11px] text-slate-500">
            Tỷ trọng:{' '}
            {report?.totalRevenue
              ? `${Math.round(((report.transferRevenue || 0) / report.totalRevenue) * 100)}%`
              : '0%'}
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1 shadow-xs">
          <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
            SỐ LƯỢNG MÓN ĐÃ BÁN
          </span>
          <p className="text-2xl font-black text-purple-600 font-mono">
            {report?.totalDishesSold ?? 0} phần
          </p>
          <span className="text-[11px] text-slate-500">
            Tổng cộng {report?.totalOrders ?? 0} đơn hàng đã hoàn tất
          </span>
        </div>
      </div>

      {/* Line Chart & Top Dishes Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Line Chart (8 cols) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>Biểu Đồ Xu Hướng Doanh Thu Theo Ngày</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              {report?.chartPoints?.length ?? 0} mốc dữ liệu
            </span>
          </div>

          <RevenueLineChart points={report?.chartPoints || []} />
        </div>

        {/* Top Selling Dishes (4 cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Utensils className="w-4 h-4 text-emerald-600" />
                <span>Top Món Bán Chạy Nhất</span>
              </h3>
            </div>

            {(!report?.topDishes || report.topDishes.length === 0) ? (
              <p className="text-xs text-slate-400 py-6 text-center italic">
                Chưa có dữ liệu món bán chạy trong kỳ.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {report.topDishes.slice(0, 6).map((dish, idx) => (
                  <div key={dish.menuItemId} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-extrabold text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <p className="font-bold text-slate-900 truncate">{dish.itemName}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-emerald-700 font-mono">{formatVND(dish.totalRevenue)}</p>
                      <p className="text-[10px] text-slate-500">{dish.totalQuantitySold} phần</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Sold Dishes History Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs space-y-3 p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Lịch Sử Chi Tiết Các Món Đã Bán Ra Cấu Thành Doanh Thu ({filteredSoldItems.length})</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Tra cứu chính xác từng món ăn, số bàn phục vụ, đơn giá, thời gian hoàn thành đơn từ SQL Server
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Tìm theo món, bàn, mã đơn..."
              value={soldItemsSearch}
              onChange={(e) => setSoldItemsSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-600"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-bold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="py-2.5 px-3">Tên Món Ăn</th>
                <th className="py-2.5 px-3">Bàn Phục Vụ</th>
                <th className="py-2.5 px-3">Mã Đơn Hàng</th>
                <th className="py-2.5 px-3 text-center">Số Lượng</th>
                <th className="py-2.5 px-3 text-right">Đơn Giá</th>
                <th className="py-2.5 px-3 text-right">Thành Tiền</th>
                <th className="py-2.5 px-3 text-center">Thanh Toán</th>
                <th className="py-2.5 px-3 text-right">Thời Gian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSoldItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                    Không tìm thấy dữ liệu món ăn bán ra nào trong bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredSoldItems.map((item, idx) => (
                  <tr key={`${item.orderId}-${item.menuItemId}-${idx}`} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3">
                      <p className="font-bold text-slate-950">{item.dishName}</p>
                      {item.modifiersSummary && (
                        <p className="text-[10px] text-slate-500 italic">+ {item.modifiersSummary}</p>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      {item.tableNumber || 'Bàn --'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600 text-[11px]">
                      {item.orderNumber}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold font-mono text-slate-900">
                      x{item.quantity}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                      {formatVND(item.unitPrice)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-extrabold text-emerald-700">
                      {formatVND(item.totalPrice)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        item.paymentMethod === 'Cash' || item.paymentMethod === 'CASH'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        {item.paymentMethod === 'Cash' || item.paymentMethod === 'CASH' ? 'Tiền mặt' : 'VietQR'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-500 font-mono text-[11px]">
                      {new Date(item.completedAt).toLocaleString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
