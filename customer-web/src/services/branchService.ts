import { apiClient } from './apiClient';
import { BranchLocation } from '@/types';

export interface BranchDto {
  id: number;
  code: string;
  name: string;
  japaneseName?: string;
  address: string;
  district: string;
  city: string;
  phone: string;
  hotline?: string;
  email?: string;
  openingHours?: {
    lunch?: string;
    dinner?: string;
    note?: string;
  };
  parkingInfo?: {
    motorbike?: string;
    car?: string;
  };
  mapEmbedUrl?: string;
  mapDirectionsUrl?: string;
  imageUrl?: string;
  isMainBranch?: boolean;
  displayOrder?: number;
}

export const mapBranchDto = (dto: BranchDto): BranchLocation => ({
  id: dto.code || String(dto.id),
  name: dto.name,
  japaneseName: dto.japaneseName || '',
  address: dto.address,
  district: dto.district,
  city: dto.city,
  phone: dto.phone,
  hotline: dto.hotline || dto.phone,
  email: dto.email || '',
  openingHours: {
    lunch: dto.openingHours?.lunch || '10:30 - 14:00',
    dinner: dto.openingHours?.dinner || '17:00 - 22:30',
    note: dto.openingHours?.note || '',
  },
  parkingInfo: {
    motorbike: dto.parkingInfo?.motorbike || '',
    car: dto.parkingInfo?.car || '',
  },
  googleMapsUrl: dto.mapDirectionsUrl || '',
  googleMapsEmbedUrl: dto.mapEmbedUrl || '',
  imageUrl: dto.imageUrl || '',
  isFlagship: dto.isMainBranch ?? false,
});

export const branchService = {
  async getBranches(): Promise<BranchLocation[]> {
    const { data } = await apiClient.get<BranchDto[]>('/branches');
    return (data || []).map(mapBranchDto);
  },

  async createBranch(payload: Partial<BranchDto>): Promise<{ id: number; code: string }> {
    const { data } = await apiClient.post('/branches', payload);
    return data;
  },

  async updateBranch(id: number, payload: Partial<BranchDto>): Promise<void> {
    await apiClient.put(`/branches/${id}`, payload);
  },

  async deleteBranch(id: number): Promise<void> {
    await apiClient.delete(`/branches/${id}`);
  },
};
