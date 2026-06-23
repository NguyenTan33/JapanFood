import { apiClient } from './apiClient';
import type { TableArea, ReservationAreaId } from '@/types';
export type { TableArea, ReservationAreaId };

export interface CreateReservationRequest {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  guestCount: number;
  reservationTime: string;
  preferredAreaId?: number | string;
  specialRequests?: string;
}

export interface ReservationSummary {
  reservationId: number;
  reservationCode: string;
  customerName: string;
  customerPhone: string;
  guestCount: number;
  reservationTime: string;
  status: string;
  tableName?: string;
}

export interface ManagedReservationDto {
  reservationId: number;
  userId?: number;
  reservationCode: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  guestCount: number;
  reservationTime: string;
  status: 'Pending' | 'Confirmed' | 'Seated' | 'Completed' | 'Cancelled' | 'NoShow' | string;
  depositStatus: string;
  depositAmount: number;
  assignedTableId?: number;
  assignedTableNumber?: string;
  preferredAreaId?: number;
  preferredAreaName?: string;
  specialRequests?: string;
  allergies?: string;
  notes?: string;
  confirmedAt?: string;
  seatedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt: string;
}

export interface ReservationStatusCounts {
  total: number;
  pending: number;
  confirmed: number;
  seated: number;
  completed: number;
  cancelled: number;
  noShow: number;
}

export interface ReservationManageResponse {
  items: ManagedReservationDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  counts: ReservationStatusCounts;
}

export interface ReservationManageFilter {
  fromDate?: string;
  toDate?: string;
  status?: string;
  areaId?: number;
  search?: string;
  page?: number;
  pageSize?: number;
  minGuests?: number;
  maxGuests?: number;
  depositStatus?: string;
  mealSession?: string;
}

export interface TableAreaDetailDto {
  id: number;
  code: string;
  name: string;
  japaneseName?: string;
  description?: string;
  imageUrl?: string;
  features: string[];
  capacityPerTable?: string;
  minGuests: number;
  maxGuests: number;
  requiresDeposit: boolean;
  depositPerGuest?: number;
  displayOrder: number;
  isActive: boolean;
  tableCount: number;
}

export interface TableItemDto {
  tableId: number;
  tableNumber: string;
  capacity: number;
  minCapacity: number;
  areaId: number;
  areaName: string;
  status: string;
  currentOrderId?: number;
  activeOrderId?: number;
  openedAt?: string;
  currentTotal: number;
  totalAmount: number;
  guestCount?: number;
  reservationTime?: string;
  mergedIntoTableId?: number;
  isActive: boolean;
}

export const mapTableAreaDto = (dto: any): TableArea => ({
  id: (dto.code?.toLowerCase() === 'bar' ? 'sushi-bar' :
       dto.code?.toLowerCase() === 'tatami' ? 'tatami-room' :
       dto.code?.toLowerCase() === 'vip' ? 'vip-room' : 'main-dining') as ReservationAreaId,
  dbId: Number(dto.id || dto.areaId || 0),
  code: dto.code || '',
  name: dto.name || '',
  japaneseName: dto.japaneseName || '',
  description: dto.description || '',
  imageUrl: dto.imageUrl || '',
  features: Array.isArray(dto.features) ? dto.features : [],
  capacityPerTable: dto.capacityPerTable || '',
  minGuests: dto.minGuests ?? 1,
  maxGuests: dto.maxGuests ?? 10,
  requiresDeposit: dto.requiresDeposit ?? false,
  depositPerGuest: dto.depositPerGuest ? Number(dto.depositPerGuest) : undefined,
});

export const reservationService = {
  async getAreas(): Promise<TableArea[]> {
    const { data } = await apiClient.get('/reservations/areas');
    const list = Array.isArray(data) ? data : (data?.items || []);
    return list.map(mapTableAreaDto);
  },

  async findAvailableTables(params: {
    reservationTime: string;
    durationMinutes?: number;
    guestCount?: number;
    areaId?: number;
  }) {
    const { data } = await apiClient.get('/reservations/available-tables', { params });
    return data;
  },

  async createReservation(request: CreateReservationRequest): Promise<ReservationSummary> {
    const payload: any = { ...request };
    if (typeof payload.preferredAreaId === 'string') {
      const code = payload.preferredAreaId.toLowerCase();
      if (code === 'main-dining' || code === 'main') payload.preferredAreaId = 1;
      else if (code === 'vip-room' || code === 'vip') payload.preferredAreaId = 2;
      else if (code === 'sushi-bar' || code === 'bar') payload.preferredAreaId = 3;
      else if (code === 'tatami-room' || code === 'tatami') payload.preferredAreaId = 4;
      else {
        const parsed = parseInt(payload.preferredAreaId, 10);
        payload.preferredAreaId = isNaN(parsed) ? undefined : parsed;
      }
    }
    const { data } = await apiClient.post<ReservationSummary>('/reservations', payload);
    return data;
  },

  async getMyHistory(page = 1, pageSize = 10) {
    const { data } = await apiClient.get('/reservations/my-history', {
      params: { page, pageSize },
    });
    return data;
  },

  async cancelReservation(id: number, reason: string) {
    const { data } = await apiClient.post(`/reservations/${id}/cancel`, { reason });
    return data;
  },

  // Manager & Admin Reservation Management
  async getManagedReservations(filter?: ReservationManageFilter): Promise<ReservationManageResponse> {
    const { data } = await apiClient.get<ReservationManageResponse>('/reservations/manage', { params: filter });
    return data;
  },

  async confirmReservation(id: number): Promise<{ message: string }> {
    const { data } = await apiClient.post<{ message: string }>(`/reservations/${id}/confirm`);
    return data;
  },

  async checkInGuest(id: number): Promise<{ message: string }> {
    const { data } = await apiClient.post<{ message: string }>(`/reservations/${id}/check-in`);
    return data;
  },

  async markNoShow(id: number, notes?: string): Promise<{ message: string }> {
    const { data } = await apiClient.post<{ message: string }>(`/reservations/${id}/no-show`, { notes });
    return data;
  },

  // Areas Management (Admin & Manager)
  async getAllAreasForAdmin(): Promise<TableAreaDetailDto[]> {
    const { data } = await apiClient.get<TableAreaDetailDto[]>('/reservations/areas/all');
    return data;
  },

  async createArea(payload: any): Promise<TableAreaDetailDto> {
    const { data } = await apiClient.post<TableAreaDetailDto>('/reservations/areas', payload);
    return data;
  },

  async updateArea(id: number, payload: any): Promise<TableAreaDetailDto> {
    const { data } = await apiClient.put<TableAreaDetailDto>(`/reservations/areas/${id}`, payload);
    return data;
  },

  async setAreaStatus(id: number, isActive: boolean): Promise<void> {
    await apiClient.patch(`/reservations/areas/${id}/status`, { isActive });
  },

  async deleteArea(id: number): Promise<void> {
    await apiClient.delete(`/reservations/areas/${id}`);
  },

  // Tables Management (Admin & Manager)
  async getAllTablesForAdmin(areaId?: number): Promise<TableItemDto[]> {
    const { data } = await apiClient.get<TableItemDto[]>('/reservations/tables/all', { params: { areaId } });
    return data;
  },

  async createTable(payload: { areaId: number; tableNumber: string; capacity: number; minCapacity?: number }): Promise<TableItemDto> {
    const { data } = await apiClient.post<TableItemDto>('/reservations/tables', payload);
    return data;
  },

  async updateTable(id: number, payload: { areaId: number; tableNumber: string; capacity: number; minCapacity?: number }): Promise<TableItemDto> {
    const { data } = await apiClient.put<TableItemDto>(`/reservations/tables/${id}`, payload);
    return data;
  },

  async setTableStatus(id: number, isActive: boolean): Promise<void> {
    await apiClient.patch(`/reservations/tables/${id}/status`, { isActive });
  },

  async deleteTable(id: number): Promise<void> {
    await apiClient.delete(`/reservations/tables/${id}`);
  },
};
