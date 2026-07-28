import { apiClient } from './apiClient';

export interface BranchWifiConfigDto {
  id: number;
  branchId: number;
  branchName?: string;
  ssid: string;
  bssid?: string;
  publicIpSubnet?: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
}

export interface CreateWifiConfigPayload {
  branchId: number;
  ssid: string;
  bssid?: string;
  publicIpSubnet?: string;
  description?: string;
}

export interface UpdateWifiConfigPayload {
  ssid: string;
  bssid?: string;
  publicIpSubnet?: string;
  description?: string;
}

export interface VerifyNetworkResponse {
  isAllowed: boolean;
  ssid?: string;
  clientIp?: string;
}

export const wifiConfigService = {
  async getConfigsByBranch(branchId: number = 1): Promise<BranchWifiConfigDto[]> {
    const { data } = await apiClient.get(`/admin/wifi-configs/branch/${branchId}`);
    return Array.isArray(data) ? data : [];
  },

  async getActiveSsids(branchId: number = 1): Promise<string[]> {
    const { data } = await apiClient.get('/admin/wifi-configs/active-ssids', {
      params: { branchId },
    });
    return Array.isArray(data) ? data : [];
  },

  async verifyNetwork(branchId: number = 1, ssid?: string): Promise<VerifyNetworkResponse> {
    const { data } = await apiClient.get('/admin/wifi-configs/verify-network', {
      params: { branchId, ssid },
    });
    return data;
  },

  async createConfig(payload: CreateWifiConfigPayload): Promise<BranchWifiConfigDto> {
    const { data } = await apiClient.post('/admin/wifi-configs', payload);
    return data;
  },

  async updateConfig(id: number, payload: UpdateWifiConfigPayload): Promise<BranchWifiConfigDto> {
    const { data } = await apiClient.put(`/admin/wifi-configs/${id}`, payload);
    return data;
  },

  async deleteConfig(id: number): Promise<void> {
    await apiClient.delete(`/admin/wifi-configs/${id}`);
  },

  async toggleStatus(id: number, isActive: boolean): Promise<void> {
    await apiClient.patch(`/admin/wifi-configs/${id}/toggle-status`, { isActive });
  },
};
