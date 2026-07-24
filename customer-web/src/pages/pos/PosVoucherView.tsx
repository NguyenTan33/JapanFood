import React, { useState, useEffect, useCallback } from 'react';
import {
  Tag,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Power,
  Copy,
  Calendar,
  DollarSign,
  Percent,
  X,
  RefreshCw,
} from 'lucide-react';
import { voucherService } from '@/services/voucherService';
import { Voucher } from '@/types';
import { formatVND } from '@/utils/dateUtils';
import { getErrorMessage } from '@/services/apiClient';

export const PosVoucherView: React.FC = () => {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modal Create
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formCode, setFormCode] = useState('');
  const [formType, setFormType] = useState<'PERCENTAGE' | 'FIXED_AMOUNT'>('PERCENTAGE');
  const [formValue, setFormValue] = useState<number>(10);
  const [formMinOrder, setFormMinOrder] = useState<number>(0);
  const [formMaxDiscount, setFormMaxDiscount] = useState<number>(100000);
  const [formStartDate, setFormStartDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [formEndDate, setFormEndDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [formLimit, setFormLimit] = useState<number>(100);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchVouchers = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await voucherService.getAllVouchers();
      setVouchers(data);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchVouchers();
  }, [fetchVouchers]);

  const handleToggleStatus = async (v: Voucher) => {
    try {
      if (v.isActive) {
        await voucherService.deactivateVoucher(v.id);
        setSuccessMsg(`Đã tạm ngưng áp dụng voucher "${v.code}".`);
      } else {
        await voucherService.activateVoucher(v.id);
        setSuccessMsg(`Đã kích hoạt lại voucher "${v.code}".`);
      }
      await fetchVouchers();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    }
  };

  const handleDelete = async (id: number, code: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn voucher "${code}"?`)) {
      return;
    }
    try {
      await voucherService.deleteVoucher(id);
      setSuccessMsg(`Đã xóa voucher "${code}" thành công.`);
      await fetchVouchers();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setSuccessMsg(`Đã sao chép mã "${code}" vào bộ nhớ tạm!`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim()) {
      setErrorMsg('Vui lòng nhập mã Voucher.');
      return;
    }
    if (formValue <= 0) {
      setErrorMsg('Giá trị giảm giá phải lớn hơn 0.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const payload = {
        voucherCode: formCode.trim().toUpperCase(),
        discountType: formType === 'PERCENTAGE' ? 1 : 2, // 1 = Percentage, 2 = FixedAmount
        discountValue: Number(formValue),
        minOrderAmount: Number(formMinOrder) || 0,
        maxDiscountAmount: formType === 'PERCENTAGE' && formMaxDiscount ? Number(formMaxDiscount) : null,
        startDate: new Date(formStartDate).toISOString(),
        endDate: new Date(formEndDate + 'T23:59:59').toISOString(),
        usageLimit: Number(formLimit) || 100,
      };

      await voucherService.createVoucher(payload);
      setSuccessMsg(`Tạo mã voucher "${payload.voucherCode}" thành công!`);
      setIsCreateOpen(false);
      setFormCode('');
      await fetchVouchers();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredVouchers = vouchers.filter((v) => {
    if (statusFilter === 'ACTIVE' && !v.isActive) return false;
    if (statusFilter === 'INACTIVE' && v.isActive) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        v.code.toLowerCase().includes(q) ||
        (v.title && v.title.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const activeCount = vouchers.filter((v) => v.isActive).length;
  const percentageCount = vouchers.filter((v) => v.discountType === 'PERCENTAGE').length;
  const fixedCount = vouchers.filter((v) => v.discountType !== 'PERCENTAGE').length;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto animate-fade-in">
      {/* Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm">
            <Tag className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Quản Lý Voucher & Khuyến Mãi
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Phát hành mã giảm giá, kiểm soát tỷ lệ chiết khấu và thời hạn áp dụng tại POS & QR.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void fetchVouchers()}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            title="Làm mới danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm flex items-center gap-2 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo Voucher Mới</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Tổng Voucher</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{vouchers.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wider">Đang Kích Hoạt</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-amber-600 font-semibold uppercase tracking-wider">Chiết Khấu %</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{percentageCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider">Giảm Tiền Mặt (VNĐ)</p>
          <p className="text-2xl font-black text-blue-600 mt-1">{fixedCount}</p>
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo mã voucher hoặc tiêu đề..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl pl-9 pr-4 py-2 text-xs font-medium text-slate-800 outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === tab
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab === 'ALL'
                ? 'Tất cả'
                : tab === 'ACTIVE'
                ? 'Đang hoạt động'
                : 'Tạm dừng'}
            </button>
          ))}
        </div>
      </div>

      {/* Vouchers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Mã Voucher</th>
                <th className="py-3 px-4">Hình thức giảm</th>
                <th className="py-3 px-4">Giá trị giảm</th>
                <th className="py-3 px-4">Đơn tối thiểu</th>
                <th className="py-3 px-4">Giảm tối đa</th>
                <th className="py-3 px-4">Thời hạn áp dụng</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    <span>Đang tải danh sách voucher...</span>
                  </td>
                </tr>
              ) : filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Tag className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <span>Không có voucher nào phù hợp với điều kiện tìm kiếm.</span>
                  </td>
                </tr>
              ) : (
                filteredVouchers.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-300 tracking-wide">
                          {v.code}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(v.code)}
                          className="p-1 rounded text-slate-400 hover:text-slate-800"
                          title="Sao chép mã"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {v.discountType === 'PERCENTAGE' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <Percent className="w-3 h-3" />
                          <span>Phần trăm (%)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                          <DollarSign className="w-3 h-3" />
                          <span>Tiền mặt (VNĐ)</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-black text-sm text-slate-900">
                      {v.discountType === 'PERCENTAGE'
                        ? `${v.discountValue}%`
                        : formatVND(v.discountValue)}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {v.minOrderAmount > 0 ? formatVND(v.minOrderAmount) : '0 đ'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {v.maxDiscountAmount ? formatVND(v.maxDiscountAmount) : 'Không giới hạn'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {new Date(v.startDate).toLocaleDateString('vi-VN')} -{' '}
                          {new Date(v.endDate).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          v.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            v.isActive ? 'bg-emerald-600' : 'bg-slate-400'
                          }`}
                        />
                        <span>{v.isActive ? 'Hoạt động' : 'Tạm dừng'}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handleToggleStatus(v)}
                          className={`p-2 rounded-lg border text-xs font-semibold transition-colors ${
                            v.isActive
                              ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                              : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          }`}
                          title={v.isActive ? 'Tạm ngưng kích hoạt' : 'Kích hoạt lại'}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(v.id, v.code)}
                          className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                          title="Xóa voucher"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Create Voucher */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-black text-slate-900">Tạo Mã Voucher Mới</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateVoucher} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Mã Voucher *
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: SAKURA50, VIPMEMBER..."
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 rounded-xl px-4 py-2.5 font-mono font-bold text-slate-900 uppercase text-sm outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Hình thức giảm
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 outline-none"
                  >
                    <option value="PERCENTAGE">Phần trăm (%)</option>
                    <option value="FIXED_AMOUNT">Số tiền cố định (VNĐ)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    {formType === 'PERCENTAGE' ? 'Giá trị giảm (%) *' : 'Số tiền giảm (VNĐ) *'}
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={formType === 'PERCENTAGE' ? 100 : 10000000}
                    value={formValue}
                    onChange={(e) => setFormValue(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Đơn hàng tối thiểu (VNĐ)
                  </label>
                  <input
                    type="number"
                    step={1000}
                    value={formMinOrder}
                    onChange={(e) => setFormMinOrder(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-900 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Giảm tối đa (VNĐ)
                  </label>
                  <input
                    type="number"
                    step={1000}
                    disabled={formType !== 'PERCENTAGE'}
                    value={formMaxDiscount}
                    onChange={(e) => setFormMaxDiscount(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-900 outline-none font-mono disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Ngày bắt đầu
                  </label>
                  <input
                    type="date"
                    required
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Ngày kết thúc
                  </label>
                  <input
                    type="date"
                    required
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Số lượt phát hành tối đa
                </label>
                <input
                  type="number"
                  min={1}
                  value={formLimit}
                  onChange={(e) => setFormLimit(Number(e.target.value) || 1)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 rounded-xl px-4 py-2 text-xs font-medium text-slate-900 outline-none font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {isSubmitting ? 'Đang tạo...' : 'Xác Nhận Tạo Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
