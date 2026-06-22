import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { 
  User as UserIcon, 
  MapPin, 
  Lock, 
  ShoppingBag, 
  Calendar, 
  Award, 
  LogOut, 
  Plus, 
  Trash2, 
  Check, 
  Star, 
  Eye, 
  EyeOff, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight,
  ShieldCheck,
  Phone,
  Mail,
  Home,
  Truck,
  Sparkles,
  Edit3,
  Camera,
  Upload,
  Smartphone,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { addressService, UserAddress, CreateAddressRequest } from '@/services/addressService';
import { orderService, OrderDetailViewDto } from '@/services/orderService';
import { reservationService, ReservationSummary } from '@/services/reservationService';
import { authService } from '@/services/authService';
import { OrderReviewModal } from '@/components/modals/OrderReviewModal';
import { PendingReviewOrder } from '@/services/reviewService';

type TabKey = 'profile' | 'addresses' | 'security' | 'orders' | 'reservations';

const PRESET_AVATARS = [
  { id: 'av-1', name: 'Sakura Samurai', url: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=200&q=80' },
  { id: 'av-2', name: 'Kimono Kyoto', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80' },
  { id: 'av-3', name: 'Master Chef', url: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=200&q=80' },
  { id: 'av-4', name: 'Zen Modern', url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80' },
  { id: 'av-5', name: 'Origami Crane', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80' },
];

export const ProfilePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser, isAuthenticated, logout, updateUser, openAuthModal } = useAuth();

  const rawTab = searchParams.get('tab');
  const validTabs: TabKey[] = ['profile', 'addresses', 'orders', 'reservations', 'security'];
  const initialTab: TabKey = (rawTab && validTabs.includes(rawTab as TabKey)) ? (rawTab as TabKey) : 'profile';
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  // Profile Edit State (Tên, Email, Avatar)
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editName, setEditName] = useState(() => currentUser?.fullName || '');
  const [editEmail, setEditEmail] = useState(() => currentUser?.email || '');
  const [editAvatarUrl, setEditAvatarUrl] = useState(() => currentUser?.avatarUrl || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Phone Change with SMS OTP State (Đổi SĐT & Gửi SMS xác minh)
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [phoneSubmitting, setPhoneSubmitting] = useState(false);
  const [phoneSuccess, setPhoneSuccess] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null);

  // Address State
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  const [newAddress, setNewAddress] = useState<CreateAddressRequest>({
    recipientName: currentUser?.fullName || '',
    phoneNumber: currentUser?.phoneNumber || '',
    streetAddress: '',
    ward: '',
    district: '',
    city: 'TP. Hồ Chí Minh',
    isDefault: false,
  });
  const [addressError, setAddressError] = useState<string | null>(null);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passSubmitting, setPassSubmitting] = useState(false);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);
  const [passError, setPassError] = useState<string | null>(null);

  // Orders State
  const [orders, setOrders] = useState<OrderDetailViewDto[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedReviewOrder, setSelectedReviewOrder] = useState<PendingReviewOrder | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [localReviewedIds, setLocalReviewedIds] = useState<Record<number, boolean>>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('torisakura_reviewed_orders') || '[]');
      const map: Record<number, boolean> = {};
      if (Array.isArray(stored)) {
        stored.forEach((id: number) => {
          map[id] = true;
        });
      }
      return map;
    } catch {
      return {};
    }
  });

  // Reservations State
  const [reservations, setReservations] = useState<ReservationSummary[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(false);

  // Keep edit state in sync with currentUser
  useEffect(() => {
    if (currentUser) {
      setEditName(currentUser.fullName || '');
      setEditEmail(currentUser.email || '');
      setEditAvatarUrl(currentUser.avatarUrl || '');
    }
  }, [currentUser]);

  // Sync tab with URL
  useEffect(() => {
    const raw = searchParams.get('tab');
    const targetTab: TabKey = (raw && validTabs.includes(raw as TabKey)) ? (raw as TabKey) : 'profile';
    if (targetTab !== activeTab) {
      setActiveTab(targetTab);
    }
  }, [searchParams]);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // OTP Cooldown Countdown Timer
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  // Load addresses
  const loadAddresses = async () => {
    if (!isAuthenticated) return;
    setLoadingAddresses(true);
    try {
      const data = await addressService.getAddresses();
      setAddresses(data);
    } catch (e) {
      console.error('Failed to load addresses', e);
    } finally {
      setLoadingAddresses(false);
    }
  };

  // Load orders
  const [confirmingOrderId, setConfirmingOrderId] = useState<number | null>(null);
  const loadOrders = async (silent = false) => {
    if (!isAuthenticated) return;
    if (!silent) setLoadingOrders(true);
    try {
      const res = await orderService.getMyOrderHistory(1, 20);
      setOrders(res.items || []);
    } catch (e) {
      if (!silent) {
        console.warn('Backend order history error, using empty state', e);
        setOrders([]);
      }
    } finally {
      if (!silent) setLoadingOrders(false);
    }
  };

  const handleConfirmOrderReceived = async (orderId: number) => {
    if (confirmingOrderId === orderId) return;
    setConfirmingOrderId(orderId);
    try {
      await orderService.completeDelivery(orderId);
      await loadOrders(true);
    } catch (e) {
      console.error('Lỗi xác nhận nhận hàng:', e);
    } finally {
      setConfirmingOrderId(null);
    }
  };

  // Load reservations
  const loadReservations = async () => {
    if (!isAuthenticated) return;
    setLoadingReservations(true);
    try {
      const res = await reservationService.getMyHistory(1, 20);
      setReservations(res.items || []);
    } catch (e) {
      console.warn('Backend reservation history error', e);
      setReservations([]);
    } finally {
      setLoadingReservations(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === 'addresses') void loadAddresses();
      if (activeTab === 'orders') void loadOrders(false);
      if (activeTab === 'reservations') void loadReservations();
    }
  }, [activeTab, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || activeTab !== 'orders') return;
    const poll = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void loadOrders(true);
      }
    }, 6000);
    return () => clearInterval(poll);
  }, [isAuthenticated, activeTab]);

  useEffect(() => {
    if (isAuthenticated) {
      void loadAddresses();
      void loadOrders(false);
      void loadReservations();
    }
  }, [isAuthenticated]);

  // ==========================================
  // HANDLERS: EDIT PROFILE (TÊN, EMAIL, AVATAR)
  // ==========================================
  const handleOpenEditProfile = () => {
    setEditName(currentUser?.fullName || '');
    setEditEmail(currentUser?.email || '');
    setEditAvatarUrl(currentUser?.avatarUrl || '');
    setProfileSuccess(null);
    setProfileError(null);
    setShowEditProfileModal(true);
  };

  const handleFileUploadAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setProfileError('Ảnh đại diện không được vượt quá 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setEditAvatarUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    if (!editName.trim()) {
      setProfileError('Họ và tên không được để trống.');
      return;
    }

    if (!authService.isAuthenticated()) {
      setProfileError('Phiên đăng nhập chưa được xác thực JWT trên máy chủ. Vui lòng đăng xuất và đăng nhập lại bằng tài khoản thực.');
      return;
    }

    setProfileSaving(true);
    try {
      await authService.updateProfile({
        fullName: editName.trim(),
        email: editEmail.trim(),
        avatarUrl: editAvatarUrl || undefined,
      });

      updateUser({
        fullName: editName.trim(),
        email: editEmail.trim(),
        avatarUrl: editAvatarUrl,
      });

      setProfileSuccess('Cập nhật thông tin cá nhân thành công!');
      setTimeout(() => {
        setShowEditProfileModal(false);
      }, 1500);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể cập nhật hồ sơ lúc này.';
      setProfileError(msg);
    } finally {
      setProfileSaving(false);
    }
  };

  // ==========================================
  // HANDLERS: ĐỔI SỐ ĐIỆN THOẠI & SMS OTP
  // ==========================================
  const handleOpenPhoneModal = () => {
    setNewPhone('');
    setPhoneOtp('');
    setOtpSent(false);
    setPhoneSuccess(null);
    setPhoneError(null);
    setDevOtpCode(null);
    setShowPhoneModal(true);
  };

  const handleSendSmsOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPhoneError(null);
    setPhoneSuccess(null);

    const cleanPhone = newPhone.trim();
    if (!cleanPhone || cleanPhone.length < 9) {
      setPhoneError('Vui lòng nhập số điện thoại mới hợp lệ (từ 10 chữ số).');
      return;
    }

    if (cleanPhone === currentUser?.phoneNumber) {
      setPhoneError('Số điện thoại mới trùng với số điện thoại hiện tại của bạn.');
      return;
    }

    setPhoneSubmitting(true);
    try {
      const res = await authService.sendChangePhoneOtp(cleanPhone);
      setOtpSent(true);
      setOtpCooldown(60);
      setPhoneSuccess(`Mã xác thực SMS đã được gửi tới số ${cleanPhone}. Vui lòng nhập mã để hoàn tất.`);
      if (res.otp) {
        setDevOtpCode(res.otp);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể gửi SMS lúc này. Vui lòng thử lại.';
      setPhoneError(msg);
    } finally {
      setPhoneSubmitting(false);
    }
  };

  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null);
    setPhoneSuccess(null);

    if (!phoneOtp || phoneOtp.trim().length !== 6) {
      setPhoneError('Mã OTP phải bao gồm đúng 6 chữ số.');
      return;
    }

    setPhoneSubmitting(true);
    try {
      const res = await authService.verifyChangePhoneOtp(newPhone.trim(), phoneOtp.trim());
      updateUser({
        phoneNumber: res.user?.phoneNumber || newPhone.trim(),
      });

      setPhoneSuccess('Đổi số điện thoại thành công! Dữ liệu đã được cập nhật.');
      setTimeout(() => {
        setShowPhoneModal(false);
      }, 1800);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Mã OTP không chính xác hoặc đã hết hạn.';
      setPhoneError(msg);
    } finally {
      setPhoneSubmitting(false);
    }
  };

  // ==========================================
  // HANDLERS FOR ADDRESSES
  // ==========================================
  const handleCreateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddressError(null);

    if (!newAddress.recipientName.trim() || !newAddress.phoneNumber.trim() || !newAddress.streetAddress.trim()) {
      setAddressError('Vui lòng điền đầy đủ họ tên, số điện thoại và địa chỉ giao hàng.');
      return;
    }

    try {
      const created = await addressService.createAddress(newAddress);
      setAddresses((prev) => {
        if (created.isDefault) {
          return [created, ...prev.map((a) => ({ ...a, isDefault: false }))];
        }
        return [created, ...prev];
      });
      setShowAddAddressModal(false);
      setNewAddress({
        recipientName: currentUser?.fullName || '',
        phoneNumber: currentUser?.phoneNumber || '',
        streetAddress: '',
        ward: '',
        district: '',
        city: 'TP. Hồ Chí Minh',
        isDefault: false,
      });
    } catch (err: any) {
      setAddressError(err.response?.data?.message || 'Không thể tạo địa chỉ mới lúc này.');
    }
  };

  const handleSetDefaultAddress = async (addressId: number) => {
    try {
      await addressService.setDefaultAddress(addressId);
      setAddresses((prev) =>
        prev.map((a) => ({ ...a, isDefault: a.addressId === addressId }))
      );
    } catch (e) {
      console.error('Failed to set default address', e);
    }
  };

  const handleDeleteAddress = async (addressId: number) => {
    if (!window.confirm('Quý khách có chắc chắn muốn xóa địa chỉ này?')) return;
    try {
      await addressService.deleteAddress(addressId);
      setAddresses((prev) => prev.filter((a) => a.addressId !== addressId));
    } catch (e) {
      console.error('Failed to delete address', e);
    }
  };

  // ==========================================
  // HANDLERS FOR PASSWORD CHANGE
  // ==========================================
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(null);

    if (newPassword.length < 6) {
      setPassError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setPassSubmitting(true);
    try {
      await authService.changePassword({ currentPassword, newPassword, confirmPassword });
      setPassSuccess('Đổi mật khẩu thành công! Quý khách có thể sử dụng mật khẩu mới cho lần đăng nhập tiếp theo.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPassError(err.response?.data?.message || 'Không thể đổi mật khẩu. Vui lòng kiểm tra lại mật khẩu hiện tại.');
    } finally {
      setPassSubmitting(false);
    }
  };

  // Open Review Modal for an order
  const handleOpenReview = (order: OrderDetailViewDto) => {
    const completedDate = order.completedAt ? new Date(order.completedAt) : new Date(order.createdAt);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - completedDate.getTime()) / (1000 * 3600 * 24));
    const isExpired = diffDays > 15;
    const remainingDays = Math.max(0, 15 - diffDays);

    const pendingOrder: PendingReviewOrder = {
      orderId: order.orderId,
      orderCode: order.orderNumber,
      completedAt: order.completedAt || order.createdAt,
      remainingDays,
      isExpired,
      items: order.items.map((i) => ({
        menuItemId: i.menuItemId,
        dishName: i.itemName,
        imageUrl: i.imageUrl,
        price: i.unitPrice,
      })),
    };

    setSelectedReviewOrder(pendingOrder);
    setIsReviewModalOpen(true);
  };

  // If not authenticated, prompt login
  if (!isAuthenticated || !currentUser) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center w-full px-4 py-16 text-center max-w-lg mx-auto">
        <div className="bg-sumi-900 border-2 border-kin-500/40 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl w-full space-y-6">
          <div className="w-16 h-16 rounded-full bg-sumi-800 border-2 border-kin-400 mx-auto flex items-center justify-center text-kin-400 shadow-gold-glow">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <span className="text-xs font-kanji text-kin-400 tracking-widest font-bold">会員認証</span>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-washi-100 mt-1">
              Quản Lý Tài Khoản Cá Nhân
            </h1>
            <p className="text-xs sm:text-sm text-washi-300 mt-2 leading-relaxed">
              Quý khách vui lòng đăng nhập để theo dõi hạng thành viên, sổ địa chỉ nhận hàng, lịch sử đơn hàng và thực hiện đánh giá món ăn.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={() => openAuthModal('login', 'Vui lòng đăng nhập để xem thông tin cá nhân.')}
              className="flex-1 py-3 px-5 rounded-xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-shu-700 via-shu-600 to-shu-700 hover:from-shu-600 hover:to-shu-500 border border-kin-500/40 shadow-lg shadow-shu-950 transition-all"
            >
              Đăng Nhập Ngay
            </button>
            <Link
              to="/"
              className="py-3 px-5 rounded-xl font-semibold text-xs sm:text-sm text-kin-300 bg-sumi-800 hover:bg-sumi-700 border border-kin-500/30 transition-all"
            >
              Về Trang Chủ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Tier calculation
  const points = currentUser.loyaltyPoints || 100;
  let tierName = 'BRONZE';
  let tierTitle = 'Thành Viên Đồng (Bronze)';
  let nextTierPoints = 500;
  let progressPercent = Math.min(100, Math.round((points / 500) * 100));

  if (points >= 3000) {
    tierName = 'PLATINUM';
    tierTitle = 'Thành Viên Bạch Kim (Platinum)';
    nextTierPoints = 3000;
    progressPercent = 100;
  } else if (points >= 1500) {
    tierName = 'GOLD';
    tierTitle = 'Thành Viên Vàng (Gold)';
    nextTierPoints = 3000;
    progressPercent = Math.min(100, Math.round(((points - 1500) / 1500) * 100));
  } else if (points >= 500) {
    tierName = 'SILVER';
    tierTitle = 'Thành Viên Bạc (Silver)';
    nextTierPoints = 1500;
    progressPercent = Math.min(100, Math.round(((points - 500) / 1000) * 100));
  }

  return (
    <div className="flex-1 flex flex-col py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full space-y-8">
      
      {/* Top Profile Header Card */}
      <div className="bg-gradient-to-r from-sumi-950 via-sumi-900 to-sumi-950 border-2 border-kin-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-shu-700/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            {/* Avatar with Click to Change */}
            <div className="relative group cursor-pointer" onClick={handleOpenEditProfile} title="Bấm để đổi ảnh đại diện">
              {currentUser.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.fullName}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-2 border-kin-400 shadow-gold-glow group-hover:brightness-90 transition-all"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-shu-900 via-sumi-800 to-sumi-950 border-2 border-kin-400 flex items-center justify-center text-kin-300 font-serif text-2xl sm:text-3xl font-bold shadow-gold-glow group-hover:brightness-90 transition-all">
                  {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'S'}
                </div>
              )}
              
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                <Camera className="w-6 h-6 text-kin-300" />
              </div>

              <span className="absolute bottom-0 right-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-kin-500 text-sumi-950 border border-kin-300 shadow">
                {tierName}
              </span>
            </div>

            {/* Basic Info & Edit Actions */}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-washi-100">
                  {currentUser.fullName}
                </h1>
              </div>

              <p className="text-xs text-kin-400 font-medium">{tierTitle}</p>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-washi-300 pt-1">
                {currentUser.email ? (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-kin-400/80" />
                    <span>{currentUser.email}</span>
                  </span>
                ) : (
                  <span className="text-washi-400 italic">Chưa thêm email</span>
                )}

                {currentUser.phoneNumber ? (
                  <button
                    onClick={handleOpenPhoneModal}
                    className="flex items-center gap-1 hover:text-kin-300 group"
                    title="Bấm để đổi số điện thoại xác minh SMS"
                  >
                    <Phone className="w-3.5 h-3.5 text-kin-400/80 group-hover:text-kin-400" />
                    <span>{currentUser.phoneNumber}</span>
                    <span className="text-[10px] text-kin-400 underline font-mono ml-1">(Đổi SĐT)</span>
                  </button>
                ) : (
                  <button onClick={handleOpenPhoneModal} className="text-kin-400 underline text-xs">
                    + Thêm SĐT nhận mã
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Points & Logout (Image 3 fix: straight font-sans numbers, no crooked oldstyle) */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="bg-sumi-950/80 border border-kin-500/30 rounded-2xl px-5 py-3 text-center">
              <span className="text-[10px] uppercase tracking-widest text-washi-400">Điểm Tích Lũy</span>
              <div className="text-xl sm:text-2xl font-bold font-sans tracking-tight text-kin-400 flex items-center justify-center">
                <span>{points} pts</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenEditProfile}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-kin-300 hover:text-white bg-sumi-800/80 hover:bg-sumi-700 border border-kin-500/30 flex items-center gap-1.5 transition-all shadow-md"
              >
                <Edit3 className="w-4 h-4" />
                <span>Sửa Hồ Sơ</span>
              </button>

              <button
                onClick={() => {
                  if (window.confirm('Quý khách có chắc chắn muốn đăng xuất?')) {
                    logout();
                    navigate('/');
                  }
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-shu-800/80 hover:bg-shu-700 border border-shu-600/50 flex items-center gap-1.5 transition-all shadow-md"
              >
                <LogOut className="w-4 h-4" />
                <span>Đăng Xuất</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center space-x-2 border-b border-sumi-800 overflow-x-auto pb-2 custom-scrollbar">
        <button
          onClick={() => handleTabChange('profile')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'profile'
              ? 'bg-shu-700 text-white border border-kin-500/40 shadow-md'
              : 'text-washi-300 hover:text-white hover:bg-sumi-800/60'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Hạng Thành Viên & Điểm</span>
        </button>

        <button
          onClick={() => handleTabChange('addresses')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'addresses'
              ? 'bg-shu-700 text-white border border-kin-500/40 shadow-md'
              : 'text-washi-300 hover:text-white hover:bg-sumi-800/60'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Sổ Địa Chỉ ({addresses.length})</span>
        </button>

        <button
          onClick={() => handleTabChange('orders')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'orders'
              ? 'bg-shu-700 text-white border border-kin-500/40 shadow-md'
              : 'text-washi-300 hover:text-white hover:bg-sumi-800/60'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Lịch Sử Đơn Hàng</span>
        </button>

        <button
          onClick={() => handleTabChange('reservations')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'reservations'
              ? 'bg-shu-700 text-white border border-kin-500/40 shadow-md'
              : 'text-washi-300 hover:text-white hover:bg-sumi-800/60'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Lịch Sử Đặt Bàn</span>
        </button>

        <button
          onClick={() => handleTabChange('security')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'security'
              ? 'bg-shu-700 text-white border border-kin-500/40 shadow-md'
              : 'text-washi-300 hover:text-white hover:bg-sumi-800/60'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Đổi Mật Khẩu</span>
        </button>
      </div>

      {/* Tab 1: Member Tier & Benefits & Quick Edit Card */}
      {activeTab === 'profile' && (
        <div className="space-y-8 animate-fade-in">
          
          {/* Personal Info Quick Card */}
          <div className="bg-sumi-900/90 border border-kin-500/25 rounded-2xl p-6 sm:p-7 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-kanji text-kin-400 tracking-widest font-bold">個人情報管理</span>
              <h3 className="font-serif text-lg sm:text-xl font-bold text-washi-100">
                Thông Tin Cá Nhân Của Bạn
              </h3>
              <p className="text-xs text-washi-300">
                Tên: <strong className="text-washi-100">{currentUser.fullName}</strong> • Email: <strong className="text-washi-100">{currentUser.email || 'Chưa thiết lập'}</strong> • SĐT: <strong className="text-washi-100">{currentUser.phoneNumber}</strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0">
              <button
                onClick={handleOpenEditProfile}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-shu-700 hover:bg-shu-600 border border-kin-500/30 flex items-center gap-1.5 transition-all shadow"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Chỉnh Sửa Tên & Avatar</span>
              </button>

              <button
                onClick={handleOpenPhoneModal}
                className="px-4 py-2 rounded-xl text-xs font-bold text-kin-300 hover:text-white bg-sumi-800 hover:bg-sumi-700 border border-kin-500/30 flex items-center gap-1.5 transition-all shadow"
              >
                <Smartphone className="w-3.5 h-3.5 text-kin-400" />
                <span>Đổi SĐT Xác Minh SMS</span>
              </button>
            </div>
          </div>

          {/* Tier Progression Bar */}
          <div className="bg-sumi-900/90 border border-kin-500/30 rounded-2xl p-6 sm:p-8 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-sumi-800">
              <div>
                <span className="text-[10px] font-kanji text-kin-400 tracking-widest font-bold">会員ランク進捗</span>
                <h3 className="font-serif text-lg sm:text-xl font-bold text-washi-100">
                  Tiến Trình Thăng Hạng Ẩm Thực
                </h3>
              </div>
              <span className="text-xs text-kin-300 bg-sumi-950 px-3 py-1.5 rounded-full border border-kin-500/30">
                {tierName === 'PLATINUM'
                  ? 'Quý khách đã đạt hạng cao nhất!'
                  : `Cần thêm ${nextTierPoints - points} điểm để thăng hạng tiếp theo`}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="w-full bg-sumi-950 h-3 rounded-full overflow-hidden border border-sumi-700">
                <div
                  className="bg-gradient-to-r from-kin-500 via-shu-500 to-kin-400 h-full rounded-full transition-all duration-700 shadow-gold-glow"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-washi-400 font-sans font-medium">
                <span>Bronze (0 pts)</span>
                <span>Silver (500 pts)</span>
                <span>Gold (1.500 pts)</span>
                <span>Platinum (3.000 pts)</span>
              </div>
            </div>
          </div>

          {/* 4 Tiers Benefits Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Bronze */}
            <div className={`p-5 rounded-2xl border transition-all ${
              tierName === 'BRONZE'
                ? 'bg-sumi-900 border-kin-400 shadow-gold-glow'
                : 'bg-sumi-950/70 border-sumi-800 opacity-80'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-serif font-bold text-washi-100 text-sm">Hạng Bronze</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-600/40">
                  0 - 499 pts
                </span>
              </div>
              <ul className="text-xs text-washi-300 space-y-2">
                <li className="flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-kin-400 shrink-0 mt-0.5" />
                  <span>Tích lũy 1 điểm cho mỗi 10.000₫ chi tiêu</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-kin-400 shrink-0 mt-0.5" />
                  <span>Ưu đãi 5% vào tháng sinh nhật</span>
                </li>
              </ul>
            </div>

            {/* Silver */}
            <div className={`p-5 rounded-2xl border transition-all ${
              tierName === 'SILVER'
                ? 'bg-sumi-900 border-kin-400 shadow-gold-glow'
                : 'bg-sumi-950/70 border-sumi-800 opacity-80'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-serif font-bold text-washi-100 text-sm">Hạng Silver</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-500/40">
                  500 - 1.499 pts
                </span>
              </div>
              <ul className="text-xs text-washi-300 space-y-2">
                <li className="flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-kin-400 shrink-0 mt-0.5" />
                  <span>Tặng voucher 100.000₫ mỗi quý</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-kin-400 shrink-0 mt-0.5" />
                  <span>Giảm 8% vào tháng sinh nhật</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-kin-400 shrink-0 mt-0.5" />
                  <span>Ưu tiên xác nhận đặt bàn</span>
                </li>
              </ul>
            </div>

            {/* Gold */}
            <div className={`p-5 rounded-2xl border transition-all ${
              tierName === 'GOLD'
                ? 'bg-sumi-900 border-kin-400 shadow-gold-glow'
                : 'bg-sumi-950/70 border-sumi-800 opacity-80'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-serif font-bold text-washi-100 text-sm">Hạng Gold</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-900/60 text-kin-300 border border-kin-500/40">
                  1.500 - 2.999 pts
                </span>
              </div>
              <ul className="text-xs text-washi-300 space-y-2">
                <li className="flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-kin-400 shrink-0 mt-0.5" />
                  <span>Miễn phí tráng miệng cao cấp mỗi lần ghé quán</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-kin-400 shrink-0 mt-0.5" />
                  <span>Tích 1.5x điểm thưởng</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-kin-400 shrink-0 mt-0.5" />
                  <span>Ưu tiên chọn phòng VIP & Tatami</span>
                </li>
              </ul>
            </div>

            {/* Platinum */}
            <div className={`p-5 rounded-2xl border transition-all ${
              tierName === 'PLATINUM'
                ? 'bg-sumi-900 border-kin-400 shadow-gold-glow'
                : 'bg-sumi-950/70 border-sumi-800 opacity-80'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-serif font-bold text-washi-100 text-sm">Hạng Platinum</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-shu-950 text-kin-300 border border-shu-500/60">
                  3.000+ pts
                </span>
              </div>
              <ul className="text-xs text-washi-300 space-y-2">
                <li className="flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-kin-400 shrink-0 mt-0.5" />
                  <span>Trải nghiệm Omakase riêng cùng Bếp Trưởng</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-kin-400 shrink-0 mt-0.5" />
                  <span>Giảm 15% tổng hóa đơn mọi lần dùng bữa</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-kin-400 shrink-0 mt-0.5" />
                  <span>Hotline đặt bàn riêng biệt 24/7</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Address Book */}
      {activeTab === 'addresses' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-kanji text-kin-400 tracking-widest font-bold">配送先住所録</span>
              <h3 className="font-serif text-lg sm:text-xl font-bold text-washi-100">
                Sổ Địa Chỉ Nhận Hàng
              </h3>
              <p className="text-xs text-washi-300 mt-1">
                Quản lý các địa chỉ giao món quen thuộc của bạn để đặt hàng thuận tiện nhất.
              </p>
            </div>

            <button
              onClick={() => {
                setAddressError(null);
                setShowAddAddressModal(true);
              }}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-shu-700 to-shu-600 hover:from-shu-600 hover:to-shu-500 border border-kin-500/30 flex items-center gap-2 self-start sm:self-auto shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Địa Chỉ Mới</span>
            </button>
          </div>

          {loadingAddresses ? (
            <div className="py-12 text-center text-xs text-washi-400">
              Đang tải danh sách địa chỉ...
            </div>
          ) : addresses.length === 0 ? (
            <div className="bg-sumi-900/60 border border-kin-500/20 rounded-2xl p-8 sm:p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-sumi-800 border border-kin-500/30 mx-auto flex items-center justify-center text-kin-400 shadow-gold-glow">
                <Home className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="font-serif text-base font-bold text-washi-100">
                  Chưa Có Địa Chỉ Nào Được Lưu
                </h4>
                <p className="text-xs text-washi-300 leading-relaxed">
                  Quý khách có thể bấm <strong>"Thêm Địa Chỉ Mới"</strong> tại đây hoặc nhập địa chỉ trong lúc thanh toán đơn hàng để lưu lại cho các lần dùng bữa tiếp theo.
                </p>
              </div>
              <button
                onClick={() => setShowAddAddressModal(true)}
                className="px-5 py-2 rounded-full text-xs font-semibold text-kin-300 bg-sumi-950 border border-kin-500/40 hover:border-kin-400 transition-all inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thiết Lập Địa Chỉ Đầu Tiên</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {addresses.map((addr) => (
                <div
                  key={addr.addressId}
                  className={`bg-sumi-900/90 border rounded-2xl p-5 space-y-3 relative transition-all ${
                    addr.isDefault
                      ? 'border-kin-400 shadow-gold-glow'
                      : 'border-kin-500/20 hover:border-kin-500/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-serif font-bold text-sm text-washi-100">
                          {addr.recipientName}
                        </span>
                        {addr.isDefault && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-semibold">
                            Mặc Định
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-washi-400 font-mono">{addr.phoneNumber}</p>
                    </div>

                    <button
                      onClick={() => handleDeleteAddress(addr.addressId)}
                      aria-label="Xóa địa chỉ"
                      className="p-1.5 text-washi-400 hover:text-red-400 hover:bg-sumi-800 rounded-lg transition-colors"
                      title="Xóa địa chỉ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-washi-200 leading-relaxed pt-1">
                    {addr.fullAddress || [addr.streetAddress, addr.ward, addr.district, addr.city].filter(Boolean).join(', ')}
                  </p>

                  <div className="pt-2 border-t border-sumi-800 flex items-center justify-between">
                    {!addr.isDefault ? (
                      <button
                        onClick={() => handleSetDefaultAddress(addr.addressId)}
                        className="text-xs text-kin-300 hover:text-kin-200 hover:underline"
                      >
                        Đặt làm địa chỉ mặc định
                      </button>
                    ) : (
                      <span className="text-[11px] text-kin-400/80">Địa chỉ ưu tiên khi đặt món</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Address Modal */}
          {showAddAddressModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
              <div className="w-full max-w-lg bg-sumi-900 border-2 border-kin-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-sumi-800">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-kin-400" />
                    <h3 className="font-serif text-lg font-bold text-washi-100">Thêm Địa Chỉ Nhận Hàng</h3>
                  </div>
                  <button
                    onClick={() => setShowAddAddressModal(false)}
                    aria-label="Đóng modal"
                    className="p-1.5 text-washi-400 hover:text-white rounded-lg"
                  >
                    ✕
                  </button>
                </div>

                {addressError && (
                  <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs">
                    {addressError}
                  </div>
                )}

                <form onSubmit={handleCreateAddress} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-washi-300 mb-1">Họ tên người nhận *</label>
                      <input
                        type="text"
                        required
                        value={newAddress.recipientName}
                        onChange={(e) => setNewAddress({ ...newAddress, recipientName: e.target.value })}
                        className="w-full bg-sumi-950 border border-sumi-700 rounded-xl px-3 py-2 text-xs text-washi-100 focus:outline-none focus:border-kin-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-washi-300 mb-1">Số điện thoại *</label>
                      <input
                        type="tel"
                        required
                        value={newAddress.phoneNumber}
                        onChange={(e) => setNewAddress({ ...newAddress, phoneNumber: e.target.value })}
                        className="w-full bg-sumi-950 border border-sumi-700 rounded-xl px-3 py-2 text-xs text-washi-100 focus:outline-none focus:border-kin-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-washi-300 mb-1">Địa chỉ chi tiết (Số nhà, tên đường) *</label>
                    <input
                      type="text"
                      required
                      placeholder="ví dụ: 18A Lê Thánh Tôn"
                      value={newAddress.streetAddress}
                      onChange={(e) => setNewAddress({ ...newAddress, streetAddress: e.target.value })}
                      className="w-full bg-sumi-950 border border-sumi-700 rounded-xl px-3 py-2 text-xs text-washi-100 focus:outline-none focus:border-kin-400"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-washi-300 mb-1">Phường / Xã</label>
                      <input
                        type="text"
                        placeholder="Bến Nghé"
                        value={newAddress.ward}
                        onChange={(e) => setNewAddress({ ...newAddress, ward: e.target.value })}
                        className="w-full bg-sumi-950 border border-sumi-700 rounded-xl px-3 py-2 text-xs text-washi-100 focus:outline-none focus:border-kin-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-washi-300 mb-1">Quận / Huyện</label>
                      <input
                        type="text"
                        placeholder="Quận 1"
                        value={newAddress.district}
                        onChange={(e) => setNewAddress({ ...newAddress, district: e.target.value })}
                        className="w-full bg-sumi-950 border border-sumi-700 rounded-xl px-3 py-2 text-xs text-washi-100 focus:outline-none focus:border-kin-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-washi-300 mb-1">Tỉnh / Thành phố</label>
                      <input
                        type="text"
                        value={newAddress.city}
                        onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                        className="w-full bg-sumi-950 border border-sumi-700 rounded-xl px-3 py-2 text-xs text-washi-100 focus:outline-none focus:border-kin-400"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={newAddress.isDefault}
                      onChange={(e) => setNewAddress({ ...newAddress, isDefault: e.target.checked })}
                      className="rounded border-sumi-700 text-shu-600 focus:ring-kin-400"
                    />
                    <span className="text-xs text-washi-200">Đặt làm địa chỉ nhận hàng mặc định</span>
                  </label>

                  <div className="pt-3 flex justify-end gap-2 border-t border-sumi-800">
                    <button
                      type="button"
                      onClick={() => setShowAddAddressModal(false)}
                      className="px-4 py-2 rounded-xl text-xs text-washi-400 hover:text-white bg-sumi-800"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-shu-700 hover:bg-shu-600 border border-kin-500/30"
                    >
                      Lưu Địa Chỉ
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Security & Change Password */}
      {activeTab === 'security' && (
        <div className="max-w-xl mx-auto w-full space-y-6 animate-fade-in">
          <div className="bg-sumi-900/90 border border-kin-500/30 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
            <div className="pb-4 border-b border-sumi-800">
              <span className="text-[10px] font-kanji text-kin-400 tracking-widest font-bold">パスワード変更</span>
              <h3 className="font-serif text-lg sm:text-xl font-bold text-washi-100">
                Đổi Mật Khẩu Tài Khoản
              </h3>
              <p className="text-xs text-washi-300 mt-1">
                Để bảo vệ quyền lợi thành viên và thông tin đơn hàng, vui lòng sử dụng mật khẩu an toàn.
              </p>
            </div>

            {passSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{passSuccess}</span>
              </div>
            )}

            {passError && (
              <div className="p-3.5 rounded-xl bg-red-950/70 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{passError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs text-washi-300 mb-1">Mật khẩu hiện tại *</label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Nhập mật khẩu đang dùng"
                    className="w-full bg-sumi-950 border border-sumi-700 rounded-xl px-3 py-2.5 text-xs text-washi-100 focus:outline-none focus:border-kin-400 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-washi-400 hover:text-white"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-washi-300 mb-1">Mật khẩu mới * (tối thiểu 6 ký tự)</label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nhập mật khẩu mới"
                    className="w-full bg-sumi-950 border border-sumi-700 rounded-xl px-3 py-2.5 text-xs text-washi-100 focus:outline-none focus:border-kin-400 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-washi-400 hover:text-white"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-washi-300 mb-1">Xác nhận mật khẩu mới *</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  className="w-full bg-sumi-950 border border-sumi-700 rounded-xl px-3 py-2.5 text-xs text-washi-100 focus:outline-none focus:border-kin-400"
                />
              </div>

              <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-sumi-800">
                <button
                  type="button"
                  onClick={() => openAuthModal('forgot')}
                  className="text-xs text-kin-400 hover:text-kin-300 underline font-medium"
                >
                  Quên mật khẩu?
                </button>

                <button
                  type="submit"
                  disabled={passSubmitting}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-shu-700 via-shu-600 to-shu-700 hover:from-shu-600 hover:to-shu-500 border border-kin-500/40 shadow-md transition-all disabled:opacity-50"
                >
                  {passSubmitting ? 'Đang Xử Lý...' : 'Cập Nhật Mật Khẩu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab 4: Order History & Tracking & Reviews */}
      {activeTab === 'orders' && (
        <div className="space-y-6 animate-fade-in">
          <div>
            <span className="text-[10px] font-kanji text-kin-400 tracking-widest font-bold">注文履歴 & 追跡</span>
            <h3 className="font-serif text-lg sm:text-xl font-bold text-washi-100">
              Lịch Sử Đơn Hàng & Theo Dõi Món Ăn
            </h3>
            <p className="text-xs text-washi-300 mt-1">
              Xem tiến trình bếp chuẩn bị, giao hàng và đánh giá món ăn trong vòng 15 ngày kể từ ngày nhận hàng.
            </p>
          </div>

          {loadingOrders ? (
            <div className="py-12 text-center text-xs text-washi-400">
              Đang tải danh sách đơn hàng...
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-sumi-900/60 border border-kin-500/20 rounded-2xl p-8 sm:p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-sumi-800 border border-kin-500/30 mx-auto flex items-center justify-center text-kin-400 shadow-gold-glow">
                <ShoppingBag className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="font-serif text-base font-bold text-washi-100">
                  Quý Khách Chưa Có Đơn Hàng Nào
                </h4>
                <p className="text-xs text-washi-300 leading-relaxed">
                  Khám phá thực đơn tinh hoa Nhật Bản của Tori Sakura và thưởng thức những món ăn chuẩn vị ngay hôm nay.
                </p>
              </div>
              <Link
                to="/menu"
                className="px-6 py-2.5 rounded-full text-xs font-semibold text-white bg-shu-700 hover:bg-shu-600 border border-kin-500/30 transition-all inline-block"
              >
                Khám Phá Menu Ngay
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {orders.map((ord) => {
                const completedDate = ord.completedAt ? new Date(ord.completedAt) : new Date(ord.createdAt);
                const now = new Date();
                const diffDays = Math.floor((now.getTime() - completedDate.getTime()) / (1000 * 3600 * 24));
                const normStatus = (ord.status || '').toUpperCase();
                const isCompleted = normStatus === 'COMPLETED';
                const isCancelled = normStatus === 'CANCELLED';
                const isExpired = diffDays > 15;
                const remainingDays = Math.max(0, 15 - diffDays);

                const allItemsReady =
                  Array.isArray(ord.items) &&
                  ord.items.length > 0 &&
                  ord.items.every((it) =>
                    ['READY', 'SERVED', 'CANCELLED'].includes((it.itemStatus || '').toUpperCase())
                  );

                const step = isCompleted
                  ? 5
                  : normStatus === 'READYFORDISPATCH' ||
                    normStatus === 'DELIVERING' ||
                    normStatus === 'SERVED' ||
                    (normStatus === 'INPREPARATION' && allItemsReady)
                  ? 4
                  : normStatus === 'INPREPARATION' || normStatus === 'COOKING'
                  ? 3
                  : normStatus === 'PAID' || normStatus === 'DEPOSIT_CONFIRMED' || normStatus === 'CONFIRMED'
                  ? 2
                  : 1;

                const statusLabel = isCompleted
                  ? 'Hoàn tất • Đã giao'
                  : isCancelled
                  ? 'Đã hủy'
                  : step === 4
                  ? 'Bếp đã xong • Đang giao hàng'
                  : step === 3
                  ? 'Bếp đang chế biến (KDS)'
                  : step === 2
                  ? 'Đã xác nhận'
                  : 'Đã tiếp nhận';

                return (
                  <div
                    key={ord.orderId}
                    className="bg-sumi-900/90 border border-kin-500/25 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-sumi-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-kin-400 text-sm sm:text-base">
                            #{ord.orderNumber}
                          </span>
                          <span
                            className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                              isCompleted
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                : isCancelled
                                ? 'bg-red-950 text-red-300 border border-red-500/40'
                                : step === 4
                                ? 'bg-sky-950 text-sky-300 border border-sky-500/40'
                                : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                            }`}
                          >
                            {statusLabel}
                          </span>
                        </div>
                        <p className="text-[11px] text-washi-400 mt-0.5 font-sans">
                          Ngày đặt: {new Date(ord.createdAt).toLocaleString('vi-VN')}
                          {ord.orderType ? ` • ${ord.orderType === 'Delivery' ? 'Giao hàng tận nơi' : ord.orderType === 'Takeaway' ? 'Mang về' : 'Tại bàn'}` : ''}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] text-washi-400 block">Tổng thanh toán:</span>
                        <span className="font-bold font-sans tracking-tight text-base sm:text-lg text-kin-400">
                          {ord.totalAmount.toLocaleString('vi-VN')}₫
                        </span>
                      </div>
                    </div>

                    {!isCancelled && (
                      <div className="bg-sumi-950/70 border border-sumi-800 rounded-xl p-4">
                        <div className="grid grid-cols-5 text-center gap-1">
                          {[
                            { title: 'Đã đặt', idx: 1 },
                            { title: 'Đã cọc / Xác nhận', idx: 2 },
                            { title: 'Đang nấu', idx: 3 },
                            { title: 'Đang giao', idx: 4 },
                            { title: 'Hoàn tất', idx: 5 },
                          ].map((s) => (
                            <div key={s.idx} className="flex flex-col items-center">
                              <div
                                className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] font-bold mb-1.5 transition-all ${
                                  step >= s.idx
                                    ? 'bg-shu-600 text-white shadow-gold-glow'
                                    : 'bg-sumi-800 text-washi-400'
                                }`}
                              >
                                {step >= s.idx ? '✓' : s.idx}
                              </div>
                              <span
                                className={`text-[10px] sm:text-xs truncate max-w-full ${
                                  step >= s.idx ? 'text-kin-400 font-semibold' : 'text-washi-400'
                                }`}
                              >
                                {s.title}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      {ord.items.map((item) => {
                        const itStat = (item.itemStatus || '').toUpperCase();
                        const itemBadge =
                          isCompleted || itStat === 'SERVED'
                            ? { text: '✓ Đã giao', cls: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/30' }
                            : itStat === 'READY'
                            ? { text: '✨ Bếp nấu xong', cls: 'bg-sky-950/80 text-sky-300 border-sky-500/30' }
                            : itStat === 'CANCELLED'
                            ? { text: 'Đã hủy', cls: 'bg-red-950/80 text-red-300 border-red-500/30' }
                            : { text: '🔥 Đang chế biến', cls: 'bg-amber-950/80 text-amber-300 border-amber-500/30' };

                        return (
                          <div
                            key={item.orderItemId}
                            className="flex items-center justify-between gap-3 text-xs py-2 border-b border-sumi-800/60 last:border-0"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {item.imageUrl && (
                                <img
                                  src={item.imageUrl}
                                  alt={item.itemName}
                                  className="w-10 h-10 rounded-lg object-cover border border-kin-500/20 shrink-0"
                                />
                              )}
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold text-washi-100 truncate">
                                    {item.itemName}
                                  </span>
                                  <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${itemBadge.cls}`}>
                                    {itemBadge.text}
                                  </span>
                                </div>
                                <span className="text-washi-400 text-[11px] font-sans block">
                                  {item.quantity}x • {item.unitPrice.toLocaleString('vi-VN')}₫
                                  {item.specialInstructions ? ` • Ghi chú: ${item.specialInstructions}` : ''}
                                </span>
                              </div>
                            </div>

                            <span className="font-sans font-bold text-kin-300 shrink-0">
                              {item.totalPrice.toLocaleString('vi-VN')}₫
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-3 border-t border-sumi-800 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-washi-300">
                        {ord.deliveryAddress && (
                          <span className="truncate max-w-md block">
                            Giao tới: <strong className="text-washi-100">{ord.deliveryAddress}</strong>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {!isCompleted && !isCancelled && (
                          <button
                            type="button"
                            disabled={confirmingOrderId === ord.orderId}
                            onClick={() => void handleConfirmOrderReceived(ord.orderId)}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 border border-emerald-400/40 shadow-md flex items-center gap-1.5 transition-all"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>
                              {confirmingOrderId === ord.orderId
                                ? 'Đang xác nhận...'
                                : 'Đã Nhận Được Hàng'}
                            </span>
                          </button>
                        )}

                        {isCompleted && (
                          <>
                            {ord.isReviewed || localReviewedIds[ord.orderId] ? (
                              <button
                                type="button"
                                disabled
                                className="px-4 py-2 rounded-xl text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 shadow-sm flex items-center gap-1.5 cursor-not-allowed opacity-90"
                                title="Đơn hàng này đã được gửi đánh giá thành công"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Đã Đánh Giá</span>
                              </button>
                            ) : isExpired ? (
                              <span className="text-xs text-red-400/90 font-medium bg-red-950/40 px-3 py-1.5 rounded-lg border border-red-500/20">
                                Đã quá hạn đánh giá (quá 15 ngày)
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenReview(ord)}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-shu-700 via-shu-600 to-shu-700 hover:from-shu-600 hover:to-shu-500 border border-kin-500/40 shadow-md flex items-center gap-1.5 transition-all"
                              >
                                <Star className="w-3.5 h-3.5 fill-kin-400 text-kin-400" />
                                <span>Đánh Giá Món Ăn (Còn {remainingDays} ngày)</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Reservation History */}
      {activeTab === 'reservations' && (
        <div className="space-y-6 animate-fade-in">
          <div>
            <span className="text-[10px] font-kanji text-kin-400 tracking-widest font-bold">予約履歴</span>
            <h3 className="font-serif text-lg sm:text-xl font-bold text-washi-100">
              Lịch Sử Đặt Bàn Trực Tuyến
            </h3>
            <p className="text-xs text-washi-300 mt-1">
              Theo dõi tình trạng bàn tiệc của quý khách tại các chi nhánh Tori Sakura.
            </p>
          </div>

          {loadingReservations ? (
            <div className="py-12 text-center text-xs text-washi-400">
              Đang tải lịch sử đặt bàn...
            </div>
          ) : reservations.length === 0 ? (
            <div className="bg-sumi-900/60 border border-kin-500/20 rounded-2xl p-8 sm:p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-sumi-800 border border-kin-500/30 mx-auto flex items-center justify-center text-kin-400 shadow-gold-glow">
                <Calendar className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="font-serif text-base font-bold text-washi-100">
                  Chưa Có Lịch Đặt Bàn Nào
                </h4>
                <p className="text-xs text-washi-300 leading-relaxed">
                  Đặt bàn trước để được ưu tiên sắp xếp không gian ẩm thực riêng tư, ấm cúng chuẩn phong cách Nhật.
                </p>
              </div>
              <Link
                to="/reservation"
                className="px-6 py-2.5 rounded-full text-xs font-semibold text-white bg-shu-700 hover:bg-shu-600 border border-kin-500/30 transition-all inline-block"
              >
                Đặt Bàn Ngay Bây Giờ
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reservations.map((rsv) => (
                <div
                  key={rsv.reservationId}
                  className="bg-sumi-900/90 border border-kin-500/25 rounded-2xl p-5 space-y-3 shadow-xl"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-sumi-800">
                    <span className="font-mono font-bold text-kin-400 text-sm">
                      #{rsv.reservationCode}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                      {rsv.status}
                    </span>
                  </div>

                  <div className="text-xs space-y-1.5 text-washi-300">
                    <div className="flex justify-between">
                      <span className="text-washi-400">Thời gian dùng bữa:</span>
                      <span className="font-bold text-washi-100 font-sans">
                        {new Date(rsv.reservationTime).toLocaleString('vi-VN')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-washi-400">Số lượng khách:</span>
                      <span className="font-bold text-kin-400 font-sans">{rsv.guestCount} khách</span>
                    </div>
                    {rsv.tableName && (
                      <div className="flex justify-between">
                        <span className="text-washi-400">Bàn chỉ định:</span>
                        <span className="font-bold text-washi-100">{rsv.tableName}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 1: CHỈNH SỬA THÔNG TIN CÁ NHÂN (TÊN, MAIL, AVATAR) */}
      {/* ==================================================== */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg bg-sumi-900 border-2 border-kin-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-sumi-800">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-kin-400" />
                <h3 className="font-serif text-lg font-bold text-washi-100">Chỉnh Sửa Thông Tin Cá Nhân</h3>
              </div>
              <button
                onClick={() => setShowEditProfileModal(false)}
                className="p-1.5 text-washi-400 hover:text-white rounded-lg"
              >
                ✕
              </button>
            </div>

            {profileSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{profileSuccess}</span>
              </div>
            )}

            {profileError && (
              <div className="p-3.5 rounded-xl bg-red-950/70 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-5">
              {/* Avatar Selector & Upload */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-washi-200">
                  Ảnh Đại Diện (Avatar)
                </label>
                
                <div className="flex items-center gap-4">
                  {/* Current Preview */}
                  <div className="relative shrink-0">
                    {editAvatarUrl ? (
                      <img
                        src={editAvatarUrl}
                        alt="Preview Avatar"
                        className="w-16 h-16 rounded-full object-cover border-2 border-kin-400 shadow-gold-glow"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-sumi-800 border-2 border-kin-400/50 flex items-center justify-center text-kin-400 font-bold text-xl">
                        {editName ? editName.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}
                  </div>

                  {/* Upload button & Direct input */}
                  <div className="flex-1 space-y-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-kin-300 bg-sumi-950 border border-kin-500/30 hover:border-kin-400 cursor-pointer transition-all">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Tải ảnh từ máy tính</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUploadAvatar}
                        className="hidden"
                      />
                    </label>
                    <input
                      type="url"
                      placeholder="Hoặc dán URL hình ảnh..."
                      value={editAvatarUrl}
                      onChange={(e) => setEditAvatarUrl(e.target.value)}
                      className="w-full bg-sumi-950 border border-sumi-700 rounded-xl px-3 py-1.5 text-xs text-washi-100 focus:outline-none focus:border-kin-400"
                    />
                  </div>
                </div>

                {/* Preset Avatars */}
                <div className="pt-2">
                  <span className="text-[11px] text-washi-400 block mb-2">Hoặc chọn avatar phong cách Nhật:</span>
                  <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                    {PRESET_AVATARS.map((av) => (
                      <button
                        key={av.id}
                        type="button"
                        onClick={() => setEditAvatarUrl(av.url)}
                        className={`relative rounded-full border-2 p-0.5 transition-all shrink-0 ${
                          editAvatarUrl === av.url ? 'border-kin-400 scale-110 shadow-gold-glow' : 'border-sumi-700 opacity-70 hover:opacity-100'
                        }`}
                        title={av.name}
                      >
                        <img src={av.url} alt={av.name} className="w-9 h-9 rounded-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs text-washi-300 mb-1">Họ và tên *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nhập họ và tên đầy đủ"
                  className="w-full bg-sumi-950 border border-sumi-700 rounded-xl px-3 py-2.5 text-xs text-washi-100 focus:outline-none focus:border-kin-400"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs text-washi-300 mb-1">Địa chỉ Email nhận hóa đơn & ưu đãi</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-sumi-950 border border-sumi-700 rounded-xl px-3 py-2.5 text-xs text-washi-100 focus:outline-none focus:border-kin-400"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-sumi-800">
                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-washi-400 hover:text-white bg-sumi-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-shu-700 hover:bg-shu-600 border border-kin-500/30 disabled:opacity-50"
                >
                  {profileSaving ? 'Đang Lưu...' : 'Lưu Thay Đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 2: ĐỔI SỐ ĐIỆN THOẠI & XÁC MINH SMS OTP        */}
      {/* ==================================================== */}
      {showPhoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md bg-sumi-900 border-2 border-kin-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-sumi-800">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-kin-400" />
                <h3 className="font-serif text-lg font-bold text-washi-100">Đổi Số Điện Thoại</h3>
              </div>
              <button
                onClick={() => setShowPhoneModal(false)}
                className="p-1.5 text-washi-400 hover:text-white rounded-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-washi-300">
              Để bảo mật tài khoản và xác thực đơn giao hàng, hệ thống sẽ gửi một mã OTP qua tin nhắn SMS tới số điện thoại mới.
            </p>

            {phoneSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{phoneSuccess}</span>
              </div>
            )}

            {phoneError && (
              <div className="p-3.5 rounded-xl bg-red-950/70 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{phoneError}</span>
              </div>
            )}

            {devOtpCode && (
              <div className="p-2.5 rounded-lg bg-sumi-950 border border-kin-500/30 text-[11px] text-kin-300 flex items-center justify-between">
                <span>Mã SMS OTP giả lập kiểm thử:</span>
                <span className="font-mono font-bold text-white text-xs bg-shu-800 px-2 py-0.5 rounded">{devOtpCode}</span>
              </div>
            )}

            {!otpSent ? (
              // Step 1: Nhập SĐT & Gửi SMS OTP
              <form onSubmit={handleSendSmsOtp} className="space-y-4">
                <div>
                  <label className="block text-xs text-washi-300 mb-1">Số điện thoại mới *</label>
                  <input
                    type="tel"
                    required
                    placeholder="ví dụ: 0908123456"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full bg-sumi-950 border border-sumi-700 rounded-xl px-3 py-2.5 text-xs text-washi-100 focus:outline-none focus:border-kin-400 font-mono"
                  />
                  <span className="text-[10px] text-washi-400 mt-1 block">
                    Số hiện tại: {currentUser.phoneNumber || 'Chưa đăng ký'}
                  </span>
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-sumi-800">
                  <button
                    type="button"
                    onClick={() => setShowPhoneModal(false)}
                    className="px-4 py-2 rounded-xl text-xs text-washi-400 hover:text-white bg-sumi-800"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={phoneSubmitting}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-shu-700 hover:bg-shu-600 border border-kin-500/30 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <span>{phoneSubmitting ? 'Đang Gửi SMS...' : 'Gửi Mã Xác Minh SMS'}</span>
                  </button>
                </div>
              </form>
            ) : (
              // Step 2: Nhập OTP & Xác thực
              <form onSubmit={handleVerifyPhoneOtp} className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs text-washi-300">Nhập mã OTP (6 số) *</label>
                    {otpCooldown > 0 ? (
                      <span className="text-[11px] text-kin-400 font-mono">Gửi lại sau {otpCooldown}s</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSendSmsOtp()}
                        className="text-[11px] text-kin-400 hover:underline flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Gửi lại mã SMS</span>
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    autoFocus
                    placeholder="123456"
                    value={phoneOtp}
                    onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-sumi-950 border-2 border-kin-500/40 rounded-xl px-4 py-3 text-center text-lg tracking-[0.5em] font-mono text-white focus:outline-none focus:border-kin-400"
                  />
                  <p className="text-[10px] text-washi-400 mt-1.5 text-center">
                    Đã gửi SMS tới: <strong>{newPhone}</strong> (
                    <button
                      type="button"
                      onClick={() => setOtpSent(false)}
                      className="text-kin-400 underline"
                    >
                      đổi số khác
                    </button>
                    )
                  </p>
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-sumi-800">
                  <button
                    type="button"
                    onClick={() => setShowPhoneModal(false)}
                    className="px-4 py-2 rounded-xl text-xs text-washi-400 hover:text-white bg-sumi-800"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    disabled={phoneSubmitting || phoneOtp.length !== 6}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-shu-700 to-shu-600 hover:from-shu-600 hover:to-shu-500 border border-kin-500/40 disabled:opacity-40"
                  >
                    {phoneSubmitting ? 'Đang Xác Minh...' : 'Xác Nhận & Cập Nhật'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Reusable Order Review Modal for this page */}
      <OrderReviewModal
        order={selectedReviewOrder}
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        onSuccess={(reviewedOrderId) => {
          if (reviewedOrderId) {
            setLocalReviewedIds((prev) => ({ ...prev, [reviewedOrderId]: true }));
          }
          setIsReviewModalOpen(false);
          void loadOrders(true);
        }}
      />
    </div>
  );
};
