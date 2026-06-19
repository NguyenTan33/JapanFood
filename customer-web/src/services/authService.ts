import { apiClient, TOKEN_KEY, REFRESH_TOKEN_KEY } from './apiClient';

export interface LoginRequest {
  email?: string;
  phoneNumber?: string;
  password?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresInMinutes: number;
  user: {
    id: number;
    email: string;
    fullName: string;
    phoneNumber: string;
    role: string;
  };
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  phoneNumber: string;
  password?: string;
}

export const authService = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const { data } = await apiClient.post<LoginResponse>('/auth/login', credentials);
    if (data.accessToken) {
      localStorage.setItem(TOKEN_KEY, data.accessToken);
    }
    if (data.refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    }
    return data;
  },

  async register(info: RegisterRequest): Promise<{ message: string; requiresOtp: boolean }> {
    const { data } = await apiClient.post('/auth/register', info);
    return data;
  },

  async verifyOtp(email: string, otp: string): Promise<LoginResponse> {
    const { data } = await apiClient.post<LoginResponse>('/auth/verify-otp', { email, otp });
    if (data.accessToken) {
      localStorage.setItem(TOKEN_KEY, data.accessToken);
    }
    if (data.refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    }
    return data;
  },

  async logout(): Promise<void> {
    try {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (refreshToken) {
        await apiClient.post('/auth/logout', { refreshToken });
      }
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem(TOKEN_KEY);
  },

  async changePassword(data: { currentPassword: string; newPassword: string; confirmPassword: string }) {
    const { data: res } = await apiClient.post('/auth/change-password', {
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
      confirmPassword: data.confirmPassword
    });
    return res;
  },

  async getMe() {
    const { data } = await apiClient.get('/auth/me');
    return data;
  },

  async updateProfile(data: { fullName: string; email: string; avatarUrl?: string }) {
    const { data: res } = await apiClient.put('/auth/profile', data);
    return res;
  },

  async sendChangePhoneOtp(newPhoneNumber: string): Promise<{ message: string; otp?: string }> {
    const { data: res } = await apiClient.post('/auth/phone/send-otp', { newPhoneNumber });
    return res;
  },

  async verifyChangePhoneOtp(newPhoneNumber: string, otp: string) {
    const { data: res } = await apiClient.post('/auth/phone/verify-otp', { newPhoneNumber, otp });
    return res;
  }
};
