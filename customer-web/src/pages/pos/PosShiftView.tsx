import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Coins,
  Calculator,
  User,
  History,
  FileSpreadsheet,
  Lock,
  Unlock,
  AlertTriangle,
  Camera,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  X,
  ArrowDownCircle,
} from 'lucide-react';
import { shiftService, CashierShiftDto, CashDrawerWithdrawalDto } from '@/services/shiftService';
import { getErrorMessage } from '@/services/apiClient';
import { formatVND } from '@/utils/dateUtils';
import { useAuth } from '@/context/AuthContext';
import { normalizeUserRole } from '@/types';

interface DenominationRow {
  denomination: number;
  count: number;
}

export const PosShiftView: React.FC = () => {
  const [shift, setShift] = useState<CashierShiftDto | null>(null);
  const [history, setHistory] = useState<CashierShiftDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [openingCash, setOpeningCash] = useState<number>(2000000);
  const [openNotes, setOpenNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [denominations, setDenominations] = useState<DenominationRow[]>([
    { denomination: 500000, count: 0 },
    { denomination: 200000, count: 0 },
    { denomination: 100000, count: 0 },
    { denomination: 50000, count: 0 },
    { denomination: 20000, count: 0 },
    { denomination: 10000, count: 0 },
    { denomination: 5000, count: 0 },
    { denomination: 2000, count: 0 },
    { denomination: 1000, count: 0 },
    { denomination: 500, count: 0 },
  ]);
  const [shiftNotes, setShiftNotes] = useState('');

  const { currentUser } = useAuth();
  const isAdmin = normalizeUserRole(currentUser?.role) === 'ADMIN';

  // Admin Cash Withdrawal State
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(0);
  const [withdrawNote, setWithdrawNote] = useState('');
  const [withdrawPhotoFile, setWithdrawPhotoFile] = useState<File | null>(null);
  const [withdrawPhotoPreview, setWithdrawPhotoPreview] = useState<string | null>(null);
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);
  const [withdrawSuccessMsg, setWithdrawSuccessMsg] = useState<string | null>(null);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadShiftData = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [currentRes, historyRes] = await Promise.all([
        shiftService.getCurrentShift(),
        shiftService.getShiftHistory({ page: 1, pageSize: 10 }).catch(() => ({
          items: [],
          totalCount: 0,
          page: 1,
          pageSize: 10,
        })),
      ]);
      setShift(currentRes.hasOpenShift ? currentRes.shift : null);
      setHistory(historyRes.items || []);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadShiftData();
  }, [loadShiftData]);

  const handleCountChange = (denom: number, count: number) => {
    setDenominations((prev) =>
      prev.map((d) => (d.denomination === denom ? { ...d, count: Math.max(0, count) } : d))
    );
  };

  const totalCountedCash = denominations.reduce(
    (acc, curr) => acc + curr.denomination * curr.count,
    0
  );

  const expectedCash = shift ? Number(shift.currentRemainingCash ?? 0) : 0;
  const discrepancy = totalCountedCash - expectedCash;

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await shiftService.openShift({
        openingCash,
        notes: openNotes.trim() || undefined,
      });
      await loadShiftData();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrorMsg('Kích thước ảnh chụp không được vượt quá 5MB.');
        return;
      }
      setWithdrawPhotoFile(file);
      const url = URL.createObjectURL(file);
      setWithdrawPhotoPreview(url);
    }
  };

  const handleOpenWithdrawModal = () => {
    setWithdrawAmount(shift?.currentRemainingCash ?? 0);
    setWithdrawNote('');
    setWithdrawPhotoFile(null);
    setWithdrawPhotoPreview(null);
    setIsWithdrawModalOpen(true);
  };

  const handleConfirmWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shift) return;
    if (withdrawAmount <= 0) {
      setErrorMsg('Vui lòng nhập số tiền hợp lệ lớn hơn 0đ.');
      return;
    }
    if (withdrawAmount > (shift.currentRemainingCash ?? 0)) {
      setErrorMsg(`Số tiền rút không được vượt quá số dư trong két (${formatVND(shift.currentRemainingCash)}).`);
      return;
    }
    if (!withdrawPhotoFile) {
      setErrorMsg('Vui lòng chụp ảnh hoặc tải lên ảnh xác nhận thu tiền két.');
      return;
    }

    setIsSubmittingWithdraw(true);
    setErrorMsg(null);
    try {
      await shiftService.withdrawCash(withdrawAmount, withdrawPhotoFile, withdrawNote.trim() || undefined);
      setWithdrawSuccessMsg(`Đã ghi nhận rút ${formatVND(withdrawAmount)} từ két ca trực thành công.`);
      setIsWithdrawModalOpen(false);
      setWithdrawPhotoFile(null);
      setWithdrawPhotoPreview(null);
      await loadShiftData();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  const handleAutoFillExpectedCash = () => {
    let remaining = Math.max(0, Math.floor(expectedCash));
    setDenominations((prev) =>
      prev.map((row) => {
        const count = Math.floor(remaining / row.denomination);
        remaining -= count * row.denomination;
        return { ...row, count };
      })
    );
  };

  const handleCloseShift = async () => {
    if (!shift) return;
    if (discrepancy !== 0) {
      setErrorMsg(
        `Tiền mặt kiểm đếm thực tế đang bị chênh lệch (${
          discrepancy < 0 ? 'Thiếu ' + formatVND(Math.abs(discrepancy)) : 'Thừa ' + formatVND(discrepancy)
        }). Vui lòng liên hệ Admin xử lý, khi nào ghi nhận đủ số tiền (${formatVND(
          expectedCash
        )}) mới được phép đóng ca!`
      );
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await shiftService.closeShift({
        actualCash: totalCountedCash,
        notes: shiftNotes.trim() || undefined,
      });
      setShiftNotes('');
      await loadShiftData();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black uppercase text-slate-950 flex items-center gap-2">
            <Coins className="w-6 h-6 text-emerald-600" />
            <span>Ca Trực &amp; Kiểm Kê Tiền Két</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Bảng kê chi tiết mệnh giá tiền mặt và đối soát doanh thu theo ca từ SQL Server
          </p>
        </div>

        <span
          className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
            shift
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-800 border-amber-300'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${shift ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          <span>{shift ? `Ca Đang Mở: ${shift.shiftCode}` : 'Chưa Có Ca Đang Mở'}</span>
        </span>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {isLoading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-500">
          Đang tải thông tin ca trực...
        </div>
      ) : !shift ? (
        <form
          onSubmit={(e) => void handleOpenShift(e)}
          className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg space-y-4 shadow-xs"
        >
          <h2 className="text-sm font-extrabold uppercase text-slate-900 flex items-center gap-2">
            <Unlock className="w-4 h-4 text-emerald-600" />
            <span>Mở Ca Trực Mới</span>
          </h2>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Tiền đầu ca (VNĐ)</label>
            <input
              type="number"
              min={0}
              step={1000}
              value={openingCash}
              onChange={(e) => setOpeningCash(Number(e.target.value) || 0)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-emerald-600"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú mở ca</label>
            <textarea
              rows={2}
              value={openNotes}
              onChange={(e) => setOpenNotes(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs uppercase rounded-xl"
          >
            {isSubmitting ? 'Đang mở ca...' : 'Xác Nhận Mở Ca Trực'}
          </button>
        </form>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
                <User className="w-4 h-4 text-emerald-600" />
                <span>Thông Tin Ca Trực Hiện Tại</span>
              </h2>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Thu ngân phụ trách:</span>
                  <span className="font-bold text-slate-950">{shift.openedByName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Giờ bắt đầu ca:</span>
                  <span className="font-mono text-slate-800">
                    {new Date(shift.openedAt).toLocaleString('vi-VN')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Số đơn đã phục vụ:</span>
                  <span className="font-bold text-slate-950">{shift.totalOrdersCount} đơn</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between text-slate-700">
                  <span>Tiền đầu ca:</span>
                  <span className="font-semibold text-slate-950">{formatVND(shift.openingCash)}</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>(+) Doanh thu Tiền Mặt trong ca:</span>
                  <span className="font-bold">{formatVND(shift.cashSalesTotal)}</span>
                </div>
                <div className="flex justify-between text-blue-700">
                  <span>(+) Doanh thu Chuyển Khoản:</span>
                  <span className="font-bold">{formatVND(shift.transferSalesTotal)}</span>
                </div>
                <div className="flex justify-between text-amber-700">
                  <span>(-) Chủ quán đã thu tiền két:</span>
                  <span className="font-bold">{formatVND(shift.totalWithdrawn)}</span>
                </div>

                <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
                  <span className="font-bold text-slate-900 uppercase">Tiền Mặt Còn Lại Trong Két:</span>
                  <span className="text-base font-black text-emerald-700 font-mono">
                    {formatVND(expectedCash)}
                  </span>
                </div>

                {isAdmin && (
                  <div className="pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={handleOpenWithdrawModal}
                      className="w-full py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-colors"
                    >
                      <ArrowDownCircle className="w-4 h-4" />
                      <span>Admin Thu Tiền Két (Chủ Quán Rút Tiền)</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div
              className={`rounded-2xl p-5 border shadow-xs space-y-3 ${
                discrepancy === 0
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : discrepancy > 0
                  ? 'bg-blue-50 border-blue-200 text-blue-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Calculator className="w-4 h-4" />
                  <span>Đối Soát Kiểm Tiền Thực Tế</span>
                </span>
                <span className="text-xs font-bold">
                  {discrepancy === 0
                    ? '✓ KHỚP TIỀN'
                    : discrepancy > 0
                    ? `+ Thừa ${formatVND(discrepancy)}`
                    : `- Thiếu ${formatVND(Math.abs(discrepancy))}`}
                </span>
              </div>
              <div className="flex justify-between items-baseline pt-1">
                <span className="text-xs">Tổng tiền kiểm đếm thực tế:</span>
                <span className="text-xl font-black font-mono">{formatVND(totalCountedCash)}</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-xs">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-800 block">
                Ghi Chú Bàn Giao Ca
              </label>
              <textarea
                rows={2}
                value={shiftNotes}
                onChange={(e) => setShiftNotes(e.target.value)}
                placeholder="Ghi chú bàn giao tiền két cuối ca..."
                className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-900 outline-none focus:border-emerald-600"
              />

              {discrepancy !== 0 && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-1.5">
                  <div className="font-extrabold flex items-center gap-1.5 text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Không thể đóng ca khi tiền két bị chênh lệch!</span>
                  </div>
                  <p className="leading-relaxed text-[11px]">
                    Số tiền kiểm đếm thực tế đang{' '}
                    <strong className="text-red-700">
                      {discrepancy < 0
                        ? `thiếu ${formatVND(Math.abs(discrepancy))}`
                        : `thừa ${formatVND(discrepancy)}`}
                    </strong>{' '}
                    so với tiền mặt trong két ({formatVND(expectedCash)}). Vui lòng kiểm đếm lại hoặc{' '}
                    <strong>liên hệ Admin</strong> để đối soát/xử lý. Khi nào ghi nhận đủ và khớp số tiền mặt trong két mới được phép thao tác đóng ca.
                  </p>
                </div>
              )}

              <button
                type="button"
                disabled={isSubmitting || discrepancy !== 0}
                onClick={() => void handleCloseShift()}
                className="w-full py-3.5 px-4 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm flex items-center justify-center gap-2 transition-colors"
              >
                <Lock className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'Đang đóng ca...'
                    : discrepancy !== 0
                    ? 'Khóa Đóng Ca (Chờ Ghi Nhận Đủ Tiền Két)'
                    : 'Bàn Giao & Kết Thúc Ca Trực'}
                </span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 mb-4">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Bảng Kê Chi Tiết Mệnh Giá Tiền Mặt</span>
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAutoFillExpectedCash}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold transition-colors"
                  >
                    Điền Nhanh Đúng Tiền Két ({formatVND(expectedCash)})
                  </button>
                  <span className="text-xs font-mono text-slate-500">10 Mệnh Giá</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Mệnh Giá</th>
                      <th className="py-2.5 px-3 text-center">Số Lượng Tờ</th>
                      <th className="py-2.5 px-3 text-right">Thành Tiền (VNĐ)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {denominations.map((row) => {
                      const rowTotal = row.denomination * row.count;
                      return (
                        <tr key={row.denomination} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-slate-900">
                            {formatVND(row.denomination)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <div className="inline-flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white">
                              <button
                                type="button"
                                onClick={() => handleCountChange(row.denomination, row.count - 1)}
                                className="px-2.5 py-1 text-slate-700 hover:bg-slate-100 font-bold"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min={0}
                                value={row.count || 0}
                                onChange={(e) =>
                                  handleCountChange(row.denomination, parseInt(e.target.value, 10) || 0)
                                }
                                className="w-14 text-center bg-transparent py-1 text-xs font-bold text-slate-950 outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleCountChange(row.denomination, row.count + 1)}
                                className="px-2.5 py-1 text-slate-700 hover:bg-slate-100 font-bold"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                            {formatVND(rowTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center bg-slate-50 p-3 rounded-xl">
              <span className="font-bold text-xs uppercase text-slate-700">
                Tổng Kiểm Đếm Thực Tế:
              </span>
              <span className="text-xl font-black text-emerald-700 font-mono">
                {formatVND(totalCountedCash)}
              </span>
            </div>
          </div>
        </div>
      )}

      {withdrawSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{withdrawSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setWithdrawSuccessMsg(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Withdrawals list in current shift */}
      {shift && shift.withdrawals && shift.withdrawals.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-2xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-amber-100">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-900 flex items-center gap-2">
              <ArrowDownCircle className="w-4 h-4 text-amber-600" />
              <span>Lịch Sử Admin Thu Tiền Két Trong Ca ({shift.withdrawals.length} Lần)</span>
            </h3>
            <span className="text-xs font-bold text-amber-800 font-mono">
              Tổng Rút: {formatVND(shift.totalWithdrawn)}
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {shift.withdrawals.map((w: CashDrawerWithdrawalDto) => (
              <div
                key={w.id}
                className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  {w.photoUrl ? (
                    <button
                      type="button"
                      onClick={() => setSelectedPreviewImage(w.photoUrl)}
                      className="w-12 h-12 rounded-lg overflow-hidden border border-slate-300 relative group shrink-0"
                      title="Xem ảnh bằng chứng thu tiền"
                    >
                      <img
                        src={w.photoUrl}
                        alt="Ảnh thu tiền két"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                      />
                      <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <ImageIcon className="w-4 h-4 text-white" />
                      </div>
                    </button>
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                  )}

                  <div className="space-y-0.5">
                    <p className="font-extrabold text-sm text-slate-900 font-mono">
                      -{formatVND(w.amount)}
                    </p>
                    <p className="text-[11px] text-slate-600">
                      Người rút: <span className="font-bold">{w.withdrawnByName}</span> • Lúc:{' '}
                      {new Date(w.withdrawnAt).toLocaleString('vi-VN')}
                    </p>
                    {w.note && (
                      <p className="text-[11px] text-amber-800 font-medium italic">
                        Ghi chú: {w.note}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {w.photoUrl && (
                    <button
                      type="button"
                      onClick={() => setSelectedPreviewImage(w.photoUrl)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 flex items-center gap-1 transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5 text-slate-500" />
                      <span>Xem ảnh chụp</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-xs">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-600" />
            <span>Lịch Sử Các Ca Trực Gần Đây ({history.length})</span>
          </h3>
          <div className="divide-y divide-slate-100">
            {history.slice(0, 5).map((h) => (
              <div key={h.id} className="py-2.5 flex flex-wrap justify-between items-center text-xs gap-2">
                <div>
                  <p className="font-bold text-slate-900">
                    {h.shiftCode} • {h.openedByName}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Bắt đầu: {new Date(h.openedAt).toLocaleString('vi-VN')}
                    {h.closedAt ? ` • Kết thúc: ${new Date(h.closedAt).toLocaleTimeString('vi-VN')}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-700 font-mono">
                    Còn lại: {formatVND(h.currentRemainingCash)}
                  </p>
                  {typeof h.varianceAmount === 'number' && (
                    <p className={`text-[10px] font-semibold ${h.varianceAmount === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      Chênh lệch: {formatVND(h.varianceAmount)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin Withdrawal Modal */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2 text-amber-700">
                <ArrowDownCircle className="w-5 h-5" />
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-950">
                  Chủ Quán Thu Tiền Két (Admin)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsWithdrawModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmWithdraw} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
                <p className="text-amber-800">
                  Số tiền mặt hiện có trong két:{' '}
                  <strong className="text-amber-950 font-mono text-sm">
                    {formatVND(shift?.currentRemainingCash ?? 0)}
                  </strong>
                </p>
                <p className="text-[11px] text-amber-700">
                  Sau khi rút, số dư tiền két của thu ngân sẽ được cập nhật giảm tương ứng và lưu kèm bằng chứng ảnh.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase mb-1">
                  Số Tiền Rút (VNĐ) *
                </label>
                <input
                  type="number"
                  min={1000}
                  step={1000}
                  max={shift?.currentRemainingCash ?? 0}
                  value={withdrawAmount || ''}
                  onChange={(e) => setWithdrawAmount(Number(e.target.value) || 0)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-base font-extrabold text-slate-950 outline-none focus:border-amber-600 font-mono"
                  placeholder="Nhập số tiền cần rút..."
                  required
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => setWithdrawAmount(shift?.currentRemainingCash ?? 0)}
                    className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
                  >
                    Rút Hết ({formatVND(shift?.currentRemainingCash ?? 0)})
                  </button>
                  {[1000000, 2000000, 5000000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setWithdrawAmount(amt)}
                      className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
                    >
                      {formatVND(amt)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase mb-1">
                  Ghi Chú Thu Tiền
                </label>
                <textarea
                  rows={2}
                  value={withdrawNote}
                  onChange={(e) => setWithdrawNote(e.target.value)}
                  placeholder="VD: Chủ quán thu tiền doanh thu ca trưa nộp ngân hàng..."
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 outline-none focus:border-amber-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase mb-1">
                  Chụp Ảnh / Tải Ảnh Xác Nhận Thu Tiền *
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />

                {withdrawPhotoPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-300 bg-slate-50 group">
                    <img
                      src={withdrawPhotoPreview}
                      alt="Ảnh xem trước"
                      className="w-full h-44 object-cover"
                    />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-lg bg-white/90 hover:bg-white text-xs font-bold text-slate-800 flex items-center gap-1 shadow-sm"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Chụp Lại</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setWithdrawPhotoFile(null);
                          setWithdrawPhotoPreview(null);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-bold text-white flex items-center gap-1 shadow-sm"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Xóa</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-32 rounded-xl border-2 border-dashed border-slate-300 hover:border-amber-500 bg-slate-50 hover:bg-amber-50/40 flex flex-col items-center justify-center gap-2 text-slate-600 hover:text-amber-800 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-xs">
                      <Camera className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold">Chạm để chụp ảnh hoặc tải lên tệp</p>
                      <p className="text-[10px] text-slate-400">Định dạng JPG, PNG dưới 5MB</p>
                    </div>
                  </button>
                )}
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isSubmittingWithdraw || withdrawAmount <= 0 || !withdrawPhotoFile}
                  className="flex-1 py-3 px-4 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <ArrowDownCircle className="w-4 h-4" />
                  <span>{isSubmittingWithdraw ? 'Đang ghi nhận...' : 'Xác Nhận & Hoàn Tất Thu Tiền'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsWithdrawModalOpen(false)}
                  className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full-Screen Image Viewer Modal */}
      {selectedPreviewImage && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          onClick={() => setSelectedPreviewImage(null)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-amber-400" />
                <span>Ảnh Bằng Chứng Thu Tiền Két</span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedPreviewImage(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 max-h-[80vh] overflow-auto flex items-center justify-center bg-slate-950">
              <img
                src={selectedPreviewImage}
                alt="Ảnh xác nhận thu tiền"
                className="max-w-full max-h-[75vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
