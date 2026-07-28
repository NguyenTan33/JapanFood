import React, { useState, useEffect, useCallback } from 'react';
import {
  UserCog,
  Search,
  Plus,
  Lock,
  Unlock,
  KeyRound,
  Shield,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  User,
  Mail,
  Phone,
  Trash2,
  Edit,
} from 'lucide-react';
import { adminUserService, AdminUserDto } from '@/services/adminUserService';
import { getErrorMessage } from '@/services/apiClient';

export const PosAdminUsersView: React.FC = () => {
  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [isChangeRoleModalOpen, setIsChangeRoleModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserDto | null>(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    role: 'STAFF' as 'ADMIN' | 'MANAGER' | 'STAFF' | 'KITCHEN' | 'CUSTOMER',
  });
  const [newPassword, setNewPassword] = useState('');
  const [selectedNewRole, setSelectedNewRole] = useState<'ADMIN' | 'MANAGER' | 'STAFF' | 'KITCHEN' | 'CUSTOMER'>('STAFF');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Staff Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    role: 'STAFF' as 'ADMIN' | 'MANAGER' | 'STAFF' | 'KITCHEN' | 'CUSTOMER',
    accountStatus: 'ACTIVE',
  });

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await adminUserService.getUsers({
        search: search.trim() || undefined,
        role: roleFilter !== 'ALL' ? roleFilter : undefined,
        isActive: statusFilter === 'ACTIVE' ? true : statusFilter === 'LOCKED' ? false : undefined,
        page: 1,
        pageSize: 50,
      });
      setUsers(res.items || []);
      setTotalCount(res.totalCount || 0);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [search, roleFilter, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadUsers();
    }, 300);
    return () => clearTimeout(timer);
  }, [loadUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await adminUserService.createUser(createForm);
      setSuccessMsg(`Đã tạo tài khoản "${createForm.fullName}" thành công.`);
      setIsCreateModalOpen(false);
      setCreateForm({ fullName: '', email: '', phoneNumber: '', password: '', role: 'STAFF' });
      await loadUsers();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await adminUserService.resetPassword(selectedUser.id, newPassword || undefined);
      setSuccessMsg(`Đã cấp lại mật khẩu cho tài khoản "${selectedUser.fullName}" thành công.`);
      setIsResetPasswordModalOpen(false);
      setNewPassword('');
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmChangeRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await adminUserService.updateUserRole(selectedUser.id, selectedNewRole);
      setSuccessMsg(`Đã cập nhật vai trò của "${selectedUser.fullName}" thành ${selectedNewRole}.`);
      setIsChangeRoleModalOpen(false);
      await loadUsers();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isUserActive = (u: AdminUserDto) => {
    if (typeof u.isActive === 'boolean') return u.isActive;
    return (u.accountStatus?.toUpperCase() === 'ACTIVE');
  };

  const handleOpenEditModal = (u: AdminUserDto) => {
    setSelectedUser(u);
    setEditForm({
      fullName: u.fullName,
      email: u.email,
      phoneNumber: u.phoneNumber || '',
      role: (u.role?.toUpperCase() || 'STAFF') as any,
      accountStatus: isUserActive(u) ? 'ACTIVE' : 'LOCKED',
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEditStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await adminUserService.updateStaffUser(selectedUser.id, {
        fullName: editForm.fullName.trim(),
        email: editForm.email.trim(),
        phoneNumber: editForm.phoneNumber.trim(),
        role: editForm.role,
        accountStatus: editForm.accountStatus,
      });
      setSuccessMsg(`Đã cập nhật thông tin nhân viên "${editForm.fullName}".`);
      setIsEditModalOpen(false);
      await loadUsers();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleLockUser = async (user: AdminUserDto) => {
    setErrorMsg(null);
    try {
      if (isUserActive(user)) {
        await adminUserService.lockUser(user.id);
        setSuccessMsg(`Đã khóa tài khoản "${user.fullName}".`);
      } else {
        await adminUserService.unlockUser(user.id);
        setSuccessMsg(`Đã mở khóa tài khoản "${user.fullName}".`);
      }
      await loadUsers();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    }
  };

  const handleDeleteUser = async (user: AdminUserDto) => {
    if (!window.confirm(`Xác nhận xóa vĩnh viễn tài khoản "${user.fullName}" (${user.email})?`)) return;
    try {
      await adminUserService.deleteUser(user.id);
      setSuccessMsg(`Đã xóa tài khoản "${user.fullName}".`);
      await loadUsers();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    }
  };

  const renderRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-red-100 text-red-800 border border-red-200">
            Quản trị (Admin)
          </span>
        );
      case 'MANAGER':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-purple-100 text-purple-800 border border-purple-200">
            Quản lý (Manager)
          </span>
        );
      case 'KITCHEN':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-100 text-amber-800 border border-amber-200">
            Bếp KDS (Kitchen)
          </span>
        );
      case 'STAFF':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
            Thu Ngân (Staff)
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-blue-100 text-blue-800 border border-blue-200">
            Khách hàng (Customer)
          </span>
        );
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black uppercase text-slate-950 flex items-center gap-2">
            <UserCog className="w-6 h-6 text-emerald-600" />
            <span>Quản Lý Nhân Sự &amp; Phân Quyền</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Toàn bộ danh sách tài khoản nhân sự, phân quyền truy cập, đặt lại mật khẩu và khóa tài khoản từ SQL Server
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm flex items-center gap-2 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm Nhân Viên Mới</span>
        </button>
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

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên, email, số điện thoại..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600"
          >
            <option value="ALL">Tất cả vai trò</option>
            <option value="ADMIN">Quản trị viên (Admin)</option>
            <option value="MANAGER">Quản lý (Manager)</option>
            <option value="STAFF">Thu ngân (Staff)</option>
            <option value="KITCHEN">Bếp KDS (Kitchen)</option>
            <option value="CUSTOMER">Khách hàng (Customer)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="LOCKED">Đã khóa tài khoản</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => void loadUsers()}
          className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600"
          title="Tải lại danh sách"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Người Dùng</th>
                <th className="py-3 px-4">Email &amp; SĐT</th>
                <th className="py-3 px-4">Vai Trò</th>
                <th className="py-3 px-4">Trạng Thái</th>
                <th className="py-3 px-4 text-center">Điểm Tích Lũy</th>
                <th className="py-3 px-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Đang tải danh sách tài khoản từ SQL Server...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 italic">
                    Không tìm thấy người dùng nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-extrabold text-sm flex items-center justify-center shrink-0">
                          {u.fullName ? u.fullName.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-950 text-xs">{u.fullName}</p>
                          <p className="text-[11px] text-slate-500">ID #{u.id}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 space-y-0.5">
                      <p className="text-slate-800 flex items-center gap-1.5 font-medium">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{u.email}</span>
                      </p>
                      {u.phoneNumber && (
                        <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{u.phoneNumber}</span>
                        </p>
                      )}
                    </td>

                    <td className="py-3.5 px-4">{renderRoleBadge(u.role)}</td>

                    <td className="py-3.5 px-4">
                      {isUserActive(u) ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Hoạt động
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          Đã khóa
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center font-bold font-mono text-slate-800">
                      {u.loyaltyPoints ?? 0} pts
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(u)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-bold transition-colors flex items-center gap-1"
                          title="Chỉnh sửa thông tin nhân viên"
                        >
                          <Edit className="w-3 h-3 text-blue-600" />
                          <span>Sửa</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUser(u);
                            setSelectedNewRole(u.role);
                            setIsChangeRoleModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-bold transition-colors flex items-center gap-1"
                          title="Đổi phân quyền"
                        >
                          <Shield className="w-3 h-3 text-purple-600" />
                          <span>Vai Trò</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUser(u);
                            setNewPassword('');
                            setIsResetPasswordModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-bold transition-colors flex items-center gap-1"
                          title="Cấp lại mật khẩu"
                        >
                          <KeyRound className="w-3 h-3 text-amber-600" />
                          <span>Mật Khẩu</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleToggleLockUser(u)}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            isUserActive(u)
                              ? 'border-red-200 text-red-600 hover:bg-red-50'
                              : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={isUserActive(u) ? 'Khóa tài khoản này' : 'Mở khóa tài khoản'}
                        >
                          {isUserActive(u) ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleDeleteUser(u)}
                          className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                          title="Xóa tài khoản này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Tổng số: <strong>{totalCount}</strong> tài khoản trong hệ thống</span>
          <span>Dữ liệu thời gian thực từ SQL Server</span>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-extrabold text-sm uppercase text-slate-950 flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-600" />
                <span>Thêm Tài Khoản Người Dùng</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Họ và Tên *</label>
                <input
                  type="text"
                  required
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                  placeholder="VD: Nguyễn Văn A"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Đăng Nhập *</label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="nhanvien@japanfood.vn"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Số Điện Thoại *</label>
                <input
                  type="tel"
                  required
                  value={createForm.phoneNumber}
                  onChange={(e) => setCreateForm({ ...createForm, phoneNumber: e.target.value })}
                  placeholder="0901234567"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mật Khẩu Ban Đầu *</label>
                <input
                  type="password"
                  required
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="Tối thiểu 6 ký tự"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Phân Quyền Vai Trò *</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as any })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-emerald-600"
                >
                  <option value="STAFF">Nhân Viên Thu Ngân (STAFF)</option>
                  <option value="KITCHEN">Bếp Trưởng KDS (KITCHEN)</option>
                  <option value="MANAGER">Quản Lý Nhà Hàng (MANAGER)</option>
                  <option value="ADMIN">Quản Trị Viên Hệ Thống (ADMIN)</option>
                  <option value="CUSTOMER">Khách Hàng (CUSTOMER)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs uppercase rounded-xl transition-colors"
                >
                  {isSubmitting ? 'Đang tạo...' : 'Tạo Tài Khoản'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {isResetPasswordModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-extrabold text-sm uppercase text-slate-950 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-600" />
                <span>Cấp Lại Mật Khẩu</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsResetPasswordModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmResetPassword} className="p-5 space-y-3.5">
              <p className="text-xs text-slate-600">
                Cấp lại mật khẩu cho tài khoản: <strong>{selectedUser.fullName}</strong> ({selectedUser.email})
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mật Khẩu Mới (Để trống sẽ tự sinh mật khẩu ngẫu nhiên):
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-amber-600"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs uppercase rounded-xl transition-colors"
                >
                  {isSubmitting ? 'Đang cập nhật...' : 'Xác Nhận Đổi Mật Khẩu'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsResetPasswordModalOpen(false)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHANGE ROLE MODAL */}
      {isChangeRoleModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-extrabold text-sm uppercase text-slate-950 flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-600" />
                <span>Thay Đổi Phân Quyền</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsChangeRoleModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmChangeRole} className="p-5 space-y-3.5">
              <p className="text-xs text-slate-600">
                Người dùng: <strong>{selectedUser.fullName}</strong> ({selectedUser.email})
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Chọn Vai Trò Mới:</label>
                <select
                  value={selectedNewRole}
                  onChange={(e) => setSelectedNewRole(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-purple-600"
                >
                  <option value="STAFF">Nhân Viên Thu Ngân (STAFF)</option>
                  <option value="KITCHEN">Bếp Trưởng KDS (KITCHEN)</option>
                  <option value="MANAGER">Quản Lý Nhà Hàng (MANAGER)</option>
                  <option value="ADMIN">Quản Trị Viên Toàn Quyền (ADMIN)</option>
                  <option value="CUSTOMER">Khách Hàng (CUSTOMER)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs uppercase rounded-xl transition-colors"
                >
                  {isSubmitting ? 'Đang lưu...' : 'Lưu Phân Quyền'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsChangeRoleModalOpen(false)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STAFF MODAL */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-extrabold text-sm uppercase text-slate-950 flex items-center gap-2">
                <Edit className="w-4 h-4 text-blue-600" />
                <span>Chỉnh Sửa Thông Tin Nhân Viên</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditStaff} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Họ và Tên *</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={editForm.fullName}
                    onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                    className="w-full bg-white border border-slate-300 focus:border-blue-600 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-900 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Địa chỉ Email *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full bg-white border border-slate-300 focus:border-blue-600 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-900 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Số Điện Thoại</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="tel"
                    value={editForm.phoneNumber}
                    onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                    className="w-full bg-white border border-slate-300 focus:border-blue-600 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-900 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Vai Trò</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
                    className="w-full bg-white border border-slate-300 focus:border-blue-600 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none"
                  >
                    <option value="STAFF">Thu Ngân (STAFF)</option>
                    <option value="KITCHEN">Bếp Trưởng KDS (KITCHEN)</option>
                    <option value="MANAGER">Quản Lý (MANAGER)</option>
                    <option value="ADMIN">Quản Trị Viên (ADMIN)</option>
                    <option value="CUSTOMER">Khách Hàng (CUSTOMER)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Trạng Thái</label>
                  <select
                    value={editForm.accountStatus}
                    onChange={(e) => setEditForm({ ...editForm, accountStatus: e.target.value })}
                    className="w-full bg-white border border-slate-300 focus:border-blue-600 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none"
                  >
                    <option value="ACTIVE">Hoạt Động (Active)</option>
                    <option value="LOCKED">Tạm Khóa (Locked)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs uppercase rounded-xl transition-colors shadow-sm"
                >
                  {isSubmitting ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
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
