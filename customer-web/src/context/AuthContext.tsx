import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, normalizeUserRole } from '@/types';
import { authService } from '@/services/authService';
import { TOKEN_KEY, REFRESH_TOKEN_KEY } from '@/services/apiClient';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  isAuthModalOpen: boolean;
  authModalView: 'login' | 'register' | 'forgot';
  authPromptMessage: string | null;
  openAuthModal: (view?: 'login' | 'register' | 'forgot', message?: string) => void;
  closeAuthModal: () => void;
  login: (identifier: string, password: string) => Promise<User>;
  register: (name: string, email: string, phone: string, password: string) => Promise<boolean>;
  forgotPassword: (email: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = 'torisakura_user_v2';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      localStorage.removeItem('torisakura_user_v1'); // purge legacy mock user session
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        localStorage.removeItem(USER_STORAGE_KEY);
        return null;
      }
      const saved = localStorage.getItem(USER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          role: normalizeUserRole(parsed?.role),
        };
      }
    } catch (e) {
      console.error('Failed to load user', e);
    }
    return null;
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalView, setAuthModalView] = useState<'login' | 'register' | 'forgot'>('login');
  const [authPromptMessage, setAuthPromptMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser));
      } else {
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    } catch (e) {
      console.error('Failed to save user', e);
    }
  }, [currentUser]);

  useEffect(() => {
    const handleOpen = () => {
      setAuthModalView('login');
      setAuthPromptMessage(null);
      setIsAuthModalOpen(true);
    };
    window.addEventListener('open-auth-modal', handleOpen);
    return () => window.removeEventListener('open-auth-modal', handleOpen);
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
      setCurrentUser(null);
    };
    window.addEventListener('auth-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth-unauthorized', handleUnauthorized);
  }, []);

  const openAuthModal = useCallback(
    (view: 'login' | 'register' | 'forgot' = 'login', message?: string) => {
      setAuthModalView(view);
      setAuthPromptMessage(message || null);
      setIsAuthModalOpen(true);
    },
    []
  );

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
    setAuthPromptMessage(null);
  }, []);

  const login = async (identifier: string, password: string): Promise<User> => {
    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier || !password) {
      throw new Error('Vui lòng nhập đầy đủ tài khoản và mật khẩu.');
    }

    try {
      const isEmail = trimmedIdentifier.includes('@');
      const credentials = isEmail
        ? { email: trimmedIdentifier, password }
        : { phoneNumber: trimmedIdentifier, password };
      const res = await authService.login(credentials);
      const user: User = {
        id: res.user.id,
        email: res.user.email,
        fullName: res.user.fullName,
        phoneNumber: res.user.phoneNumber,
        role: normalizeUserRole(res.user.role),
        membershipTier: (res.user as any).membershipTier || 'SILVER',
        loyaltyPoints: (res.user as any).loyaltyPoints ?? 0,
        avatarUrl: (res.user as any).avatarUrl,
        createdAt: (res.user as any).createdAt || new Date().toISOString(),
      };
      setCurrentUser(user);
      closeAuthModal();
      return user;
    } catch (e: any) {
      console.error('Real API login failed', e);
      const status = e?.response?.status;
      const backendMessage = e?.response?.data?.message;
      const errorMsg =
        backendMessage ||
        (status === 403
          ? 'Tài khoản của bạn đã bị khóa hoặc vô hiệu hóa. Vui lòng liên hệ Quản trị viên.'
          : 'Đăng nhập không thành công. Vui lòng kiểm tra lại tài khoản và mật khẩu.');
      throw new Error(errorMsg);
    }
  };

  const register = async (name: string, email: string, phone: string, password: string): Promise<boolean> => {
    try {
      await authService.register({ fullName: name, email, phoneNumber: phone, password });
      try {
        await login(email, password);
        return true;
      } catch {
        return true;
      }
    } catch (e: any) {
      console.error('Backend register failed', e);
      const errorMsg = e.response?.data?.message || 'Đăng ký tài khoản không thành công. Vui lòng thử lại.';
      throw new Error(errorMsg);
    }
  };

  const forgotPassword = async (_email: string): Promise<boolean> => {
    return true;
  };

  const logout = () => {
    localStorage.removeItem(USER_STORAGE_KEY);
    setCurrentUser(null);
    void authService.logout();
  };

  const updateUser = (updatedFields: Partial<User>) => {
    setCurrentUser((prev) => {
      if (!prev) return null;
      const updated: User = {
        ...prev,
        ...updatedFields,
        role: updatedFields.role ? normalizeUserRole(updatedFields.role) : normalizeUserRole(prev.role),
      };
      try {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to update user in storage', e);
      }
      return updated;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        isAuthModalOpen,
        authModalView,
        authPromptMessage,
        openAuthModal,
        closeAuthModal,
        login,
        register,
        forgotPassword,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
