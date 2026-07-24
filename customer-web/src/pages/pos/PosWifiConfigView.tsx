import React, { useState, useEffect, useCallback } from 'react';
import {
  Wifi,
  WifiOff,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  ShieldCheck,
  Radio,
  Server,
  Info,
} from 'lucide-react';
import {
  wifiConfigService,
  BranchWifiConfigDto,
  CreateWifiConfigPayload,
  UpdateWifiConfigPayload,
} from '@/services/wifiConfigService';
import { getErrorMessage } from '@/services/apiClient';
import { useAuth } from '@/context/AuthContext';
import { normalizeUserRole } from '@/types';

export const PosWifiConfigView: React.FC = () => {
  const { currentUser } = useAuth();
  const isAdmin = normalizeUserRole(currentUser?.role) === 'ADMIN';

  const [configs, setConfigs] = useState<BranchWifiConfigDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<BranchWifiConfigDto | null>(null);

  // Form State
  const [formSsid, setFormSsid] = useState('');
  const [formBssid, setFormBssid] = useState('');
  const [formSubnet, setFormSubnet] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadConfigs = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const list = await wifiConfigService.getConfigsByBranch(1);
      setConfigs(list);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfigs();
  }, [loadConfigs]);

  const handleOpenAdd = () => {
    setEditingConfig(null);
    setFormSsid('');
    setFormBssid('');
    setFormSubnet('192.168.1.');
    setFormDesc('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cfg: BranchWifiConfigDto) => {
    setEditingConfig(cfg);
    setFormSsid(cfg.ssid);
    setFormBssid(cfg.bssid || '');
    setFormSubnet(cfg.publicIpSubnet || '');
    setFormDesc(cfg.description || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSsid.trim()) {
      setErrorMsg('Vui lòng nhập tên mạng WiFi (SSID).');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      if (editingConfig) {
        const payload: UpdateWifiConfigPayload = {
          ssid: formSsid.trim(),
          bssid: formBssid.trim() || undefined,
          publicIpSubnet: formSubnet.trim() || undefined,
          description: formDesc.trim() || undefined,
        };
        await wifiConfigService.updateConfig(editingConfig.id, payload);
        setSuccessMsg(`Đã cập nhật cấu hình WiFi "${formSsid}" thành công.`);
      } else {
        const payload: CreateWifiConfigPayload = {
          branchId: 1,
          ssid: formSsid.trim(),
          bssid: formBssid.trim() || undefined,
          publicIpSubnet: formSubnet.trim() || undefined,
          description: formDesc.trim() || undefined,
        };
        await wifiConfigService.createConfig(payload);
        setSuccessMsg(`Đã thêm mạng WiFi "${formSsid}" mới thành công.`);
      }
      setIsModalOpen(false);
      await loadConfigs();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (cfg: BranchWifiConfigDto) => {
    try {
      await wifiConfigService.toggleStatus(cfg.id, !cfg.isActive);
      setSuccessMsg(
        `Đã ${!cfg.isActive ? 'kích hoạt' : 'tạm dừng'} mạng WiFi "${cfg.ssid}".`
      );
      await loadConfigs();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    }
  };

  const handleDelete = async (cfg: BranchWifiConfigDto) => {
    if (!isAdmin) {
      setErrorMsg('Chỉ Quản trị viên (ADMIN) mới có quyền xóa cấu hình WiFi.');
      return;
    }
    if (window.confirm(`Xác nhận xóa cấu hình WiFi "${cfg.ssid}" khỏi hệ thống?`)) {
      try {
        await wifiConfigService.deleteConfig(cfg.id);
        setSuccessMsg(`Đã xóa cấu hình WiFi "${cfg.ssid}".`);
        await loadConfigs();
      } catch (err) {
        setErrorMsg(getErrorMessage(err));
      }
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black uppercase text-slate-950 flex items-center gap-2">
            <Radio className="w-6 h-6 text-emerald-600" />
            <span>Thiết Lập Mạng WiFi &amp; SSID Quán</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Quản lý danh sách tên mạng WiFi (SSID) nội bộ của nhà hàng để xác thực khách gọi món tại bàn
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenAdd}
            className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm flex items-center gap-2 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Mạng WiFi Mới</span>
          </button>
          <button
            type="button"
            onClick={() => void loadConfigs()}
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 shrink-0"
            title="Tải lại danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Info Card */}
      <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-3 shadow-xs">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">Cơ chế xác thực WiFi Gọi Món Tại Bàn (Dine-In Guard):</p>
          <p className="text-emerald-800 leading-relaxed">
            Khách hàng quét mã QR tại bàn sẽ được hệ thống kiểm tra đối soát mạng nội bộ của nhà hàng. Khi admin cài đặt tên SSID và kích hoạt tại đây, khách hàng kết nối đúng mạng WiFi sẽ được vào thẳng menu gọi món. Khách ở ngoài quán dùng mạng 4G sẽ được yêu cầu kết nối WiFi quán để bảo đảm an toàn gọi món.
          </p>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
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
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-red-600 hover:text-red-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* WiFi List Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Tên Mạng WiFi (SSID)</th>
                <th className="py-3 px-4">Mô Tả Khu Vực</th>
                <th className="py-3 px-4">Dải IP Subnet Quán</th>
                <th className="py-3 px-4 text-center">Trạng Thái</th>
                <th className="py-3 px-4 text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && configs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Đang tải danh sách mạng WiFi từ SQL Server...
                  </td>
                </tr>
              ) : configs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 italic">
                    Chưa có cấu hình mạng WiFi nào. Hãy bấm "Thêm Mạng WiFi Mới" để thiết lập.
                  </td>
                </tr>
              ) : (
                configs.map((cfg) => (
                  <tr key={cfg.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            cfg.isActive
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-400 border border-slate-200'
                          }`}
                        >
                          <Wifi className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-extrabold text-slate-950 text-xs font-mono">
                            {cfg.ssid}
                          </p>
                          {cfg.bssid && (
                            <p className="text-[10px] text-slate-400 font-mono">
                              BSSID: {cfg.bssid}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      {cfg.description || <span className="text-slate-400 italic">Toàn bộ nhà hàng</span>}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-700">
                      {cfg.publicIpSubnet || <span className="text-slate-400 italic">Tất cả IP</span>}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => void handleToggleStatus(cfg)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${
                          cfg.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 border border-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            cfg.isActive ? 'bg-emerald-600' : 'bg-slate-400'
                          }`}
                        />
                        <span>{cfg.isActive ? 'Đang Hoạt Động' : 'Tạm Dừng'}</span>
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(cfg)}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
                          title="Sửa cấu hình"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => void handleDelete(cfg)}
                            className="p-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 transition-colors"
                            title="Xóa cấu hình"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
              <h2 className="text-sm font-extrabold uppercase text-slate-900 flex items-center gap-2">
                <Wifi className="w-4 h-4 text-emerald-600" />
                <span>{editingConfig ? 'Chỉnh Sửa Mạng WiFi' : 'Thêm Mạng WiFi Mới'}</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tên Mạng WiFi (SSID) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="vd: Sakura_Guest_5G"
                  value={formSsid}
                  onChange={(e) => setFormSsid(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono outline-none focus:border-emerald-600"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Nhập chính xác tên sóng WiFi phát tại nhà hàng để khách hàng đối chiếu
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Mô Tả Khu Vực Phát Sóng
                </label>
                <input
                  type="text"
                  placeholder="vd: Mạng WiFi sảnh trệt hoặc phòng VIP"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Dải IP Subnet Router (Tùy chọn)
                </label>
                <input
                  type="text"
                  placeholder="vd: 192.168.1."
                  value={formSubnet}
                  onChange={(e) => setFormSubnet(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono outline-none focus:border-emerald-600"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  {isSubmitting ? 'Đang lưu...' : editingConfig ? 'Lưu Thay Đổi' : 'Thêm Mạng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
