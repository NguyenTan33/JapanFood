import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MockStorage,
  AUTH_STORAGE_KEYS,
  setAuthTokens,
  getAuthTokens,
  clearAuthTokens,
  validateUserProfileSchema,
  validateNoDemoBypassSource,
} from '../harness/index.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');
const STRICT_R2 = process.env.E2E_STRICT_R2 === '1';

describe('Tier 1 - Feature R2/R4: Customer Authentication & Account Navigation', () => {
  let storage;

  beforeEach(() => {
    storage = new MockStorage();
  });

  it('T1-R2-01: Two-step Customer Registration (POST /api/auth/register -> 201 -> verify-otp)', () => {
    const userRegistry = new Map();
    const pendingOtps = new Map();

    function registerCustomer({ fullName, email, phoneNumber, password, confirmPassword }) {
      if (!fullName || fullName.trim().length < 2) throw new Error('Họ tên không hợp lệ');
      if (!email || !email.includes('@')) throw new Error('Email không hợp lệ');
      if (password !== confirmPassword) throw new Error('Mật khẩu xác nhận không khớp');
      if (userRegistry.has(email)) throw new Error('Email đã tồn tại');

      const user = {
        id: 1001,
        fullName,
        email,
        phoneNumber,
        role: 'CUSTOMER',
        membershipTier: 'BRONZE',
        loyaltyPoints: 0,
        accountStatus: 'PENDING_VERIFY',
      };
      userRegistry.set(email, user);
      pendingOtps.set(email, '842913');
      return { statusCode: 201, message: 'Mã OTP đã được gửi', userId: user.id };
    }

    function verifyOtp({ email, otp }) {
      if (pendingOtps.get(email) !== otp) throw new Error('Mã OTP không hợp lệ');
      const user = userRegistry.get(email);
      user.accountStatus = 'ACTIVE';
      return {
        message: 'Xác thực thành công',
        userId: user.id,
        accessToken: 'jwt_access_verified',
        refreshToken: 'jwt_refresh_verified',
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
          loyaltyPoints: user.loyaltyPoints,
          membershipTier: user.membershipTier,
        },
      };
    }

    const regRes = registerCustomer({
      fullName: 'Nguyễn Văn A',
      email: 'nguyenvana@example.com',
      phoneNumber: '0912345678',
      password: 'Pass@1234',
      confirmPassword: 'Pass@1234',
    });
    assert.equal(regRes.statusCode, 201);

    const verifyRes = verifyOtp({ email: 'nguyenvana@example.com', otp: '842913' });
    validateUserProfileSchema(verifyRes.user);
    assert.ok(verifyRes.accessToken);
    assert.ok(verifyRes.refreshToken);
    assert.equal(verifyRes.user.email, 'nguyenvana@example.com');
  });

  it('T1-R2-02: Customer Login Flow & torisakura_* Token Storage Contract', () => {
    const profileDto = {
      id: 4,
      fullName: 'Khách hàng Tori Sakura',
      email: 'customer@japanfood.vn',
      phoneNumber: '+84966666666',
      role: 'CUSTOMER',
      membershipTier: 'SILVER',
      loyaltyPoints: 120,
    };

    function login({ email, phoneNumber, password }) {
      const identifier = email || phoneNumber;
      if (identifier === 'customer@japanfood.vn' && password === 'Customer@123456') {
        const response = {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access',
          refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh',
          expiresAt: new Date(Date.now() + 3600_000).toISOString(),
          expiresInMinutes: 60,
          user: profileDto,
        };
        setAuthTokens(storage, response);
        return response;
      }
      throw new Error('Tài khoản hoặc mật khẩu không chính xác');
    }

    const session = login({ email: 'customer@japanfood.vn', password: 'Customer@123456' });
    validateUserProfileSchema(session.user);
    assert.equal(storage.getItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN), session.accessToken);
    assert.equal(storage.getItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN), session.refreshToken);
    assert.equal(storage.getItem('japanfood_auth_token'), null);
    assert.equal(storage.getItem('japanfood_auth_user'), null);
  });

  it('T1-R2-03: Customer Logout Flow clearing torisakura_* tokens', () => {
    setAuthTokens(storage, {
      accessToken: 'valid_access_token',
      refreshToken: 'valid_refresh_token',
    });

    function logout() {
      clearAuthTokens(storage);
      return { isAuthenticated: false, user: null };
    }

    const state = logout();
    assert.equal(state.isAuthenticated, false);
    const tokens = getAuthTokens(storage);
    assert.equal(tokens.accessToken, null);
    assert.equal(tokens.refreshToken, null);
  });

  it('T1-R2-04: Session Re-hydration via torisakura_access_token -> GET /api/auth/me & /api/auth/refresh', () => {
    setAuthTokens(storage, {
      accessToken: 'expired_access_token',
      refreshToken: 'valid_refresh_token',
    });

    function hydrateSession(store, { refreshEndpoint, meEndpoint }) {
      const { accessToken, refreshToken } = getAuthTokens(store);
      if (!accessToken) return { isAuthenticated: false, user: null };

      let currentToken = accessToken;
      if (currentToken === 'expired_access_token' && refreshToken) {
        const refreshed = refreshEndpoint(refreshToken);
        setAuthTokens(store, refreshed);
        currentToken = refreshed.accessToken;
      }

      const user = meEndpoint(currentToken);
      validateUserProfileSchema(user);
      return { isAuthenticated: true, user };
    }

    const result = hydrateSession(storage, {
      refreshEndpoint: (rt) => {
        assert.equal(rt, 'valid_refresh_token');
        return {
          accessToken: 'new_access_token_456',
          refreshToken: 'rotated_refresh_token_789',
          expiresInMinutes: 60,
        };
      },
      meEndpoint: (token) => {
        assert.equal(token, 'new_access_token_456');
        return {
          id: 4,
          fullName: 'Lê Hoàng Long',
          email: 'customer@japanfood.vn',
          phoneNumber: '+84966666666',
          role: 'CUSTOMER',
          loyaltyPoints: 350,
          membershipTier: 'GOLD',
        };
      },
    });

    assert.equal(result.isAuthenticated, true);
    assert.equal(result.user.membershipTier, 'GOLD');
    assert.equal(storage.getItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN), 'new_access_token_456');
    assert.equal(storage.getItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN), 'rotated_refresh_token_789');
  });

  it('T1-R2-05: Forgot Password 3-Step OTP Verification Flow (email or phoneNumber)', () => {
    class ForgotPasswordWorkflow {
      constructor() {
        this.step = 1;
        this.otpToken = null;
        this.verified = false;
      }

      requestOtp({ email, phoneNumber }) {
        const identifier = email || phoneNumber;
        if (!identifier) throw new Error('Vui lòng nhập email hoặc số điện thoại');
        this.otpToken = '654321';
        this.step = 2;
        return { message: 'Mã xác thực OTP đã được gửi' };
      }

      verifyOtp(inputOtp) {
        if (this.step !== 2) throw new Error('Sai bước');
        if (inputOtp !== this.otpToken) throw new Error('Mã OTP không chính xác');
        this.verified = true;
        this.step = 3;
        return { message: 'Xác thực OTP thành công' };
      }

      resetPassword(newPassword, confirmNewPassword) {
        if (this.step !== 3 || !this.verified) throw new Error('Chưa xác thực OTP');
        if (newPassword.length < 6) throw new Error('Mật khẩu mới tối thiểu 6 ký tự');
        if (newPassword !== confirmNewPassword) throw new Error('Mật khẩu không khớp');
        this.step = 4;
        return { success: true, message: 'Mật khẩu đã được cập nhật thành công' };
      }
    }

    const flow = new ForgotPasswordWorkflow();
    flow.requestOtp({ email: 'customer@japanfood.vn' });
    assert.equal(flow.step, 2);
    flow.verifyOtp('654321');
    assert.equal(flow.step, 3);
    const done = flow.resetPassword('NewSecret@2026', 'NewSecret@2026');
    assert.equal(done.success, true);
    assert.equal(flow.step, 4);
  });

  it('T1-R2-06: Credential Login + /api/auth/me Contract & Zero Demo VIP Bypass Enforcement', () => {
    // Verify policy validator catches any legacy demo VIP bypass
    assert.throws(
      () => validateNoDemoBypassSource('const btn = "Demo Khách VIP";', 'MockAuthModal'),
      /R2\/R3 violation/
    );
    assert.throws(
      () => validateNoDemoBypassSource('const PRESET_ACCOUNTS = [{ email: "vip.guest@japanfood.vn" }];', 'MockAuthModal'),
      /R2\/R3 violation/
    );

    // Clean login contract accepts real credentials only (no preset autofill shortcut)
    function submitLoginForm({ email, password }) {
      assert.ok(email && email.includes('@'), 'Email credential is required');
      assert.ok(password && password.length >= 6, 'Password credential is required');
      return {
        endpoint: '/api/auth/login',
        payload: { email, password },
        followsWithMeHydration: '/api/auth/me',
      };
    }

    const loginCall = submitLoginForm({ email: 'customer@japanfood.vn', password: 'Customer@123456' });
    assert.equal(loginCall.endpoint, '/api/auth/login');
    assert.equal(loginCall.followsWithMeHydration, '/api/auth/me');

    if (STRICT_R2) {
      const authModalPath = join(PROJECT_ROOT, 'src', 'components', 'modals', 'AuthModal.tsx');
      const authContextPath = join(PROJECT_ROOT, 'src', 'context', 'AuthContext.tsx');
      if (existsSync(authModalPath)) {
        validateNoDemoBypassSource(readFileSync(authModalPath, 'utf-8'), 'AuthModal.tsx');
      }
      if (existsSync(authContextPath)) {
        validateNoDemoBypassSource(readFileSync(authContextPath, 'utf-8'), 'AuthContext.tsx');
      }
    }
  });
});
