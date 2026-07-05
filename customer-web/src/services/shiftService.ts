import { apiClient } from './apiClient';

export interface CashDrawerWithdrawalDto {
  id: number;
  amount: number;
  photoUrl: string;
  note?: string | null;
  withdrawnByUserId: number;
  withdrawnByName: string;
  withdrawnAt: string;
}

export interface CashierShiftDto {
  id: number;
  shiftCode: string;
  openedByUserId: number;
  openedByName: string;
  openedAt: string;
  closedAt?: string | null;
  openingCash: number;
  cashSalesTotal: number;
  transferSalesTotal: number;
  totalWithdrawn: number;
  currentRemainingCash: number;
  expectedCash?: number;
  actualCash?: number | null;
  varianceAmount?: number | null;
  totalOrdersCount: number;
  status: 'Open' | 'Closed' | string;
  notes?: string | null;
  withdrawals: CashDrawerWithdrawalDto[];
}

export interface CurrentShiftResponse {
  hasOpenShift: boolean;
  shift: CashierShiftDto | null;
}

export interface OpenShiftRequest {
  openingCash: number;
  notes?: string;
}

export interface CloseShiftRequest {
  actualCash: number;
  notes?: string;
}

export interface PagedShiftHistory {
  items: CashierShiftDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export const shiftService = {
  async getCurrentShift(): Promise<CurrentShiftResponse> {
    const { data } = await apiClient.get<CurrentShiftResponse>('/shifts/current');
    return {
      hasOpenShift: Boolean(data?.hasOpenShift && data?.shift),
      shift: data?.shift ?? null,
    };
  },

  async openShift(payload: OpenShiftRequest): Promise<CashierShiftDto> {
    const { data } = await apiClient.post<CashierShiftDto>('/shifts/open', payload);
    window.dispatchEvent(new CustomEvent('pos-shift-updated'));
    return data;
  },

  async closeShift(payload: CloseShiftRequest): Promise<CashierShiftDto> {
    const { data } = await apiClient.post<CashierShiftDto>('/shifts/close', payload);
    window.dispatchEvent(new CustomEvent('pos-shift-updated'));
    return data;
  },

  async getShiftHistory(params?: {
    fromDate?: string;
    toDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PagedShiftHistory> {
    const { data } = await apiClient.get<PagedShiftHistory>('/shifts', { params });
    return data;
  },

  async withdrawCash(amount: number, photo: File, note?: string): Promise<CashierShiftDto> {
    const formData = new FormData();
    formData.append('amount', String(amount));
    if (note && note.trim()) {
      formData.append('note', note.trim());
    }
    formData.append('photo', photo);

    const { data } = await apiClient.post<CashierShiftDto>('/shifts/current/withdrawals', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    window.dispatchEvent(new CustomEvent('pos-shift-updated'));
    return data;
  },
};
