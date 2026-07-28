import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { E2E_GOOGLE_ID_TOKEN, SEEDED_USERS, VIEWPORTS } from '../harness/env.mjs';
import {
  apiRequest,
  cleanupDisposableUser,
  createDisposableCustomer,
  freshLogin,
  resolveOtpFromDb,
  uniqueTestIdentity,
} from '../harness/api-client.mjs';
import { closeBrowser, gotoRoute, withPage } from '../harness/browser.mjs';

after(async () => {
  await closeBrowser();
});

function createSignedExpiredJwt(userId = 4, email = SEEDED_USERS.customer.email) {
  const key =
    process.env.E2E_JWT_KEY ||
    'JapanFood_Super_Secret_Key_For_Jwt_Authentication_Must_Be_Long_Enough_2026!';
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: String(userId),
      nameid: String(userId),
      email,
      role: 'CUSTOMER',
      iss: 'JapanFoodAPI',
      aud: 'JapanFoodClient',
      iat: now - 3600,
      exp: now - 60,
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', key).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

describe('Tier 2 — F1 Boundaries: Register + OTP', () => {
  it('T2-F1-01: Duplicate Email / Phone on Register returns 409 or 400 with error message', async () => {
    const resEmail = await apiRequest('/auth/register', {
      method: 'POST',
      body: {
        fullName: 'Duplicate Test',
        email: SEEDED_USERS.customer.email,
        phoneNumber: '+84911998877',
        password: 'Password@123456',
      },
    });
    assert.ok([400, 409].includes(resEmail.status), `Expected 400/409 for duplicate email, got ${resEmail.status}`);
    assert.ok(resEmail.data?.message);

    const resPhone = await apiRequest('/auth/register', {
      method: 'POST',
      body: {
        fullName: 'Duplicate Phone Test',
        email: `dup.phone.${Date.now()}@example.com`,
        phoneNumber: SEEDED_USERS.customer.phoneNumber,
        password: 'Password@123456',
      },
    });
    assert.ok([400, 409].includes(resPhone.status), `Expected 400/409 for duplicate phone, got ${resPhone.status}`);
  });

  it('T2-F1-02: Invalid Email / Weak Password / Bad Phone rejected with 400 Bad Request', async () => {
    const res = await apiRequest('/auth/register', {
      method: 'POST',
      body: {
        fullName: 'Bad Input',
        email: 'not-an-email',
        phoneNumber: 'abc',
        password: '123',
      },
    });
    assert.equal(res.status, 400);
  });

  it('T2-F1-03: Wrong OTP & 5-Attempt Lockout blocks verification even with real OTP afterward', async () => {
    const id = uniqueTestIdentity('t2f103');
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

      for (let i = 0; i < 5; i++) {
        const wrong = await apiRequest('/auth/verify-otp', {
          method: 'POST',
          body: { phoneNumber: id.phoneNumber, otp: '000000' },
        });
        assert.equal(wrong.status, 400, `Attempt ${i + 1} should return 400`);
      }

      const realOtp = resolveOtpFromDb(id.phoneNumber, 'Register');
      const lockedRes = await apiRequest('/auth/verify-otp', {
        method: 'POST',
        body: { phoneNumber: id.phoneNumber, otp: realOtp || '123456' },
      });
      assert.equal(lockedRes.status, 400, 'OTP must remain locked after 5 failed attempts');
      assert.match(String(lockedRes.data?.message || ''), /khóa|5 lần|tồn tại/i);
    } finally {
      cleanupDisposableUser({ email: id.email, phoneNumber: id.phoneNumber });
    }
  });

  it('T2-F1-04: Resend OTP Within 60s Cooldown returns 400 mentioning remaining cooldown', async () => {
    const id = uniqueTestIdentity('t2f104');
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

      const second = await apiRequest('/auth/resend-otp', {
        method: 'POST',
        body: { phoneNumber: id.phoneNumber, purpose: 'Register' },
      });
      assert.equal(second.status, 400, `Expected 400 within 60s cooldown, got ${second.status}: ${second.text}`);
      assert.match(String(second.data?.message || ''), /giây|đợi/i);
    } finally {
      cleanupDisposableUser({ email: id.email, phoneNumber: id.phoneNumber });
    }
  });

  it('T2-F1-05: Invalid OTP Purpose Rejection returns 400 Bad Request', async () => {
    const res = await apiRequest('/auth/resend-otp', {
      method: 'POST',
      body: { phoneNumber: SEEDED_USERS.customer.phoneNumber, purpose: 'AdminReset' },
    });
    assert.equal(res.status, 400);
  });
});

describe('Tier 2 — F2 Boundaries: Login / Refresh / JWT', () => {
  it('T2-F2-01: Wrong Password / Non-existent Account returns 400 and shows error in AuthModal UI', async () => {
    const apiRes = await freshLogin({
      email: SEEDED_USERS.customer.email,
      phoneNumber: SEEDED_USERS.customer.email,
      password: 'WrongPassword!999',
    });
    assert.ok([400, 401].includes(apiRes.status));
    assert.ok(!apiRes.data?.accessToken);

    await withPage(
      { viewport: VIEWPORTS.DESKTOP_1280, allowedStatuses: ({ status, url }) => status === 400 && url.includes('/api/auth/login') },
      async (page) => {
        await gotoRoute(page, '/');
        await page.getByRole('button', { name: /Tài khoản khách hàng|Đăng nhập/i }).first().click();
        await page.locator('input[type="text"]').first().fill(SEEDED_USERS.customer.email);
        await page.locator('input[type="password"]').first().fill('WrongPassword!999');
        await page.getByRole('button', { name: 'Đăng Nhập', exact: true }).click();
        await page.getByText(/không chính xác|lỗi|thất bại/i).first().waitFor({ state: 'visible' });
      }
    );
  });

  it('T2-F2-02: Unverified PENDING_VERIFY Account Login Blocked with 400 Bad Request', async () => {
    const id = uniqueTestIdentity('t2f202');
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

      const loginRes = await freshLogin({ email: id.email, phoneNumber: id.email, password: id.password });
      assert.equal(loginRes.status, 400);
      assert.match(String(loginRes.data?.message || ''), /kích hoạt|OTP/i);
    } finally {
      cleanupDisposableUser({ email: id.email, phoneNumber: id.phoneNumber });
    }
  });

  it('T2-F2-03: Unauthenticated /api/auth/me returns 401 UNAUTHORIZED envelope', async () => {
    const noToken = await apiRequest('/auth/me');
    assert.equal(noToken.status, 401);
    assert.equal(noToken.data?.statusCode, 401);
    assert.equal(noToken.data?.code, 'UNAUTHORIZED');

    const badToken = await apiRequest('/auth/me', { token: 'malformed.jwt.value' });
    assert.equal(badToken.status, 401);
  });

  it('T2-F2-04: Expired JWT Handling returns 401 and FE dispatches auth-unauthorized / clears session', async () => {
    const expiredJwt = createSignedExpiredJwt();
    const apiRes = await apiRequest('/auth/me', { token: expiredJwt });
    assert.equal(apiRes.status, 401);
    assert.ok(['TOKEN_EXPIRED', 'UNAUTHORIZED'].includes(apiRes.data?.code));

    await withPage(
      {
        viewport: VIEWPORTS.DESKTOP_1280,
        authSession: { accessToken: expiredJwt, refreshToken: 'invalid-refresh-token' },
        allowedStatuses: ({ status, url }) => (status === 401 || status === 400) && url.includes('/api/auth/'),
      },
      async (page) => {
        await gotoRoute(page, '/');
        // Session invalidation must revert UI to unauthenticated "Đăng nhập"
        await page.getByRole('button', { name: /Tài khoản khách hàng|Đăng nhập/i }).first().waitFor({ state: 'visible' });
      }
    );
  });

  it('T2-F2-05: Refresh Token Reuse Attack Detection revokes token family', async () => {
    const disp = await createDisposableCustomer({ prefix: 't2f205', activate: true });
    try {
      const r1 = disp.refreshToken;
      const rotate1 = await apiRequest('/auth/refresh', {
        method: 'POST',
        body: { refreshToken: r1 },
      });
      assert.equal(rotate1.status, 200);
      const r2 = rotate1.data.refreshToken;
      assert.ok(r2 && r2 !== r1);

      // Replay already-rotated R1
      const replayR1 = await apiRequest('/auth/refresh', {
        method: 'POST',
        body: { refreshToken: r1 },
      });
      assert.ok([400, 401, 403].includes(replayR1.status), `Replay of R1 must be rejected, got ${replayR1.status}`);

      // R2 from same token family must also be revoked
      const tryR2 = await apiRequest('/auth/refresh', {
        method: 'POST',
        body: { refreshToken: r2 },
      });
      assert.ok([400, 401, 403].includes(tryR2.status), `Token family R2 must be revoked after reuse attack, got ${tryR2.status}`);
    } finally {
      disp.cleanup();
    }
  });
});

describe('Tier 2 — F3 Boundaries: Google OAuth', () => {
  it('T2-F3-01: Empty / Forged Google ID Token rejected with 400', async () => {
    const res = await apiRequest('/auth/google-login', {
      method: 'POST',
      body: { idToken: 'invalid.jwt.token' },
    });
    assert.equal(res.status, 400);
  });

  it('T2-F3-02: Legacy dev_google_ Backdoor Blocked with 400', async () => {
    const res = await apiRequest('/auth/google-login', {
      method: 'POST',
      body: { idToken: 'dev_google_customer@japanfood.vn' },
    });
    assert.equal(res.status, 400);
  });

  it('T2-F3-03: Google Register Duplicate Email Conflict returns 409 (or 400 without live Google token)', async () => {
    const res = await apiRequest('/auth/google-register', {
      method: 'POST',
      body: {
        idToken: E2E_GOOGLE_ID_TOKEN || 'eyJhbGciOiJSUzI1NiJ9.eyJlbWFpbCI6ImN1c3RvbWVyQGphcGFuZm9vZC52biJ9.bad',
        phoneNumber: '+84901239999',
      },
    });
    if (E2E_GOOGLE_ID_TOKEN) {
      assert.equal(res.status, 409);
    } else {
      assert.ok([400, 409].includes(res.status));
    }
  });

  it('T2-F3-04: Missing idToken Payload on google-login returns 400', async () => {
    const res = await apiRequest('/auth/google-login', {
      method: 'POST',
      body: {},
    });
    assert.equal(res.status, 400);
  });

  it('T2-F3-05: Google Register Missing Phone Validation returns 400', async () => {
    const res = await apiRequest('/auth/google-register', {
      method: 'POST',
      body: { idToken: 'invalid.token', phoneNumber: '' },
    });
    assert.equal(res.status, 400);
  });
});

describe('Tier 2 — F4 Boundaries: Password Recovery & Change', () => {
  it('T2-F4-01: Forgot Password Non-Existent Account prevents user enumeration (no token issued)', async () => {
    const res = await apiRequest('/auth/forgot-password', {
      method: 'POST',
      body: { email: 'nobody-nonexistent-12345@example.com', phoneNumber: 'nobody-nonexistent-12345@example.com' },
    });
    assert.ok([200, 400].includes(res.status));
    assert.ok(!res.data?.resetToken);
    assert.ok(!res.data?.accessToken);
  });

  it('T2-F4-02: Forgot Password Cooldown Within 60s returns 400 on immediate repeat', async () => {
    const disp = await createDisposableCustomer({ prefix: 't2f402', activate: true });
    try {
      const first = await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: { email: disp.email, phoneNumber: disp.phoneNumber },
      });
      assert.equal(first.status, 200);

      const second = await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: { email: disp.email, phoneNumber: disp.phoneNumber },
      });
      assert.equal(second.status, 400, `Second forgot-password within 60s must return 400, got ${second.status}`);
    } finally {
      disp.cleanup();
    }
  });

  it('T2-F4-03: Invalid / Tampered Reset Token rejected with 400', async () => {
    const disp = await createDisposableCustomer({ prefix: 't2f403', activate: true });
    try {
      const res = await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: {
          email: disp.email,
          phoneNumber: disp.phoneNumber,
          resetToken: 'A'.repeat(64),
          newPassword: 'NewPassword@123456',
          confirmPassword: 'NewPassword@123456',
        },
      });
      assert.equal(res.status, 400);
    } finally {
      disp.cleanup();
    }
  });

  it('T2-F4-04: Change Password with wrong currentPassword or same password returns 400', async () => {
    const disp = await createDisposableCustomer({ prefix: 't2f404', activate: true });
    try {
      const wrongCurrent = await apiRequest('/auth/change-password', {
        method: 'POST',
        token: disp.accessToken,
        body: {
          currentPassword: 'WrongCurrent@123',
          newPassword: 'BrandNewPass@123',
          confirmPassword: 'BrandNewPass@123',
        },
      });
      assert.equal(wrongCurrent.status, 400);

      const samePass = await apiRequest('/auth/change-password', {
        method: 'POST',
        token: disp.accessToken,
        body: {
          currentPassword: disp.password,
          newPassword: disp.password,
          confirmPassword: disp.password,
        },
      });
      assert.equal(samePass.status, 400);
    } finally {
      disp.cleanup();
    }
  });

  it('T2-F4-05: Unauthenticated Change Password returns 401 Unauthorized', async () => {
    const res = await apiRequest('/auth/change-password', {
      method: 'POST',
      body: {
        currentPassword: 'Old@123456',
        newPassword: 'New@123456',
        confirmPassword: 'New@123456',
      },
    });
    assert.equal(res.status, 401);
  });
});
