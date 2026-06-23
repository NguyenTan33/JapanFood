import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Calendar, 
  Clock, 
  Users, 
  MapPin, 
  CheckCircle2, 
  Sparkles, 
  Phone, 
  Mail, 
  User, 
  ArrowRight, 
  ChevronLeft,
  ShieldCheck,
  Building2
} from 'lucide-react';
import { BranchLocation, TableArea, ReservationAreaId } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { reservationService } from '@/services/reservationService';
import { branchService } from '@/services/branchService';
import confetti from 'canvas-confetti';
import { getLocalDateString, formatVietnameseDate } from '@/utils/dateUtils';

export const ReservationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { currentUser, isAuthenticated, openAuthModal } = useAuth();

  const [branches, setBranches] = useState<BranchLocation[]>([]);
  const [tableAreas, setTableAreas] = useState<TableArea[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const todayStr = getLocalDateString();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = getLocalDateString(tomorrow);
  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 2);
  const dayAfterStr = getLocalDateString(dayAfter);

  // Wizard Step
  const [step, setStep] = useState(1);
  const [isSuccess, setIsSuccess] = useState(false);
  const [reservationCode, setReservationCode] = useState('');
  const [reservationError, setReservationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [branchId, setBranchId] = useState(() => searchParams.get('branch') || '');
  const [reservationDate, setReservationDate] = useState(() => {
    const paramDate = searchParams.get('date');
    if (paramDate && paramDate >= todayStr) return paramDate;
    return todayStr;
  });
  const [reservationTime, setReservationTime] = useState(() => searchParams.get('time') || '19:00');
  const [guestCount, setGuestCount] = useState<number>(() => Number(searchParams.get('guests')) || 2);
  const [areaId, setAreaId] = useState<ReservationAreaId>('main-dining');
  const [customerName, setCustomerName] = useState(() => currentUser?.fullName || '');
  const [customerPhone, setCustomerPhone] = useState(() => currentUser?.phoneNumber || '');
  const [customerEmail, setCustomerEmail] = useState(() => currentUser?.email || '');
  const [specialRequest, setSpecialRequest] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [branchList, areaList] = await Promise.all([
          branchService.getBranches(),
          reservationService.getAreas()
        ]);
        if (!isMounted) return;
        setBranches(branchList);
        setTableAreas(areaList);
        if (branchList.length > 0) {
          const paramBranch = searchParams.get('branch');
          const matchedBranch = branchList.find(b => b.id === paramBranch);
          setBranchId(matchedBranch ? matchedBranch.id : branchList[0].id);
        }
        if (areaList.length > 0) {
          setAreaId(areaList[0].id);
        }
      } catch (err) {
        console.error('Lỗi tải danh mục đặt bàn:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (currentUser) {
      if (!customerName) setCustomerName(currentUser.fullName || '');
      if (!customerPhone) setCustomerPhone(currentUser.phoneNumber || '');
      if (!customerEmail) setCustomerEmail(currentUser.email || '');
    }
  }, [currentUser]);

  const selectedBranch = branches.find((b) => b.id === branchId) || branches[0];
  const selectedArea = tableAreas.find((a) => a.id === areaId) || tableAreas[0];

  const timeSlots = [
    '11:00', '11:30', '12:00', '12:30', '13:00',
    '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30'
  ];

  const isToday = reservationDate === todayStr;
  const isSlotPast = (slotTime: string) => {
    if (!isToday) return false;
    const now = new Date();
    const [h, m] = slotTime.split(':').map(Number);
    const slotMinutes = h * 60 + m;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return slotMinutes <= currentMinutes + 30; // phải trước tối thiểu 30 phút
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReservationError(null);

    if (!isAuthenticated) {
      openAuthModal('login', 'Quý khách vui lòng đăng nhập để đặt bàn giữ chỗ trực tuyến.');
      return;
    }

    if (reservationDate < todayStr) {
      setReservationError('Ngày đặt bàn không được ở quá khứ. Quý khách vui lòng chọn ngày từ hôm nay trở đi.');
      return;
    }

    if (isSlotPast(reservationTime)) {
      setReservationError('Giờ đặt bàn không được ở quá khứ. Vui lòng chọn khung giờ cách thời điểm hiện tại tối thiểu 30 phút.');
      return;
    }

    setIsSubmitting(true);
    try {
      const reservationIso = `${reservationDate}T${reservationTime}:00`;
      const res = await reservationService.createReservation({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || undefined,
        guestCount,
        reservationTime: reservationIso,
        preferredAreaId: selectedArea?.dbId || areaId,
        specialRequests: specialRequest.trim() || undefined,
      });

      setReservationCode(res.reservationCode);
      setIsSuccess(true);

      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#D4A359', '#8B1E1E', '#FFFFFF'],
        });
      } catch (e) {
        // Ignore
      }
    } catch (err: any) {
      console.error('Reservation failed:', err);
      const errData = err.response?.data;
      let msg = errData?.message;
      if (!msg && errData?.errors) {
        const errValues = Object.values(errData.errors).flat();
        msg = errValues.join('; ');
      }
      if (!msg) {
        msg = errData?.title || err.message || 'Không thể đặt bàn lúc này. Vui lòng kiểm tra lại thông tin và thử lại.';
      }
      setReservationError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated && !isSuccess) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center w-full px-4 py-12 sm:py-16 text-center max-w-lg mx-auto my-4 sm:my-8">
        <div className="bg-sumi-900/90 border-2 border-kin-500/40 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl w-full space-y-6">
          <div className="w-16 h-16 rounded-full bg-sumi-800 border-2 border-kin-400 mx-auto flex items-center justify-center text-kin-400 shadow-gold-glow">
            <Calendar className="w-8 h-8" />
          </div>
          <div>
            <span className="text-xs font-kanji text-kin-400 tracking-widest font-bold">予約認証</span>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-washi-100 mt-1">
              Yêu Cầu Đăng Nhập Đặt Bàn
            </h1>
            <p className="text-xs sm:text-sm text-washi-300 mt-2 leading-relaxed">
              Để đảm bảo giữ bàn chính xác, nhận thông báo xác nhận và hưởng quyền lợi thành viên SAKURA, quý khách vui lòng đăng nhập trước khi tiến hành đặt bàn.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={() => openAuthModal('login', 'Quý khách vui lòng đăng nhập để đặt bàn giữ chỗ trực tuyến.')}
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

  return (
    <div className="flex-1 flex flex-col py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="text-center max-w-xl mx-auto mb-6 sm:mb-10">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-sumi-900 border border-kin-500/30 text-xs font-semibold text-kin-400 mb-2 shadow-gold-glow">
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          <span>Đặt Bàn Giữ Chỗ Trực Tuyến</span>
        </div>
        <h1 className="font-serif text-2xl sm:text-4xl font-bold text-washi-100">
          Trải Nghiệm Ẩm Thực Đỉnh Cao
        </h1>
        <p className="text-xs sm:text-sm text-washi-300 mt-2 font-light">
          Đặt trước bàn để được chuẩn bị nguyên liệu tươi nhất và sắp xếp phòng riêng tư hoàn hảo.
        </p>
      </div>

      {isSuccess ? (
        /* SUCCESS CONFIRMATION SCREEN */
        <div className="bg-sumi-900/90 border-2 border-kin-500/50 rounded-3xl p-5 sm:p-10 shadow-2xl backdrop-blur-xl text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-shu-900/80 border-2 border-kin-400 mx-auto flex items-center justify-center text-kin-400 shadow-gold-glow animate-bounce">
            <CheckCircle2 className="w-8 h-8 text-kin-400" />
          </div>

          <div>
            <span className="text-xs font-kanji text-kin-400 tracking-widest font-bold">ご予約完了</span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-washi-100 mt-1">
              Đặt Bàn Thành Công!
            </h2>
            <p className="text-xs text-washi-300 mt-1 max-w-md mx-auto">
              Cảm ơn quý khách <strong className="text-kin-400">{customerName}</strong>. Nhà hàng đã ghi nhận lịch hẹn và gửi tin nhắn xác nhận đến số điện thoại <strong>{customerPhone}</strong>.
            </p>
          </div>

          {/* Reservation Ticket Box */}
          <div className="max-w-md mx-auto bg-sumi-950 border border-kin-500/30 rounded-2xl p-4 sm:p-5 text-left space-y-3 text-xs">
            <div className="flex flex-wrap justify-between items-center gap-2 pb-3 border-b border-sumi-800">
              <span className="text-washi-400">Mã Đặt Bàn (Booking Code):</span>
              <span className="font-mono text-sm font-bold text-kin-400 tracking-wider shrink-0 whitespace-nowrap">
                {reservationCode}
              </span>
            </div>

            <div className="flex flex-wrap justify-between gap-2 text-washi-200">
              <span className="text-washi-400 shrink-0">Chi nhánh:</span>
              <span className="font-semibold text-right">{selectedBranch.name}</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-3 text-washi-200">
              <span className="text-washi-400 shrink-0">Địa chỉ:</span>
              <span className="sm:text-right text-[11px] break-words">{selectedBranch.address}</span>
            </div>

            <div className="flex flex-wrap justify-between gap-2 text-washi-200">
              <span className="text-washi-400 shrink-0">Thời gian:</span>
              <span className="font-semibold text-kin-400 text-right">{reservationTime} • Ngày {reservationDate}</span>
            </div>

            <div className="flex flex-wrap justify-between gap-2 text-washi-200">
              <span className="text-washi-400 shrink-0">Khu vực bàn:</span>
              <span className="font-semibold text-right">{selectedArea.name} ({guestCount} khách)</span>
            </div>

            {specialRequest && (
              <div className="pt-2 border-t border-sumi-800 text-washi-300 text-[11px] break-words">
                <span className="font-medium text-washi-400">Yêu cầu đặc biệt: </span>
                {specialRequest}
              </div>
            )}
          </div>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/menu"
              className="px-6 py-3 rounded-full text-xs font-semibold text-white bg-shu-700 hover:bg-shu-600 border border-kin-500/40 shadow-lg flex items-center space-x-2 transition-colors whitespace-nowrap"
            >
              <span>Xem Menu & Chọn Món Trước</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </Link>

            <Link
              to="/"
              className="px-6 py-3 rounded-full text-xs font-semibold text-kin-300 bg-sumi-950 border border-kin-500/30 hover:border-kin-400 transition-colors whitespace-nowrap"
            >
              Về Trang Chủ
            </Link>
          </div>
        </div>
      ) : (
        /* STEP WIZARD FORM */
        <div className="bg-sumi-900/90 border border-kin-500/30 rounded-3xl p-4 sm:p-10 shadow-2xl backdrop-blur-xl">
          {/* Progress Indicator */}
          <div className="flex items-center justify-between max-w-md mx-auto mb-6 sm:mb-8 gap-2">
            {[
              { num: 1, label: 'Thời gian' },
              { num: 2, label: 'Khu vực' },
              { num: 3, label: 'Số khách' },
              { num: 4, label: 'Xác nhận' },
            ].map((s) => (
              <div key={s.num} className="flex flex-col items-center">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all border ${
                    step >= s.num
                      ? 'bg-shu-700 border-kin-400 text-white shadow-gold-glow'
                      : 'bg-sumi-950 border-sumi-700 text-washi-500'
                  }`}
                >
                  {s.num}
                </div>
                <span className={`text-[10px] mt-1 ${step >= s.num ? 'text-kin-400 font-semibold' : 'text-washi-500'}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* STEP 1: Branch & Date/Time */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-kin-400 mb-2">
                    1. Chọn chi nhánh nhà hàng
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {branches.map((branch) => (
                      <button
                        key={branch.id}
                        type="button"
                        onClick={() => setBranchId(branch.id)}
                        className={`p-3.5 rounded-xl text-left border transition-all ${
                          branchId === branch.id
                            ? 'bg-shu-950/80 border-kin-400 text-white shadow-md'
                            : 'bg-sumi-950 border-sumi-800 text-washi-300 hover:border-sumi-700'
                        }`}
                      >
                        <Building2 className={`w-4 h-4 mb-1.5 ${branchId === branch.id ? 'text-kin-400' : 'text-washi-400'}`} />
                        <h4 className="font-bold text-xs">{branch.name}</h4>
                        <p className="text-[10px] text-washi-400 mt-1 line-clamp-2">{branch.address}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="min-w-0">
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-kin-400">
                        Ngày đặt bàn
                      </label>
                      <span className="text-[11px] text-washi-400">
                        Hôm nay: <strong className="text-kin-300">{formatVietnameseDate(todayStr)}</strong>
                      </span>
                    </div>
                    <input
                      type="date"
                      required
                      min={todayStr}
                      value={reservationDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val < todayStr) {
                          setReservationError(`Ngày đặt bàn không thể ở quá khứ. Hệ thống đã tự động chuyển về ngày hôm nay (${formatVietnameseDate(todayStr)}).`);
                          setReservationDate(todayStr);
                          return;
                        }
                        setReservationError(null);
                        setReservationDate(val);
                      }}
                      className="w-full min-w-0 max-w-full [color-scheme:dark] bg-sumi-950 border border-sumi-700 rounded-xl px-4 py-2.5 text-base sm:text-xs text-washi-100 focus:outline-none focus:border-kin-400"
                    />

                    {/* Quick Date Selection Pills */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setReservationDate(todayStr);
                          setReservationError(null);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                          reservationDate === todayStr
                            ? 'bg-shu-700 text-white border border-kin-400 shadow-md'
                            : 'bg-sumi-900 text-washi-400 hover:text-white border border-sumi-800'
                        }`}
                      >
                        Hôm nay ({formatVietnameseDate(todayStr).slice(0, 5)})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReservationDate(tomorrowStr);
                          setReservationError(null);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                          reservationDate === tomorrowStr
                            ? 'bg-shu-700 text-white border border-kin-400 shadow-md'
                            : 'bg-sumi-900 text-washi-400 hover:text-white border border-sumi-800'
                        }`}
                      >
                        Ngày mai ({formatVietnameseDate(tomorrowStr).slice(0, 5)})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReservationDate(dayAfterStr);
                          setReservationError(null);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                          reservationDate === dayAfterStr
                            ? 'bg-shu-700 text-white border border-kin-400 shadow-md'
                            : 'bg-sumi-900 text-washi-400 hover:text-white border border-sumi-800'
                        }`}
                      >
                        Ngày kia ({formatVietnameseDate(dayAfterStr).slice(0, 5)})
                      </button>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-kin-400 mb-1.5">
                      Giờ đón khách
                    </label>
                    <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto p-1 bg-sumi-950 rounded-xl border border-sumi-700">
                      {timeSlots.map((time) => {
                        const disabled = isSlotPast(time);
                        return (
                          <button
                            key={time}
                            type="button"
                            disabled={disabled}
                            onClick={() => setReservationTime(time)}
                            className={`py-1.5 px-2 rounded-lg text-xs font-medium text-center transition-colors ${
                              disabled
                                ? 'opacity-30 cursor-not-allowed text-washi-600 bg-sumi-900/60 line-through pointer-events-none'
                                : reservationTime === time
                                ? 'bg-shu-700 text-white font-bold shadow-md'
                                : 'text-washi-300 hover:bg-sumi-800'
                            }`}
                          >
                            {time}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="w-full sm:w-auto justify-center px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-shu-700 hover:bg-shu-600 border border-kin-500/40 flex items-center space-x-1.5 whitespace-nowrap"
                  >
                    <span>Tiếp tục: Chọn khu vực bàn</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Table Area */}
            {step === 2 && (
              <div className="space-y-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-kin-400 mb-1">
                  2. Chọn không gian thưởng thức
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {tableAreas.map((area) => (
                    <button
                      key={area.id}
                      type="button"
                      onClick={() => setAreaId(area.id)}
                      className={`p-4 rounded-2xl text-left border transition-all flex flex-col justify-between ${
                        areaId === area.id
                          ? 'bg-shu-950/80 border-kin-400 text-white shadow-gold-glow'
                          : 'bg-sumi-950 border-sumi-800 text-washi-300 hover:border-sumi-700'
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <span className="text-[10px] font-kanji text-kin-400 font-bold">{area.code}</span>
                            <h4 className="font-serif text-sm font-bold text-washi-100">{area.name}</h4>
                          </div>
                          {area.extraFeePercent ? (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-kin-500/20 text-kin-300 border border-kin-500/40 font-semibold shrink-0 whitespace-nowrap">
                              +{area.extraFeePercent}% phí VIP
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-400 shrink-0 whitespace-nowrap">Không phụ thu</span>
                          )}
                        </div>
                        <p className="text-xs text-washi-400 mt-2 leading-relaxed">{area.description}</p>
                      </div>

                      <div className="mt-4 pt-2 border-t border-sumi-800 flex flex-wrap justify-between gap-2 text-[11px] text-washi-400">
                        <span>Sức chứa: {area.capacityDescription || area.capacityPerTable}</span>
                        <span className="text-kin-400 font-medium">Bàn trống: Sẵn sàng</span>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="pt-4 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="w-full sm:w-auto justify-center px-4 py-2.5 rounded-xl text-xs font-semibold text-washi-300 bg-sumi-950 border border-sumi-700 hover:bg-sumi-800 flex items-center space-x-1 whitespace-nowrap"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
                    <span>Quay lại</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="w-full sm:w-auto justify-center px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-shu-700 hover:bg-shu-600 border border-kin-500/40 flex items-center space-x-1.5 whitespace-nowrap"
                  >
                    <span>Tiếp tục: Số lượng khách</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Guest count & Special Notes */}
            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-kin-400 mb-2">
                    3. Số lượng khách tham dự
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setGuestCount(num)}
                        className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border whitespace-nowrap ${
                          guestCount === num
                            ? 'bg-shu-700 border-kin-400 text-white shadow-md'
                            : 'bg-sumi-950 border-sumi-800 text-washi-300 hover:bg-sumi-800'
                        }`}
                      >
                        {num} người
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-kin-400 mb-1.5">
                    Ghi chú & Yêu cầu đặc biệt (tùy chọn)
                  </label>
                  <textarea
                    rows={3}
                    value={specialRequest}
                    onChange={(e) => setSpecialRequest(e.target.value)}
                    placeholder="ví dụ: Dị ứng tôm/cua, tổ chức sinh nhật kỷ niệm cần bánh kem, cần ghế ăn dặm cho trẻ em..."
                    className="w-full bg-sumi-950 border border-sumi-700 rounded-xl p-3 text-base sm:text-xs text-washi-100 placeholder:text-washi-500 focus:outline-none focus:border-kin-400"
                  />
                </div>

                <div className="pt-4 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="w-full sm:w-auto justify-center px-4 py-2.5 rounded-xl text-xs font-semibold text-washi-300 bg-sumi-950 border border-sumi-700 hover:bg-sumi-800 flex items-center space-x-1 whitespace-nowrap"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
                    <span>Quay lại</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="w-full sm:w-auto justify-center px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-shu-700 hover:bg-shu-600 border border-kin-500/40 flex items-center space-x-1.5 whitespace-nowrap"
                  >
                    <span>Tiếp tục: Thông tin người đặt</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: Contact Info & Review */}
            {step === 4 && (
              <div className="space-y-5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-kin-400 mb-1">
                  4. Thông tin liên hệ của quý khách
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] text-washi-300 mb-1">Họ và tên quý khách *</label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-washi-500 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full bg-sumi-950 border border-sumi-700 rounded-xl pl-9 pr-3 py-2 text-base sm:text-xs text-washi-100 focus:outline-none focus:border-kin-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-washi-300 mb-1">Số điện thoại nhận SMS xác nhận *</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-washi-500 pointer-events-none" />
                      <input
                        type="tel"
                        required
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full bg-sumi-950 border border-sumi-700 rounded-xl pl-9 pr-3 py-2 text-base sm:text-xs text-washi-100 focus:outline-none focus:border-kin-400"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-washi-300 mb-1">Email nhận thư mời / hóa đơn</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-washi-500 pointer-events-none" />
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full bg-sumi-950 border border-sumi-700 rounded-xl pl-9 pr-3 py-2 text-base sm:text-xs text-washi-100 focus:outline-none focus:border-kin-400"
                    />
                  </div>
                </div>

                {/* Summary Box */}
                <div className="p-4 rounded-xl bg-sumi-950 border border-kin-500/30 space-y-2 text-xs">
                  <div className="font-semibold text-kin-400 flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>Tóm tắt lịch hẹn</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-washi-300 text-[11px]">
                    <div className="min-w-0 break-words">Chi nhánh: <span className="text-white font-medium">{selectedBranch.name}</span></div>
                    <div className="min-w-0 break-words">Thời gian: <span className="text-white font-medium">{reservationTime} ngày {reservationDate}</span></div>
                    <div className="min-w-0 break-words">Khu vực: <span className="text-white font-medium">{selectedArea.name}</span></div>
                    <div className="min-w-0 break-words">Số khách: <span className="text-white font-medium">{guestCount} người</span></div>
                  </div>
                </div>

                {/* Error Banner */}
                {reservationError && (
                  <div className="p-3.5 rounded-xl bg-shu-950/80 border border-shu-600/60 text-xs text-red-200 flex items-center space-x-2">
                    <span className="font-bold shrink-0 text-shu-400">⚠ Lỗi:</span>
                    <span>{reservationError}</span>
                  </div>
                )}

                <div className="pt-4 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setStep(3)}
                    className="w-full sm:w-auto justify-center px-4 py-2.5 rounded-xl text-xs font-semibold text-washi-300 bg-sumi-950 border border-sumi-700 hover:bg-sumi-800 flex items-center space-x-1 whitespace-nowrap"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
                    <span>Quay lại</span>
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto justify-center px-6 sm:px-8 py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-shu-700 via-shu-600 to-shu-700 hover:from-shu-600 hover:to-shu-500 border border-kin-500/50 shadow-xl shadow-shu-950/80 flex items-center space-x-2 transition-all whitespace-nowrap disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4 text-kin-300 shrink-0" />
                    <span>{isSubmitting ? 'Đang gửi yêu cầu đặt bàn...' : 'Xác Nhận Đặt Bàn Ngay'}</span>
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
};
