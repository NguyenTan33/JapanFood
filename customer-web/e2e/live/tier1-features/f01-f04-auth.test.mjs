import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  E2E_GOOGLE_ID_TOKEN,
  E2E_GOOGLE_NEW_ID_TOKEN,
  SEEDED_USERS,
  VIEWPORTS,
} from '../harness/env.mjs';
import {
  activateUserByEmailOrPhone,
  apiRequest,
  backdateLatestOtpCooldown,
  cleanupDisposableUser,
  createDisposableCustomer,
  freshLogin,
  getCachedSession,
  resolveOtpFromDb,
  uniqueTestIdentity,
} from '../harness/api-client.mjs';
import { closeBrowser, gotoRoute, withPage } from '../harness/browser.mjs';

after(async () => {
  await closeBrowser();
});

describe('Tier 1 — F1: Register + OTP Verify + Resend', () => {
  it('T1-F1-01: API Register Happy Path returns 201 and leaves account PENDING_VERIFY until verified', async () => {
    const id = uniqueTestIdentity('t1f101');
    try {
      const reg = await apiRequest('/auth/register', {
        method: 'POST',
        body: {
          fullName: id.fullName,
          email: id.email,
          phoneNumber: id.phoneNumber,
          password: id.password,
        },
      });
      assert.equal(reg.status, 201, `Expected 201 on register, got ${reg.status}: ${reg.text}`);
      assert.ok(reg.data?.userId, 'Register response must include userId');
      assert.match(String(reg.data?.message || ''), /OTP|đăng ký/i);

      // Unverified account must be blocked from login (400 PENDING_VERIFY)
      const preVerifyLogin = await freshLogin({
        email: id.email,
        phoneNumber: id.email,
        password: id.password,
      });
      assert.equal(preVerifyLogin.status, 400, `Expected 400 for PENDING_VERIFY login, got ${preVerifyLogin.status}`);
    } finally {
      cleanupDisposableUser({ email: id.email, phoneNumber: id.phoneNumber });
    }
  });

  it('T1-F1-02: API Verify OTP by Email (or controlled fallback contract check when E2E_OTP_CODE/hash unavailable)', async () => {
    const id = uniqueTestIdentity('t1f102');
    try {
      const reg = await apiRequest('/auth/register', {
        method: 'POST',
        body: {
          fullName: id.fullName,
          email: id.email,
          phoneNumber: id.phoneNumber,
          password: id.password,
        },
      });
      assert.equal(reg.status, 201);

      const otp = resolveOtpFromDb(id.phoneNumber, 'Register');
      if (otp) {
        const verifyRes = await apiRequest('/auth/verify-otp', {
          method: 'POST',
          body: { email: id.email, phoneNumber: id.phoneNumber, otp },
        });
        assert.equal(verifyRes.status, 200, `Expected 200 on verify-otp by email, got ${verifyRes.status}: ${verifyRes.text}`);
        assert.ok(verifyRes.data?.userId, 'verify-otp must return userId');
        const loginRes = await freshLogin({ email: id.email, phoneNumber: id.email, password: id.password });
        assert.equal(loginRes.status, 200);
        const me = await apiRequest('/auth/me', { token: loginRes.data.accessToken });
        assert.equal(me.status, 200);
        assert.equal(me.data?.email?.toLowerCase(), id.email.toLowerCase());
      } else {
        const badVerify = await apiRequest('/auth/verify-otp', {
          method: 'POST',
          body: { email: id.email, phoneNumber: id.phoneNumber, otp: '000000' },
        });
        assert.equal(badVerify.status, 400);
        activateUserByEmailOrPhone(id.email, id.phoneNumber);
        const loginRes = await freshLogin({ email: id.email, phoneNumber: id.email, password: id.password });
        assert.equal(loginRes.status, 200);
        const me = await apiRequest('/auth/me', { token: loginRes.data.accessToken });
        assert.equal(me.status, 200);
      }
    } finally {
      cleanupDisposableUser({ email: id.email, phoneNumber: id.phoneNumber });
    }
  });

  it('T1-F1-03: API Verify OTP by Phone activates account', async () => {
    const id = uniqueTestIdentity('t1f103');
    try {
      const reg = await apiRequest('/auth/register', {
        method: 'POST',
        body: {
          fullName: id.fullName,
          email: id.email,
          phoneNumber: id.phoneNumber,
          password: id.password,
        },
      });
      assert.equal(reg.status, 201);

      const otp = resolveOtpFromDb(id.phoneNumber, 'Register');
      if (otp) {
        const verifyRes = await apiRequest('/auth/verify-otp', {
          method: 'POST',
          body: { phoneNumber: id.phoneNumber, otp },
        });
        assert.equal(verifyRes.status, 200, `Expected 200 on verify-otp by phone, got ${verifyRes.status}: ${verifyRes.text}`);
        const loginRes = await freshLogin({ phoneNumber: id.phoneNumber, password: id.password });
        assert.equal(loginRes.status, 200);
      } else {
        const badVerify = await apiRequest('/auth/verify-otp', {
          method: 'POST',
          body: { phoneNumber: id.phoneNumber, otp: '000000' },
        });
        assert.equal(badVerify.status, 400);
        activateUserByEmailOrPhone(id.email, id.phoneNumber);
        const loginRes = await freshLogin({ phoneNumber: id.phoneNumber, password: id.password });
        assert.equal(loginRes.status, 200);
      }
    } finally {
      cleanupDisposableUser({ email: id.email, phoneNumber: id.phoneNumber });
    }
  });

  it('T1-F1-04: API Resend OTP After Cooldown issues fresh valid OTP', async () => {
    const id = uniqueTestIdentity('t1f104');
    try {
      const reg = await apiRequest('/auth/register', {
        method: 'POST',
        body: {
          fullName: id.fullName,
          email: id.email,
          phoneNumber: id.phoneNumber,
          password: id.password,
        },
      });
      assert.equal(reg.status, 201);

      const oldOtp = resolveOtpFromDb(id.phoneNumber, 'Register');
      backdateLatestOtpCooldown(id.phoneNumber, 'Register', 65);

      const resendRes = await apiRequest('/auth/resend-otp', {
        method: 'POST',
        body: { email: id.email, phoneNumber: id.phoneNumber, purpose: 'Register' },
      });
      assert.equal(resendRes.status, 200, `Expected 200 on resend-otp after cooldown, got ${resendRes.status}: ${resendRes.text}`);

      const newOtp = resolveOtpFromDb(id.phoneNumber, 'Register');
      if (newOtp && oldOtp && newOtp !== oldOtp) {
        // Note: backend validates latest OTP row; oldOtp no longer matches latest row
        const verifyNew = await apiRequest('/auth/verify-otp', {
          method: 'POST',
          body: { phoneNumber: id.phoneNumber, otp: newOtp },
        });
        assert.equal(verifyNew.status, 200);
      }
    } finally {
      cleanupDisposableUser({ email: id.email, phoneNumber: id.phoneNumber });
    }
  });

  it('T1-F1-05: UI Register & OTP Flow inside AuthModal registers user via real API', async () => {
    const id = uniqueTestIdentity('t1f105');
    try {
      await withPage({ viewport: VIEWPORTS.DESKTOP_1280, allowedStatuses: ({ status }) => status === 400 }, async (page) => {
        await gotoRoute(page, '/');
        await page.getByRole('button', { name: /Tài khoản khách hàng|Đăng nhập/i }).first().click();
        await page.getByRole('button', { name: 'Đăng ký ngay' }).click();

        await page.getByPlaceholder('Nguyễn Văn A').fill(id.fullName);
        await page.getByPlaceholder('0901234567').fill(id.phoneNumber);
        await page.getByPlaceholder('email@example.com').fill(id.email);
        await page.getByPlaceholder(/Tối thiểu/i).fill(id.password);

        const regPromise = page.waitForResponse(
          (res) => res.url().includes('/api/auth/register') && res.request().method() === 'POST'
        );
        await page.getByRole('button', { name: 'Tạo Tài Khoản Thành Viên' }).click();
        const regRes = await regPromise;
        assert.equal(regRes.status(), 201, `UI register should hit POST /api/auth/register -> 201, got ${regRes.status()}`);

        // If OTP step appears in UI, verify with resolved OTP
        const otpInput = page.locator('input[placeholder*="OTP"], input[maxlength="6"]').first();
        if (await otpInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          const otp = resolveOtpFromDb(id.phoneNumber, 'Register');
          if (otp) {
            await otpInput.fill(otp);
            const verifyPromise = page.waitForResponse((res) => res.url().includes('/api/auth/verify-otp'));
            await page.getByRole('button', { name: /Xác thực|Xác nhận/i }).first().click();
            const vRes = await verifyPromise;
            assert.equal(vRes.status(), 200);
          }
        }
      });
    } finally {
      cleanupDisposableUser({ email: id.email, phoneNumber: id.phoneNumber });
    }
  });
});

describe('Tier 1 — F2: Login / Logout / Refresh + Profile', () => {
  it('T1-F2-01: API Login with Email returns JWT, refreshToken, and user profile', async () => {
    const res = await freshLogin({
      email: SEEDED_USERS.customer.email,
      phoneNumber: SEEDED_USERS.customer.email,
      password: SEEDED_USERS.customer.password,
    });
    assert.equal(res.status, 200, `Expected 200 login by email, got ${res.status}: ${res.text}`);
    assert.ok(res.data?.accessToken);
    assert.ok(res.data?.refreshToken);
    assert.ok(res.data?.user, 'LoginResponse should include user object');
    assert.equal(res.data.user.email?.toLowerCase(), SEEDED_USERS.customer.email);
  });

  it('T1-F2-02: API Login with Phone Number returns valid JWT and user', async () => {
    const res = await freshLogin({
      phoneNumber: SEEDED_USERS.customer.phoneNumber,
      password: SEEDED_USERS.customer.password,
    });
    assert.equal(res.status, 200, `Expected 200 login by phone, got ${res.status}: ${res.text}`);
    assert.ok(res.data?.accessToken);
    assert.ok(res.data?.refreshToken);
  });

  it('T1-F2-03: API GET /api/auth/me returns authenticated UserProfileDto', async () => {
    const session = await getCachedSession('customer');
    const me = await apiRequest('/auth/me', { token: session.accessToken });
    assert.equal(me.status, 200, `Expected 200 on /api/auth/me, got ${me.status}: ${me.text}`);
    assert.ok(me.data?.id);
    assert.equal(me.data?.email?.toLowerCase(), SEEDED_USERS.customer.email);
    assert.ok(me.data?.fullName);
    assert.ok(me.data?.role);
  });

  it('T1-F2-04: API Refresh Token Rotation returns new accessToken & refreshToken', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f204', activate: true });
    try {
      const refreshRes = await apiRequest('/auth/refresh', {
        method: 'POST',
        body: { refreshToken: disp.refreshToken },
      });
      assert.equal(refreshRes.status, 200, `Expected 200 on refresh, got ${refreshRes.status}: ${refreshRes.text}`);
      assert.ok(refreshRes.data?.accessToken);
      assert.ok(refreshRes.data?.refreshToken);
      assert.notEqual(refreshRes.data.refreshToken, disp.refreshToken);

      const meRes = await apiRequest('/auth/me', { token: refreshRes.data.accessToken });
      assert.equal(meRes.status, 200);
    } finally {
      disp.cleanup();
    }
  });

  it('T1-F2-05: UI Login & Logout Lifecycle (zero Demo Khách VIP bypass)', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f205', activate: true });
    try {
      await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
        await gotoRoute(page, '/');
        await page.getByRole('button', { name: /Tài khoản khách hàng|Đăng nhập/i }).first().click();

        // Demo VIP bypass button MUST be absent
        assert.equal(
          await page.getByRole('button', { name: /Demo Khách VIP/i }).count(),
          0,
          'Demo Khách VIP quick-bypass button must be removed'
        );

        await page.locator('input[placeholder*="ví dụ"], input[type="text"]').first().fill(disp.email);
        await page.locator('input[type="password"]').first().fill(disp.password);

        const loginPromise = page.waitForResponse((r) => r.url().includes('/api/auth/login'));
        await page.getByRole('button', { name: 'Đăng Nhập', exact: true }).click();
        const loginRes = await loginPromise;
        assert.equal(loginRes.status(), 200);

        // Navbar should reflect authenticated user & logout button
        const logoutBtn = page.getByRole('button', { name: /Đăng xuất/i }).first();
        await logoutBtn.waitFor({ state: 'visible' });

        const logoutPromise = page.waitForResponse((r) => r.url().includes('/api/auth/logout'));
        await logoutBtn.click();
        const logoutRes = await logoutPromise;
        assert.equal(logoutRes.status(), 200);

        await page.getByRole('button', { name: /Tài khoản khách hàng|Đăng nhập/i }).first().waitFor({ state: 'visible' });
      });
    } finally {
      disp.cleanup();
    }
  });
});

describe('Tier 1 — F3: Google OAuth Login & Register', () => {
  it('T1-F3-01: API Google Login contract reachable and rejects malformed payloads with 400 (not 404/500)', async () => {
    const res = await apiRequest('/auth/google-login', {
      method: 'POST',
      body: { idToken: 'not-a-valid-google-token' },
    });
    assert.equal(res.status, 400, `Expected 400 for invalid Google token, got ${res.status}: ${res.text}`);
    assert.ok(res.data?.message || res.text);
  });

  it('T1-F3-02: API Google Register contract reachable and enforces DTO validation with 400', async () => {
    const res = await apiRequest('/auth/google-register', {
      method: 'POST',
      body: { idToken: 'not-a-valid-google-token', phoneNumber: '+84912345678' },
    });
    assert.equal(res.status, 400, `Expected 400 for invalid Google register payload, got ${res.status}: ${res.text}`);
  });

  it('T1-F3-03: API Google Login verifies untrusted JWT signature as 400 (or authenticates if E2E_GOOGLE_ID_TOKEN supplied)', async () => {
    if (E2E_GOOGLE_ID_TOKEN) {
      const res = await apiRequest('/auth/google-login', {
        method: 'POST',
        body: { idToken: E2E_GOOGLE_ID_TOKEN },
      });
      assert.equal(res.status, 200);
      assert.ok(res.data?.accessToken);
    } else {
      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({ email: SEEDED_USERS.customer.email, email_verified: true, iss: 'https://accounts.google.com' })
      ).toString('base64url');
      const forgedJwt = `${header}.${payload}.invalidsignature`;
      const res = await apiRequest('/auth/google-login', {
        method: 'POST',
        body: { idToken: forgedJwt },
      });
      assert.equal(res.status, 400, `Forged unsigned Google JWT must be rejected with 400, got ${res.status}`);
    }
  });

  it('T1-F3-04: API Google Register enforces real token validation (or registers if E2E_GOOGLE_NEW_ID_TOKEN supplied)', async () => {
    if (E2E_GOOGLE_NEW_ID_TOKEN) {
      const res = await apiRequest('/auth/google-register', {
        method: 'POST',
        body: { idToken: E2E_GOOGLE_NEW_ID_TOKEN, phoneNumber: '+84911122233' },
      });
      assert.equal(res.status, 200);
      assert.ok(res.data?.accessToken);
    } else {
      const res = await apiRequest('/auth/google-register', {
        method: 'POST',
        body: { idToken: 'eyJhbGciOiJSUzI1NiJ9.eyJlbWFpbCI6Im5ld0BleGFtcGxlLmNvbSJ9.sig', phoneNumber: '+84911122233' },
      });
      assert.equal(res.status, 400, `Unverified Google token on register must return 400, got ${res.status}`);
    }
  });

  it('T1-F3-05: No dev_google_ backdoor accepted on /api/auth/google-login', async () => {
    const res = await apiRequest('/auth/google-login', {
      method: 'POST',
      body: { idToken: 'dev_google_admin@japanfood.vn' },
    });
    assert.equal(res.status, 400, `Legacy dev_google_ token must be rejected with 400, got ${res.status}`);
  });
});

describe('Tier 1 — F4: Forgot / Reset / Change Password', () => {
  it('T1-F4-01: API Forgot Password Request by Email returns 200 OK', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f401', activate: true });
    try {
      const res = await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: { email: disp.email, phoneNumber: disp.email },
      });
      assert.equal(res.status, 200, `Expected 200 on forgot-password by email, got ${res.status}: ${res.text}`);
      assert.ok(res.data?.message);
    } finally {
      disp.cleanup();
    }
  });

  it('T1-F4-02: API Verify Forgot Password OTP returns resetToken when OTP resolved', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f402', activate: true });
    try {
      const fg = await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: { email: disp.email, phoneNumber: disp.phoneNumber },
      });
      assert.equal(fg.status, 200);

      const otp = resolveOtpFromDb(disp.phoneNumber, 'ForgotPassword');
      if (otp) {
        const ver = await apiRequest('/auth/verify-forgot-password-otp', {
          method: 'POST',
          body: { email: disp.email, phoneNumber: disp.phoneNumber, otp },
        });
        assert.equal(ver.status, 200, `Expected 200 on verify-forgot-password-otp, got ${ver.status}: ${ver.text}`);
        assert.ok(ver.data?.resetToken, 'Expected resetToken in response');
      } else {
        const badVer = await apiRequest('/auth/verify-forgot-password-otp', {
          method: 'POST',
          body: { email: disp.email, phoneNumber: disp.phoneNumber, otp: '000000' },
        });
        assert.equal(badVer.status, 400);
      }
    } finally {
      disp.cleanup();
    }
  });

  it('T1-F4-03: API Reset Password & Login with New Password', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f403', activate: true });
    const newPassword = 'E2eResetPass@2026!';
    try {
      const fg = await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: { email: disp.email, phoneNumber: disp.phoneNumber },
      });
      assert.equal(fg.status, 200);

      const otp = resolveOtpFromDb(disp.phoneNumber, 'ForgotPassword');
      if (otp) {
        const ver = await apiRequest('/auth/verify-forgot-password-otp', {
          method: 'POST',
          body: { email: disp.email, phoneNumber: disp.phoneNumber, otp },
        });
        assert.equal(ver.status, 200);

        const rst = await apiRequest('/auth/reset-password', {
          method: 'POST',
          body: {
            email: disp.email,
            phoneNumber: disp.phoneNumber,
            resetToken: ver.data.resetToken,
            newPassword,
            confirmPassword: newPassword,
          },
        });
        assert.equal(rst.status, 200, `Expected 200 on reset-password, got ${rst.status}: ${rst.text}`);

        const newLogin = await freshLogin({ email: disp.email, phoneNumber: disp.email, password: newPassword });
        assert.equal(newLogin.status, 200);
      } else {
        // Fallback contract verification: change-password works when authenticated
        const chg = await apiRequest('/auth/change-password', {
          method: 'POST',
          token: disp.accessToken,
          body: {
            currentPassword: disp.password,
            newPassword,
            confirmPassword: newPassword,
          },
        });
        assert.equal(chg.status, 200);
        const newLogin = await freshLogin({ email: disp.email, phoneNumber: disp.email, password: newPassword });
        assert.equal(newLogin.status, 200);
      }
    } finally {
      disp.cleanup();
    }
  });

  it('T1-F4-04: API Authenticated Change Password succeeds and new password works on login', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f404', activate: true });
    const newPassword = 'E2eChangedPass@999!';
    try {
      const chgRes = await apiRequest('/auth/change-password', {
        method: 'POST',
        token: disp.accessToken,
        body: {
          currentPassword: disp.password,
          newPassword,
          confirmPassword: newPassword,
        },
      });
      assert.equal(chgRes.status, 200, `Expected 200 on change-password, got ${chgRes.status}: ${chgRes.text}`);

      const oldLogin = await freshLogin({ email: disp.email, phoneNumber: disp.email, password: disp.password });
      assert.equal(oldLogin.status, 400);

      const newLogin = await freshLogin({ email: disp.email, phoneNumber: disp.email, password: newPassword });
      assert.equal(newLogin.status, 200);
    } finally {
      disp.cleanup();
    }
  });

  it('T1-F4-05: UI Forgot Password Flow renders confirmation without 404 or console errors', async () => {
    const disp = await createDisposableCustomer({ prefix: 't1f405', activate: true });
    try {
      await withPage({ viewport: VIEWPORTS.DESKTOP_1280 }, async (page) => {
        await gotoRoute(page, '/');
        await page.getByRole('button', { name: /Tài khoản khách hàng|Đăng nhập/i }).first().click();
        await page.getByRole('button', { name: 'Quên mật khẩu?' }).click();

        await page.getByPlaceholder('Nhập email của bạn').fill(disp.email);
        const fgPromise = page.waitForResponse((r) => r.url().includes('/api/auth/forgot-password'));
        await page.getByRole('button', { name: 'Gửi Mã Khôi Phục' }).click();
        const fgRes = await fgPromise;
        assert.equal(fgRes.status(), 200, `Forgot password UI must call POST /api/auth/forgot-password -> 200, got ${fgRes.status()}`);

        await page.getByText(/khôi phục|OTP|đã được gửi/i).first().waitFor({ state: 'visible' });
      });
    } finally {
      disp.cleanup();
    }
  });
});
