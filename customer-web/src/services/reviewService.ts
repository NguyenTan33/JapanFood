import { apiClient } from './apiClient';
import { Review } from '@/types';

export interface PendingReviewItem {
  menuItemId: number;
  dishName: string;
  imageUrl?: string;
  price: number;
}

export interface PendingReviewOrder {
  orderId: number;
  orderCode: string;
  completedAt: string;
  remainingDays: number;
  isExpired: boolean;
  items: PendingReviewItem[];
}

export interface CreateReviewRequest {
  menuItemId: number;
  orderId: number;
  rating: number;
  comment?: string;
}

export interface ManagedReviewDto {
  id: number;
  reviewId: number;
  menuItemId: number;
  dishName: string;
  userId: number;
  customerName: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  comment?: string;
  isVerifiedDining: boolean;
  likesCount: number;
  isApproved: boolean;
  rejectionReason?: string;
  managerReply?: string;
  repliedAt?: string;
  repliedByName?: string;
  createdAt: string;
}

export interface ReviewManageCounts {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  unreplied: number;
}

export interface ReviewManagePagedResult {
  items: ManagedReviewDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  counts: ReviewManageCounts;
}

export interface ReviewManageFilter {
  status?: string;
  rating?: number;
  menuItemId?: number;
  hasReply?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

export const mapReviewDto = (dto: any): Review => ({
  id: dto.id || dto.reviewId,
  userName: dto.userName || dto.customerName || 'Khách hàng',
  userAvatar: dto.userAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
  rating: Number(dto.rating || 5),
  comment: dto.comment || '',
  createdAt: dto.createdAt ? new Date(dto.createdAt).toISOString() : new Date().toISOString(),
  dishId: dto.menuItemId,
  dishName: dto.dishName,
  isVerifiedDining: dto.isVerifiedDining ?? true,
  likesCount: dto.likesCount || 0,
});

export const reviewService = {
  async getAllApprovedReviews(params?: { featured?: boolean; limit?: number; page?: number; pageSize?: number }): Promise<Review[]> {
    const { data } = await apiClient.get('/reviews', { params });
    const list = data?.items || (Array.isArray(data) ? data : []);
    return list.map(mapReviewDto);
  },

  async getPendingOrders(): Promise<PendingReviewOrder[]> {
    const { data } = await apiClient.get<PendingReviewOrder[]>('/reviews/pending-orders');
    return data;
  },

  async submitReview(request: CreateReviewRequest) {
    const { data } = await apiClient.post('/reviews', request);
    return data;
  },

  async getDishReviews(dishId: number, page = 1, pageSize = 10) {
    const { data } = await apiClient.get(`/reviews/dishes/${dishId}`, {
      params: { page, pageSize }
    });
    return data;
  },

  async deleteReview(id: number): Promise<void> {
    await apiClient.delete(`/reviews/${id}`);
  },

  // Manager & Admin Review Management
  async getManagedReviews(filter?: ReviewManageFilter): Promise<ReviewManagePagedResult> {
    const { data } = await apiClient.get<ReviewManagePagedResult>('/reviews/manage', { params: filter });
    return data;
  },

  async replyReview(id: number, reply: string): Promise<ManagedReviewDto> {
    const { data } = await apiClient.post<ManagedReviewDto>(`/reviews/${id}/reply`, { reply });
    return data;
  },

  async approveReview(id: number): Promise<void> {
    await apiClient.put(`/reviews/${id}/approve`);
  },

  async rejectReview(id: number, reason?: string): Promise<void> {
    await apiClient.put(`/reviews/${id}/reject`, { reason });
  },
};
