import { apiClient } from './apiClient';

export interface UserAddress {
  addressId: number;
  userId: number;
  recipientName: string;
  phoneNumber: string;
  streetAddress: string;
  ward: string;
  district: string;
  city: string;
  fullAddress: string;
  isDefault: boolean;
}

export interface CreateAddressRequest {
  recipientName: string;
  phoneNumber: string;
  streetAddress: string;
  ward?: string;
  district?: string;
  city?: string;
  isDefault?: boolean;
}

export interface UpdateAddressRequest {
  recipientName?: string;
  phoneNumber?: string;
  streetAddress?: string;
  ward?: string;
  district?: string;
  city?: string;
  isDefault?: boolean;
}

export const addressService = {
  async getAddresses(): Promise<UserAddress[]> {
    try {
      const { data } = await apiClient.get<UserAddress[]>('/user/addresses');
      return data;
    } catch (e) {
      console.warn('Failed to fetch addresses from backend, checking localStorage fallback', e);
      const saved = localStorage.getItem('torisakura_user_addresses');
      if (saved) return JSON.parse(saved);
      return [];
    }
  },

  async createAddress(request: CreateAddressRequest): Promise<UserAddress> {
    try {
      const { data } = await apiClient.post<UserAddress>('/user/addresses', request);
      return data;
    } catch (e) {
      console.warn('Backend address create failed, saving locally', e);
      const newAddr: UserAddress = {
        addressId: Date.now(),
        userId: 1,
        recipientName: request.recipientName,
        phoneNumber: request.phoneNumber,
        streetAddress: request.streetAddress,
        ward: request.ward || '',
        district: request.district || '',
        city: request.city || 'TP. Hồ Chí Minh',
        fullAddress: [request.streetAddress, request.ward, request.district, request.city || 'TP. Hồ Chí Minh'].filter(Boolean).join(', '),
        isDefault: !!request.isDefault
      };
      const saved = localStorage.getItem('torisakura_user_addresses');
      const list: UserAddress[] = saved ? JSON.parse(saved) : [];
      if (newAddr.isDefault) {
        list.forEach((a) => (a.isDefault = false));
      }
      list.unshift(newAddr);
      localStorage.setItem('torisakura_user_addresses', JSON.stringify(list));
      return newAddr;
    }
  },

  async updateAddress(id: number, request: UpdateAddressRequest): Promise<UserAddress> {
    const { data } = await apiClient.put<UserAddress>(`/user/addresses/${id}`, request);
    return data;
  },

  async deleteAddress(id: number): Promise<void> {
    try {
      await apiClient.delete(`/user/addresses/${id}`);
    } catch (e) {
      const saved = localStorage.getItem('torisakura_user_addresses');
      if (saved) {
        const list: UserAddress[] = JSON.parse(saved);
        const filtered = list.filter((a) => a.addressId !== id);
        localStorage.setItem('torisakura_user_addresses', JSON.stringify(filtered));
      }
    }
  },

  async setDefaultAddress(id: number): Promise<UserAddress> {
    const { data } = await apiClient.put<UserAddress>(`/user/addresses/${id}/set-default`);
    return data;
  }
};
