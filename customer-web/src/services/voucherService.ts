import { apiClient } from './apiClient';
import { Voucher, DiscountType } from '@/types';

export interface VoucherValidationResult {
  isValid: boolean;
  voucherId?: number;
  voucherCode?: string;
  code?: string;
  discountType?: string;
  discountAmount: number;
  finalTotal: number;
  message?: string;
  errorMessage?: string;
}

export const mapVoucherDto = (dto: any): Voucher => ({
  id: dto.id,
  code: dto.code || dto.voucherCode,
  title: dto.title || dto.code,
  description: dto.description || '',
  discountType: (dto.discountType?.toUpperCase() === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED_AMOUNT') as DiscountType,
  discountValue: Number(dto.discountValue || 0),
  minOrderAmount: Number(dto.minOrderAmount || 0),
  maxDiscountAmount: dto.maxDiscountAmount ? Number(dto.maxDiscountAmount) : undefined,
  startDate: dto.startDate,
  endDate: dto.endDate,
  isActive: dto.isActive ?? true,
});

export const voucherService = {
  async getAllVouchers(): Promise<Voucher[]> {
    const { data } = await apiClient.get('/vouchers?includeInactive=true');
    const list = Array.isArray(data) ? data : (data?.items || []);
    return list.map(mapVoucherDto);
  },

  async getActiveVouchers(): Promise<Voucher[]> {
    const { data } = await apiClient.get('/vouchers');
    const list = Array.isArray(data) ? data : (data?.items || []);
    return list.map(mapVoucherDto);
  },

  async applyVoucher(code: string, currentSubtotal: number): Promise<VoucherValidationResult> {
    const { data } = await apiClient.post<VoucherValidationResult>('/vouchers/apply', {
      code: code.trim().toUpperCase(),
      currentSubtotal,
    });
    if (!data.isValid && data.errorMessage) {
      throw new Error(data.errorMessage);
    }
    return data;
  },

  async createVoucher(payload: any): Promise<void> {
    await apiClient.post('/vouchers', payload);
  },

  async activateVoucher(id: number): Promise<void> {
    await apiClient.patch(`/vouchers/${id}/activate`);
  },

  async deactivateVoucher(id: number): Promise<void> {
    await apiClient.patch(`/vouchers/${id}/deactivate`);
  },

  async deleteVoucher(id: number): Promise<void> {
    await apiClient.delete(`/vouchers/${id}`);
  },
};
