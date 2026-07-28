import { apiClient } from './apiClient';

export interface AdminUserDto {
  id: number;
  fullName: string;
  email: string;
  phoneNumber?: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'KITCHEN' | 'CUSTOMER';
  accountStatus?: string;
  isActive: boolean;
  loyaltyPoints: number;
  membershipTier?: string;
  createdAt: string;
}

export interface AdminUserFilterDto {
  role?: string;
  search?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export interface AdminUserListResponseDto {
  items: AdminUserDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateAdminUserRequestDto {
  fullName: string;
  email: string;
  phoneNumber: string;
  password?: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'KITCHEN' | 'CUSTOMER';
}

export interface UpdateUserRoleRequestDto {
  role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'KITCHEN' | 'CUSTOMER';
}

export interface AdminResetPasswordRequestDto {
  newPassword?: string;
}

export interface UpdateCustomerRequestDto {
  fullName: string;
  phoneNumber?: string;
  membershipTier?: string;
  loyaltyPoints?: number;
}

export const adminUserService = {
  async getUsers(filter?: AdminUserFilterDto): Promise<AdminUserListResponseDto> {
    const { data } = await apiClient.get<AdminUserListResponseDto>('/admin/users', { params: filter });
    return data;
  },

  async createUser(payload: CreateAdminUserRequestDto): Promise<AdminUserDto> {
    const { data } = await apiClient.post<AdminUserDto>('/admin/users', payload);
    return data;
  },

  async updateUserRole(id: number, role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'KITCHEN' | 'CUSTOMER'): Promise<AdminUserDto> {
    const { data } = await apiClient.put<AdminUserDto>(`/admin/users/${id}/role`, { role });
    return data;
  },

  async resetPassword(id: number, newPassword?: string): Promise<{ message: string }> {
    const { data } = await apiClient.post<{ message: string }>(`/admin/users/${id}/reset-password`, { newPassword });
    return data;
  },

  async lockUser(id: number): Promise<AdminUserDto> {
    const { data } = await apiClient.patch<AdminUserDto>(`/admin/users/${id}/lock`);
    return data;
  },

  async unlockUser(id: number): Promise<AdminUserDto> {
    const { data } = await apiClient.patch<AdminUserDto>(`/admin/users/${id}/unlock`);
    return data;
  },

  async deleteUser(id: number): Promise<{ message: string }> {
    const { data } = await apiClient.delete<{ message: string }>(`/admin/users/${id}`);
    return data;
  },

  async updateCustomer(id: number, payload: UpdateCustomerRequestDto): Promise<AdminUserDto> {
    const { data } = await apiClient.put<AdminUserDto>(`/admin/users/customers/${id}`, payload);
    return data;
  },

  async updateStaffUser(id: number, payload: {
    fullName?: string;
    phoneNumber?: string;
    email?: string;
    role?: string;
    accountStatus?: string;
  }): Promise<AdminUserDto> {
    const { data } = await apiClient.put<AdminUserDto>(`/admin/users/${id}`, payload);
    return data;
  },
};
