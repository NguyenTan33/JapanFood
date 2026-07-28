import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquareText,
  Star,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Send,
  User,
  Utensils,
  X,
  MessageCircle,
} from 'lucide-react';
import {
  reviewService,
  ManagedReviewDto,
  ReviewManageCounts,
} from '@/services/reviewService';
import { getErrorMessage } from '@/services/apiClient';

export const PosReviewsView: React.FC = () => {
  const [reviews, setReviews] = useState<ManagedReviewDto[]>([]);
  const [counts, setCounts] = useState<ReviewManageCounts>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    unreplied: 0,
  });

  const [activeTab, setActiveTab] = useState<string>('Unreplied');
  const [ratingFilter, setRatingFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Replying state per review ID
  const [replyInputs, setReplyInputs] = useState<Record<number, string>>({});
  const [submittingReplyId, setSubmittingReplyId] = useState<number | null>(null);

  const loadReviews = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await reviewService.getManagedReviews({
        status: activeTab === 'ALL' || activeTab === 'Unreplied' ? undefined : activeTab,
        hasReply: activeTab === 'Unreplied' ? false : undefined,
        rating: ratingFilter !== 'ALL' ? Number(ratingFilter) : undefined,
        search: search.trim() || undefined,
        page: 1,
        pageSize: 50,
      });

      setReviews(res.items || []);
      setCounts(res.counts || {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        unreplied: 0,
      });

      // Dispatch event to update sidebar badge
      window.dispatchEvent(
        new CustomEvent('pos-reviews-updated', {
          detail: { unrepliedCount: res.counts?.unreplied || 0 },
        })
      );
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, ratingFilter, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadReviews();
    }, 300);
    return () => clearTimeout(timer);
  }, [loadReviews]);

  const handleSendReply = async (review: ManagedReviewDto) => {
    const replyText = replyInputs[review.id]?.trim();
    if (!replyText) {
      setErrorMsg('Vui lòng nhập nội dung phản hồi trước khi gửi.');
      return;
    }

    setSubmittingReplyId(review.id);
    setErrorMsg(null);
    try {
      await reviewService.replyReview(review.id, replyText);
      setSuccessMsg(`Đã gửi phản hồi chính thức cho đánh giá của khách ${review.customerName}.`);
      setReplyInputs((prev) => ({ ...prev, [review.id]: '' }));
      await loadReviews();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setSubmittingReplyId(null);
    }
  };

  const handleApprove = async (review: ManagedReviewDto) => {
    try {
      await reviewService.approveReview(review.id);
      setSuccessMsg(`Đã phê duyệt đánh giá món "${review.dishName}".`);
      await loadReviews();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    }
  };

  const handleReject = async (review: ManagedReviewDto) => {
    const reason = window.prompt('Nhập lý do từ chối đánh giá này:', 'Nội dung không phù hợp quy tắc cộng đồng');
    if (reason === null) return;
    try {
      await reviewService.rejectReview(review.id, reason);
      setSuccessMsg(`Đã từ chối đánh giá.`);
      await loadReviews();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black uppercase text-slate-950 flex items-center gap-2">
            <MessageSquareText className="w-6 h-6 text-emerald-600" />
            <span>Xem &amp; Trả Lời Đánh Giá Món Ăn</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Theo dõi trải nghiệm khách hàng sau bữa ăn, duyệt bình luận và gửi phản hồi chính thức từ quản lý
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadReviews()}
          className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 shrink-0"
          title="Tải lại danh sách"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
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

      {/* Tabs & Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('Unreplied')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'Unreplied'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>Chưa Trả Lời</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono">
                {counts.unreplied}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('Pending')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'Pending'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>Chờ Phê Duyệt</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono">
                {counts.pending}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('Approved')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeTab === 'Approved'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Đã Duyệt ({counts.approved})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeTab === 'ALL'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Tất Cả ({counts.total})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600"
            >
              <option value="ALL">Tất cả số sao</option>
              <option value="5">5 Sao ★★★★★</option>
              <option value="4">4 Sao ★★★★☆</option>
              <option value="3">3 Sao ★★★☆☆</option>
              <option value="2">2 Sao ★★☆☆☆</option>
              <option value="1">1 Sao ★☆☆☆☆</option>
            </select>

            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm món, khách..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-600"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {isLoading && reviews.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-xs text-slate-500">
            Đang tải phản hồi đánh giá từ SQL Server...
          </div>
        ) : reviews.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-2 shadow-xs">
            <MessageSquareText className="w-8 h-8 mx-auto text-slate-300" />
            <h3 className="text-sm font-bold text-slate-800">Không có đánh giá nào</h3>
            <p className="text-xs text-slate-500">Chưa có bình luận nào trong danh mục đã chọn.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviews.map((r) => (
              <div
                key={r.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3.5 flex flex-col justify-between hover:border-slate-300 transition-colors"
              >
                <div>
                  {/* Top Customer info & Rating */}
                  <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      {r.userAvatar ? (
                        <img
                          src={r.userAvatar}
                          alt={r.customerName}
                          className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                          {r.customerName ? r.customerName.charAt(0).toUpperCase() : 'K'}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-extrabold text-xs text-slate-950">{r.customerName}</h4>
                          {r.isVerifiedDining && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                              ✓ Đã dùng bữa
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400">
                          {new Date(r.createdAt).toLocaleString('vi-VN')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center text-amber-500">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3.5 h-3.5 ${
                            s <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Dish Name */}
                  <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800">
                    <Utensils className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Món: {r.dishName}</span>
                  </div>

                  {/* Comment */}
                  <p className="text-xs text-slate-700 mt-2 leading-relaxed bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                    {r.comment ? `"${r.comment}"` : <span className="italic text-slate-400">Khách không để lại nhận xét bằng lời.</span>}
                  </p>

                  {/* Manager Reply Display */}
                  {r.managerReply && (
                    <div className="mt-3 bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800">
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Phản hồi từ Nhà hàng ({r.repliedByName || 'Quản lý'}):</span>
                        </span>
                        {r.repliedAt && (
                          <span className="text-[10px] text-emerald-600 font-normal">
                            {new Date(r.repliedAt).toLocaleDateString('vi-VN')}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-800 italic leading-snug">{r.managerReply}</p>
                    </div>
                  )}
                </div>

                {/* Reply Form & Approval Controls */}
                <div className="pt-3 border-t border-slate-100 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={r.managerReply ? 'Cập nhật lại câu trả lời...' : 'Nhập phản hồi cảm ơn hoặc hỗ trợ khách...'}
                      value={replyInputs[r.id] ?? ''}
                      onChange={(e) =>
                        setReplyInputs((prev) => ({ ...prev, [r.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleSendReply(r);
                      }}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-600"
                    />
                    <button
                      type="button"
                      disabled={submittingReplyId === r.id || !replyInputs[r.id]?.trim()}
                      onClick={() => void handleSendReply(r)}
                      className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1 transition-colors shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{submittingReplyId === r.id ? 'Đang gửi...' : 'Gửi'}</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
                    <div className="flex items-center gap-1">
                      {r.isApproved ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Đã duyệt hiển thị</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleApprove(r)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold border border-emerald-200"
                        >
                          Duyệt Đăng
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleReject(r)}
                      className="text-slate-400 hover:text-red-600 transition-colors"
                    >
                      Từ chối hiển thị
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
