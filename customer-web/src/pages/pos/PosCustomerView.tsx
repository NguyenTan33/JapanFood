import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Award,
  Phone,
  Calendar,
  CreditCard,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  User,
  Sparkles,
} from 'lucide-react';
import { posService, PosCustomer } from '@/services/posService';
import { formatVND } from '@/utils/dateUtils';
import { useAuth } from '@/context/AuthContext';
import { normalizeUserRole } from '@/types';
import { getErrorMessage } from '@/services/apiClient';

export const PosCustomerView: React.FC = () => {
  const { currentUser } = useAuth();
  const isAdmin = normalizeUserRole(currentUser?.role) === 'ADMIN';

  const [customers, setCustomers] = useState<PosCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('ALL');

  // Edit / Add Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<PosCustomer | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formTier, setFormTier] = useState<'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM'>('BRONZE');
  const [formPoints, setFormPoints] = useState<number>(0);
  const [formNotes, setFormNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const list = await posService.getCustomers();
      setCustomers(list || []);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setFormName('');
    setFormPhone('');
    setFormTier('BRONZE');
    setFormPoints(0);
    setFormNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cust: PosCustomer) => {
    setEditingCustomer(cust);
    setFormName(cust.fullName);
    setFormPhone(cust.phoneNumber);
    setFormTier(cust.membershipTier);
    setFormPoints(cust.loyaltyPoints);
    setFormNotes(cust.notes || '');
    setIsModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) {
      setErrorMsg('Vui lòng nhập họ tên và số điện thoại khách hàng.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const payload: PosCustomer = {
        id: editingCustomer?.id,
        fullName: formName.trim(),
        phoneNumber: formPhone.trim(),
        membershipTier: formTier,
        loyaltyPoints: isAdmin ? formPoints : editingCustomer ? editingCustomer.loyaltyPoints : 0,
        totalSpent: editingCustomer ? editingCustomer.totalSpent : 0,
        lastVisit: new Date().toISOString().split('T')[0],
        notes: formNotes,
      };

      await posService.saveCustomer(payload);
      setSuccessMsg(
        editingCustomer
          ? `Đã cập nhật thông tin khách hàng "${payload.fullName}".`
          : `Đã đăng ký thành viên mới "${payload.fullName}".`
      );
      setIsModalOpen(false);
      await loadCustomers();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = customers.filter((c) => {
    if (tierFilter !== 'ALL' && c.membershipTier !== tierFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return c.fullName.toLowerCase().includes(q) || c.phoneNumber.includes(q);
    }
    return true;
  });

  const renderTierBadge = (tier: string) => {
    switch (tier) {
      case 'PLATINUM':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
            Bạch Kim (Platinum)
          </span>
        );
      case 'GOLD':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-300">
            Vàng (Gold)
          </span>
        );
      case 'SILVER':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
            Bạc (Silver)
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-50 text-orange-800 border border-orange-200">
            Đồng (Bronze)
          </span>
        );
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black uppercase text-slate-950 flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            <span>Khách Hàng &amp; Hội Viên Thân Thiết</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Tra cứu thông tin hội viên, tích lũy điểm thưởng (10.000đ = 1 pt) và chính sách nâng hạng thẻ
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm flex items-center gap-2 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Đăng Ký Khách Hàng Mới</span>
          </button>
          <button
            type="button"
            onClick={() => void loadCustomers()}
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 shrink-0"
            title="Tải lại danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between gap-2">
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
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg(null)} className="text-red-600 hover:text-red-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          {['ALL', 'PLATINUM', 'GOLD', 'SILVER', 'BRONZE'].map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => setTierFilter(tier)}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                tierFilter === tier
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tier === 'ALL' ? 'Tất Cả Hạng' : tier}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên hoặc số điện thoại..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600"
          />
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Họ Và Tên</th>
                <th className="py-3 px-4">Số Điện Thoại</th>
                <th className="py-3 px-4 text-center">Hạng Hội Viên</th>
                <th className="py-3 px-4 text-right">Điểm Tích Lũy</th>
                <th className="py-3 px-4 text-right">Tổng Chi Tiêu</th>
                <th className="py-3 px-4 text-center">Lần Ghé Gần Nhất</th>
                <th className="py-3 px-4 text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Đang tải danh sách khách hàng từ SQL Server...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 italic">
                    Không tìm thấy hội viên nào phù hợp.
                  </td>
                </tr>
              ) : (
                filtered.map((cust) => (
                  <tr key={cust.phoneNumber} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-extrabold text-sm flex items-center justify-center shrink-0">
                          {cust.fullName ? cust.fullName.charAt(0).toUpperCase() : 'K'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-950 text-xs">{cust.fullName}</p>
                          {cust.notes && (
                            <p className="text-[10px] text-slate-500 italic line-clamp-1">{cust.notes}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">
                      {cust.phoneNumber}
                    </td>

                    <td className="py-3.5 px-4 text-center">{renderTierBadge(cust.membershipTier)}</td>

                    <td className="py-3.5 px-4 text-right font-mono font-extrabold text-emerald-700 text-xs">
                      {cust.loyaltyPoints?.toLocaleString() ?? 0} pts
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      {formatVND(cust.totalSpent || 0)}
                    </td>

                    <td className="py-3.5 px-4 text-center text-slate-500 font-mono text-[11px]">
                      {cust.lastVisit || 'Mới đăng ký'}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(cust)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                        title="Sửa thông tin"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Sửa</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Tổng số: <strong>{filtered.length}</strong> khách hàng</span>
          <span>Dữ liệu thời gian thực từ SQL Server</span>
        </div>
      </div>

      {/* Edit / Add Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200">
              <h3 className="text-sm font-extrabold text-slate-950 uppercase flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>{editingCustomer ? 'Chỉnh Sửa Hồ Sơ Khách Hàng' : 'Đăng Ký Hội Viên Mới'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-5 space-y-3.5">
              <div>
                <label className="text-xs font-bold uppercase text-slate-700 block mb-1">
                  Họ Và Tên *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="VD: Nguyễn Văn B"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600 font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-slate-700 block mb-1">
                  Số Điện Thoại *
                </label>
                <input
                  type="tel"
                  required
                  disabled={Boolean(editingCustomer)}
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="0901234567"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600 font-mono disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase text-slate-700 block mb-1">
                    Hạng Thẻ
                  </label>
                  <select
                    value={formTier}
                    onChange={(e) => setFormTier(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-emerald-600"
                  >
                    <option value="BRONZE">Đồng (Bronze)</option>
                    <option value="SILVER">Bạc (Silver)</option>
                    <option value="GOLD">Vàng (Gold)</option>
                    <option value="PLATINUM">Bạch Kim (Platinum)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-slate-700 block mb-1 flex items-center justify-between">
                    <span>Điểm Tích Lũy</span>
                    {!isAdmin && <span className="text-[10px] text-amber-600 font-normal">(Chỉ Admin sửa)</span>}
                  </label>
                  <input
                    type="number"
                    min={0}
                    disabled={!isAdmin}
                    value={formPoints}
                    onChange={(e) => setFormPoints(Number(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600 font-mono font-bold disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-slate-700 block mb-1">
                  Ghi Chú Khách Hàng
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Ghi chú sở thích, dị ứng, bàn quen..."
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 outline-none focus:border-emerald-600"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs uppercase rounded-xl transition-colors shadow-sm"
                >
                  {isSubmitting ? 'Đang lưu...' : editingCustomer ? 'Cập Nhật Hồ Sơ' : 'Lưu Thành Viên Mới'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
