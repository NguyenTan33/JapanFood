import { apiClient } from './apiClient';
import { BankAccountInfo } from '@/types';

export interface RestaurantInfoDto {
  brandName: string;
  japaneseName?: string;
  slogan?: string;
  hotline: string;
  email: string;
  socialLinks?: {
    facebook?: string;
    instagram?: string;
  };
  bankName: string;
  bankId: string;
  accountNumber: string;
  accountName: string;
  bankBranch?: string;
  defaultQrTemplate?: string;
}

export const restaurantInfoService = {
  async getRestaurantInfo(): Promise<RestaurantInfoDto> {
    const { data } = await apiClient.get<RestaurantInfoDto>('/restaurant-info');
    return data;
  },

  async getBankAccountInfo(): Promise<BankAccountInfo> {
    const info = await this.getRestaurantInfo();
    return {
      bankName: info.bankName || 'Ngân hàng Quân Đội (MB Bank)',
      bankCode: info.bankId || 'MB',
      accountNumber: info.accountNumber || '0903123456888',
      accountHolder: info.accountName || 'TORI SAKURA RESTAURANT CO LTD',
      branch: info.bankBranch || 'Chi nhánh Nam Sài Gòn',
      defaultQrTemplate: info.defaultQrTemplate || 'compact2',
    };
  },

  async updateRestaurantInfo(payload: Partial<RestaurantInfoDto>): Promise<void> {
    await apiClient.put('/restaurant-info', payload);
  },
};
