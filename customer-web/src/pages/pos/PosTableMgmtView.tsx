import React, { useState, useEffect, useCallback } from 'react';
import {
  MapPin,
  Layers,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  ToggleLeft,
  ToggleRight,
  Users,
} from 'lucide-react';
import {
  reservationService,
  TableAreaDetailDto,
  TableItemDto,
} from '@/services/reservationService';
import { getErrorMessage } from '@/services/apiClient';
import { formatVND } from '@/utils/dateUtils';
import { useAuth } from '@/context/AuthContext';
import { normalizeUserRole } from '@/types';

export const PosTableMgmtView: React.FC = () => {
  const { currentUser } = useAuth();
  const isAdmin = normalizeUserRole(currentUser?.role) === 'ADMIN';

  const [activeTab, setActiveTab] = useState<'TABLES' | 'AREAS'>('TABLES');

  const [tables, setTables] = useState<TableItemDto[]>([]);
  const [areas, setAreas] = useState<TableAreaDetailDto[]>([]);
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>('ALL');

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [isAddTableOpen, setIsAddTableOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableItemDto | null>(null);
  const [isAddAreaOpen, setIsAddAreaOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<TableAreaDetailDto | null>(null);

  // Table form
  const [tableForm, setTableForm] = useState({
    tableNumber: '',
    areaId: 1,
    capacity: 4,
    minCapacity: 1,
  });

  // Area form
  const [areaForm, setAreaForm] = useState({
    code: '',
    name: '',
    japaneseName: '',
    description: '',
    minGuests: 1,
    maxGuests: 8,
    requiresDeposit: false,
    depositPerGuest: 100000,
    displayOrder: 1,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [areasRes, tablesRes] = await Promise.all([
        reservationService.getAllAreasForAdmin(),
        reservationService.getAllTablesForAdmin(),
      ]);
      setAreas(areasRes || []);
      setTables(tablesRes || []);
      if (areasRes && areasRes.length > 0 && !tableForm.areaId) {
        setTableForm((prev) => ({ ...prev, areaId: areasRes[0].id }));
      }
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [tableForm.areaId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Table operations
  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      if (editingTable) {
        await reservationService.updateTable(editingTable.tableId, {
          tableNumber: tableForm.tableNumber,
          areaId: Number(tableForm.areaId),
          capacity: Number(tableForm.capacity),
          minCapacity: Number(tableForm.minCapacity),
        });
        setSuccessMsg(`Đã cập nhật bàn "${tableForm.tableNumber}" thành công.`);
        setEditingTable(null);
      } else {
        await reservationService.createTable({
          tableNumber: tableForm.tableNumber,
          areaId: Number(tableForm.areaId),
          capacity: Number(tableForm.capacity),
          minCapacity: Number(tableForm.minCapacity),
        });
        setSuccessMsg(`Đã thêm bàn mới "${tableForm.tableNumber}" thành công.`);
        setIsAddTableOpen(false);
      }
      setTableForm({ tableNumber: '', areaId: areas[0]?.id || 1, capacity: 4, minCapacity: 1 });
      await loadData();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleTableStatus = async (table: TableItemDto) => {
    try {
      await reservationService.setTableStatus(table.tableId, !table.isActive);
      setSuccessMsg(`Đã ${table.isActive ? 'tạm ngưng' : 'kích hoạt'} bàn "${table.tableNumber}".`);
      await loadData();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    }
  };

  const handleDeleteTable = async (table: TableItemDto) => {
    if (!isAdmin) {
      setErrorMsg('Chỉ Quản trị viên (ADMIN) mới có quyền xóa bàn.');
      return;
    }
    if (!window.confirm(`Bạn có chắc muốn xóa bàn "${table.tableNumber}"?`)) return;
    try {
      await reservationService.deleteTable(table.tableId);
      setSuccessMsg(`Đã xóa bàn "${table.tableNumber}".`);
      await loadData();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    }
  };

  // Area operations
  const handleSaveArea = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      if (editingArea) {
        await reservationService.updateArea(editingArea.id, {
          areaName: areaForm.name,
          japaneseName: areaForm.japaneseName || undefined,
          description: areaForm.description || undefined,
          minGuests: Number(areaForm.minGuests),
          maxGuests: Number(areaForm.maxGuests),
          requiresDeposit: areaForm.requiresDeposit,
          depositPerGuest: areaForm.requiresDeposit ? Number(areaForm.depositPerGuest) : undefined,
          displayOrder: Number(areaForm.displayOrder),
        });
        setSuccessMsg(`Đã cập nhật khu vực "${areaForm.name}" thành công.`);
        setEditingArea(null);
      } else {
        await reservationService.createArea({
          areaCode: areaForm.code,
          areaName: areaForm.name,
          japaneseName: areaForm.japaneseName || undefined,
          description: areaForm.description || undefined,
          minGuests: Number(areaForm.minGuests),
          maxGuests: Number(areaForm.maxGuests),
          requiresDeposit: areaForm.requiresDeposit,
          depositPerGuest: areaForm.requiresDeposit ? Number(areaForm.depositPerGuest) : undefined,
          displayOrder: Number(areaForm.displayOrder),
        });
        setSuccessMsg(`Đã thêm khu vực mới "${areaForm.name}" thành công.`);
        setIsAddAreaOpen(false);
      }
      setAreaForm({
        code: '',
        name: '',
        japaneseName: '',
        description: '',
        minGuests: 1,
        maxGuests: 8,
        requiresDeposit: false,
        depositPerGuest: 100000,
        displayOrder: 1,
      });
      await loadData();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleAreaStatus = async (area: TableAreaDetailDto) => {
    try {
      await reservationService.setAreaStatus(area.id, !area.isActive);
      setSuccessMsg(`Đã ${area.isActive ? 'tạm ngưng' : 'kích hoạt'} khu vực "${area.name}".`);
      await loadData();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    }
  };

  const handleDeleteArea = async (area: TableAreaDetailDto) => {
    if (!isAdmin) {
      setErrorMsg('Chỉ Quản trị viên (ADMIN) mới có quyền xóa khu vực bàn.');
      return;
    }
    if (!window.confirm(`Bạn có chắc muốn xóa khu vực "${area.name}"?`)) return;
    try {
      await reservationService.deleteArea(area.id);
      setSuccessMsg(`Đã xóa khu vực "${area.name}".`);
      await loadData();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    }
  };

  const filteredTables = tables.filter((t) => {
    if (selectedAreaFilter === 'ALL') return true;
    return String(t.areaId) === selectedAreaFilter;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black uppercase text-slate-950 flex items-center gap-2">
            <Layers className="w-6 h-6 text-emerald-600" />
            <span>Quản Lý Bàn Ăn &amp; Khu Vực Nhà Hàng</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Thiết lập sơ đồ mặt bằng, tạo bàn mới, khu vực VIP/Tatami và phân bổ sức chứa thực tế từ SQL Server
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'TABLES' ? (
            <button
              type="button"
              onClick={() => {
                setEditingTable(null);
                setTableForm({ tableNumber: '', areaId: areas[0]?.id || 1, capacity: 4, minCapacity: 1 });
                setIsAddTableOpen(true);
              }}
              className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Bàn Mới</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditingArea(null);
                setAreaForm({
                  code: '',
                  name: '',
                  japaneseName: '',
                  description: '',
                  minGuests: 1,
                  maxGuests: 8,
                  requiresDeposit: false,
                  depositPerGuest: 100000,
                  displayOrder: areas.length + 1,
                });
                setIsAddAreaOpen(true);
              }}
              className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Khu Vực Mới</span>
            </button>
          )}
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

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('TABLES')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'TABLES'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Danh Sách Bàn ({tables.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('AREAS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'AREAS'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Danh Sách Khu Vực ({areas.length})</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => void loadData()}
          className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600"
          title="Tải lại dữ liệu"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* TAB 1: TABLES */}
      {activeTab === 'TABLES' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-white p-3.5 border border-slate-200 rounded-2xl shadow-xs">
            <span className="text-xs font-bold text-slate-700">Lọc theo khu vực:</span>
            <select
              value={selectedAreaFilter}
              onChange={(e) => setSelectedAreaFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600"
            >
              <option value="ALL">Tất cả khu vực ({tables.length} bàn)</option>
              {areas.map((a) => (
                <option key={a.id} value={String(a.id)}>
                  {a.name} ({tables.filter((t) => t.areaId === a.id).length} bàn)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredTables.map((table) => (
              <div
                key={table.tableId}
                className={`bg-white border rounded-2xl p-4 shadow-xs flex flex-col justify-between transition-all ${
                  table.isActive ? 'border-slate-200' : 'border-slate-200 opacity-60 bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-extrabold text-base text-slate-950">{table.tableNumber}</h3>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        table.status === 'Serving'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : table.status === 'Reserved'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {table.status === 'Serving' ? 'Có khách' : table.status === 'Reserved' ? 'Đã đặt' : 'Trống'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{table.areaName}</span>
                  </p>
                  <p className="text-xs text-slate-600 flex items-center gap-1 mt-1">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>Sức chứa: <strong>{table.capacity} khách</strong> (tối thiểu {table.minCapacity})</span>
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => void handleToggleTableStatus(table)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-950"
                  >
                    {table.isActive ? (
                      <ToggleRight className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-slate-400" />
                    )}
                    <span>{table.isActive ? 'Hoạt động' : 'Tạm dừng'}</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTable(table);
                        setTableForm({
                          tableNumber: table.tableNumber,
                          areaId: table.areaId,
                          capacity: table.capacity,
                          minCapacity: table.minCapacity,
                        });
                      }}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                      title="Sửa bàn"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteTable(table)}
                        className="p-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-600"
                        title="Xóa bàn"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: AREAS */}
      {activeTab === 'AREAS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {areas.map((area) => (
            <div
              key={area.id}
              className={`bg-white border rounded-2xl p-5 shadow-xs flex flex-col justify-between ${
                area.isActive ? 'border-slate-200' : 'border-slate-200 opacity-60 bg-slate-50'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-extrabold text-base text-slate-950">{area.name}</h3>
                    {area.japaneseName && (
                      <p className="text-xs text-emerald-700 font-bold">{area.japaneseName}</p>
                    )}
                  </div>
                  <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-xs font-bold text-slate-700">
                    Mã: {area.code}
                  </span>
                </div>

                <p className="text-xs text-slate-600 mt-2 line-clamp-2">
                  {area.description || 'Chưa có mô tả chi tiết cho khu vực này.'}
                </p>

                <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Số lượng bàn hiện có:</span>
                    <strong className="text-slate-900">{area.tableCount} bàn</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Quy mô khách:</span>
                    <strong className="text-slate-900">{area.minGuests} - {area.maxGuests} người/bàn</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Chính sách đặt cọc:</span>
                    <strong className={area.requiresDeposit ? 'text-amber-700' : 'text-slate-600'}>
                      {area.requiresDeposit ? `Cọc ${formatVND(area.depositPerGuest || 0)}/khách` : 'Không bắt buộc cọc'}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => void handleToggleAreaStatus(area)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-950"
                >
                  {area.isActive ? (
                    <ToggleRight className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 text-slate-400" />
                  )}
                  <span>{area.isActive ? 'Hoạt động' : 'Tạm dừng'}</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingArea(area);
                      setAreaForm({
                        code: area.code,
                        name: area.name,
                        japaneseName: area.japaneseName || '',
                        description: area.description || '',
                        minGuests: area.minGuests,
                        maxGuests: area.maxGuests,
                        requiresDeposit: area.requiresDeposit,
                        depositPerGuest: area.depositPerGuest || 100000,
                        displayOrder: area.displayOrder,
                      });
                    }}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                    title="Sửa khu vực"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => void handleDeleteArea(area)}
                      className="p-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-600"
                      title="Xóa khu vực"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ADD / EDIT TABLE MODAL */}
      {(isAddTableOpen || editingTable) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-extrabold text-sm uppercase text-slate-950 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                <span>{editingTable ? 'Cập Nhật Bàn Ăn' : 'Thêm Bàn Ăn Mới'}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddTableOpen(false);
                  setEditingTable(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTable} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Số / Tên Bàn *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Bàn 09, VIP 01..."
                  value={tableForm.tableNumber}
                  onChange={(e) => setTableForm({ ...tableForm, tableNumber: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Khu Vực Bàn *</label>
                <select
                  value={tableForm.areaId}
                  onChange={(e) => setTableForm({ ...tableForm, areaId: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-600"
                >
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Sức Chứa Chuẩn *</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    required
                    value={tableForm.capacity}
                    onChange={(e) => setTableForm({ ...tableForm, capacity: Number(e.target.value) || 1 })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Khách Tối Thiểu *</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    required
                    value={tableForm.minCapacity}
                    onChange={(e) => setTableForm({ ...tableForm, minCapacity: Number(e.target.value) || 1 })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600 font-bold"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs uppercase rounded-xl transition-colors"
                >
                  {isSubmitting ? 'Đang lưu...' : editingTable ? 'Lưu Thay Đổi' : 'Tạo Bàn Mới'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddTableOpen(false);
                    setEditingTable(null);
                  }}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT AREA MODAL */}
      {(isAddAreaOpen || editingArea) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-extrabold text-sm uppercase text-slate-950 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span>{editingArea ? 'Cập Nhật Khu Vực' : 'Thêm Khu Vực Mới'}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddAreaOpen(false);
                  setEditingArea(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveArea} className="p-5 space-y-3.5">
              {!editingArea && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mã Khu Vực *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: ROOFTOP, GARDEN..."
                    value={areaForm.code}
                    onChange={(e) => setAreaForm({ ...areaForm, code: e.target.value.toUpperCase() })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600 font-mono font-bold"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên Khu Vực *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Sân Thượng Ngắm Trăng"
                  value={areaForm.name}
                  onChange={(e) => setAreaForm({ ...areaForm, name: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên Tiếng Nhật (Tuỳ chọn)</label>
                <input
                  type="text"
                  placeholder="VD: 月見テラス (Tsukimi Terrace)"
                  value={areaForm.japaneseName}
                  onChange={(e) => setAreaForm({ ...areaForm, japaneseName: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mô Tả Khu Vực</label>
                <textarea
                  rows={2}
                  placeholder="Mô tả không gian và phong cách..."
                  value={areaForm.description}
                  onChange={(e) => setAreaForm({ ...areaForm, description: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Khách Tối Thiểu</label>
                  <input
                    type="number"
                    min={1}
                    value={areaForm.minGuests}
                    onChange={(e) => setAreaForm({ ...areaForm, minGuests: Number(e.target.value) || 1 })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Khách Tối Đa</label>
                  <input
                    type="number"
                    min={1}
                    value={areaForm.maxGuests}
                    onChange={(e) => setAreaForm({ ...areaForm, maxGuests: Number(e.target.value) || 8 })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="pt-1 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={areaForm.requiresDeposit}
                    onChange={(e) => setAreaForm({ ...areaForm, requiresDeposit: e.target.checked })}
                    className="rounded border-slate-300 text-emerald-600"
                  />
                  <span>Yêu Cầu Đặt Cọc Trước Khi Đặt Bàn Khu Này</span>
                </label>

                {areaForm.requiresDeposit && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Mức cọc / Khách (VNĐ):
                    </label>
                    <input
                      type="number"
                      step={10000}
                      min={10000}
                      value={areaForm.depositPerGuest}
                      onChange={(e) => setAreaForm({ ...areaForm, depositPerGuest: Number(e.target.value) || 0 })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600 font-mono font-bold"
                    />
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs uppercase rounded-xl transition-colors"
                >
                  {isSubmitting ? 'Đang lưu...' : editingArea ? 'Lưu Khu Vực' : 'Tạo Khu Vực Mới'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddAreaOpen(false);
                    setEditingArea(null);
                  }}
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
