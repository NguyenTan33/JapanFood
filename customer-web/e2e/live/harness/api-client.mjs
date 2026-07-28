import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import {
  E2E_API_ORIGIN,
  E2E_API_URL,
  E2E_OTP_CODE,
  E2E_OTP_SECRET,
  E2E_SESSION_CACHE_FILE,
  E2E_SQL_DB,
  E2E_SQL_SERVER,
  SEEDED_USERS,
} from './env.mjs';

const memorySessions = new Map();
let catalogCache = null;

function readSessionFile() {
  try {
    if (!fs.existsSync(E2E_SESSION_CACHE_FILE)) return {};
    const raw = fs.readFileSync(E2E_SESSION_CACHE_FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

function writeSessionFile(all) {
  try {
    fs.writeFileSync(E2E_SESSION_CACHE_FILE, JSON.stringify(all, null, 2), 'utf8');
  } catch {
    // Non-fatal if temp cache cannot be persisted
  }
}

export function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    return JSON.parse(Buffer.from(b64 + pad, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

export function extractUserIdFromToken(token) {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  const raw =
    payload.nameid ||
    payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ||
    payload.sub ||
    payload.customerId;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function originRequest(pathAndQuery, options = {}) {
  const {
    method = 'GET',
    headers = {},
    body,
    token,
    rawBody,
  } = options;

  const url = pathAndQuery.startsWith('http')
    ? pathAndQuery
    : `${E2E_API_ORIGIN}${pathAndQuery.startsWith('/') ? '' : '/'}${pathAndQuery}`;

  const reqHeaders = { ...headers };
  if (token) {
    reqHeaders.Authorization = `Bearer ${token}`;
  }

  let finalBody = rawBody;
  if (finalBody === undefined && body !== undefined) {
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      finalBody = body;
    } else if (typeof body === 'string') {
      finalBody = body;
      if (!reqHeaders['Content-Type'] && !reqHeaders['content-type']) {
        reqHeaders['Content-Type'] = 'application/json';
      }
    } else {
      finalBody = JSON.stringify(body);
      if (!reqHeaders['Content-Type'] && !reqHeaders['content-type']) {
        reqHeaders['Content-Type'] = 'application/json';
      }
    }
  }

  const res = await fetch(url, {
    method,
    headers: reqHeaders,
    body: finalBody,
  });

  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();
  let data = null;
  if (text && (contentType.includes('application/json') || text.trim().startsWith('{') || text.trim().startsWith('['))) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  return {
    status: res.status,
    ok: res.ok,
    headers: res.headers,
    data,
    text,
    url,
  };
}

export async function apiRequest(endpoint, options = {}) {
  const normalized = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const path = normalized.startsWith('/api/') ? normalized : `/api${normalized}`;
  return originRequest(path, options);
}

export async function freshLogin({ email, phoneNumber, password }) {
  const identifier = phoneNumber || email;
  const payload = {
    phoneNumber: identifier,
    ...(email ? { email } : {}),
    password,
  };
  const res = await apiRequest('/auth/login', {
    method: 'POST',
    body: payload,
  });
  return res;
}

export async function getCachedSession(roleKey = 'customer') {
  const creds = SEEDED_USERS[roleKey];
  assert.ok(creds, `Unknown seeded user role: ${roleKey}`);

  const cacheKey = `${E2E_API_URL}::${roleKey}`;
  let candidate = memorySessions.get(cacheKey);
  if (!candidate) {
    const fileCache = readSessionFile();
    candidate = fileCache[cacheKey] || null;
  }

  if (candidate?.accessToken) {
    const payload = decodeJwtPayload(candidate.accessToken);
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload?.exp && payload.exp > nowSec + 120) {
      if (!memorySessions.has(cacheKey)) {
        const meCheck = await apiRequest('/auth/me', { token: candidate.accessToken });
        if (meCheck.status === 200) {
          candidate.user = meCheck.data;
          candidate.userId = meCheck.data?.id ?? extractUserIdFromToken(candidate.accessToken);
          memorySessions.set(cacheKey, candidate);
          return candidate;
        }
      } else {
        return candidate;
      }
    }
  }

  const loginRes = await freshLogin({
    email: creds.email,
    phoneNumber: creds.email,
    password: creds.password,
  });
  assert.equal(
    loginRes.status,
    200,
    `Failed to log in seeded ${roleKey} (${creds.email}): status=${loginRes.status} body=${loginRes.text}`
  );

  const session = {
    email: creds.email,
    phoneNumber: creds.phoneNumber,
    password: creds.password,
    role: creds.role,
    accessToken: loginRes.data.accessToken,
    refreshToken: loginRes.data.refreshToken,
    expiresAt: loginRes.data.expiresAt,
    user: loginRes.data.user || null,
    userId: loginRes.data.user?.id ?? extractUserIdFromToken(loginRes.data.accessToken),
  };

  if (!session.user) {
    const meRes = await apiRequest('/auth/me', { token: session.accessToken });
    if (meRes.status === 200) {
      session.user = meRes.data;
      session.userId = meRes.data?.id ?? session.userId;
    }
  }

  memorySessions.set(cacheKey, session);
  const all = readSessionFile();
  all[cacheKey] = session;
  writeSessionFile(all);
  return session;
}

export function invalidateCachedSession(roleKey) {
  const cacheKey = `${E2E_API_URL}::${roleKey}`;
  memorySessions.delete(cacheKey);
  const all = readSessionFile();
  delete all[cacheKey];
  writeSessionFile(all);
}

export function sqlEscape(value) {
  return String(value).replace(/'/g, "''");
}

export function runSql(query) {
  const fullQuery = `SET NOCOUNT ON; ${query}`;
  const out = execFileSync(
    'sqlcmd',
    ['-S', E2E_SQL_SERVER, '-E', '-C', '-d', E2E_SQL_DB, '-h', '-1', '-W', '-s', '|', '-Q', fullQuery],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
  );
  return out.trim();
}

export function querySqlRows(query) {
  const out = runSql(query);
  if (!out) return [];
  return out
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split('|').map((col) => col.trim()));
}

export function normalizeVnPhone(phone) {
  const digits = String(phone).replace(/[^0-9+]/g, '');
  if (digits.startsWith('+84')) return digits;
  if (digits.startsWith('84')) return `+${digits}`;
  if (digits.startsWith('0')) return `+84${digits.slice(1)}`;
  return digits;
}

export function resolveOtpFromDb(phoneNumber, purpose = 'Register') {
  if (E2E_OTP_CODE) return E2E_OTP_CODE;

  const normalized = normalizeVnPhone(phoneNumber);
  const rows = querySqlRows(
    `SELECT TOP 1 OTP_HASH FROM dbo.OTP_VERIFICATIONS WHERE PHONE_NUMBER = N'${sqlEscape(normalized)}' AND PURPOSE = N'${sqlEscape(purpose)}' AND IS_USED = 0 ORDER BY CREATED_AT DESC;`
  );
  if (!rows.length || !rows[0][0]) return null;
  const targetHash = rows[0][0].toUpperCase();

  const key = Buffer.from(E2E_OTP_SECRET, 'utf8');
  for (let code = 100000; code <= 999999; code++) {
    const candidate = String(code);
    const digest = crypto.createHmac('sha256', key).update(candidate).digest('hex').toUpperCase();
    if (digest === targetHash) {
      return candidate;
    }
  }
  return null;
}

export function backdateLatestOtpCooldown(phoneNumber, purpose = 'Register', secondsAgo = 65) {
  const normalized = normalizeVnPhone(phoneNumber);
  runSql(
    `UPDATE TOP (1) dbo.OTP_VERIFICATIONS SET CREATED_AT = DATEADD(SECOND, -${Math.abs(Math.floor(secondsAgo))}, CREATED_AT) WHERE PHONE_NUMBER = N'${sqlEscape(normalized)}' AND PURPOSE = N'${sqlEscape(purpose)}';`
  );
}

export function activateUserByEmailOrPhone(email, phoneNumber) {
  const normalizedPhone = phoneNumber ? normalizeVnPhone(phoneNumber) : '';
  const whereParts = [];
  if (email) whereParts.push(`LOWER(EMAIL) = LOWER(N'${sqlEscape(email)}')`);
  if (normalizedPhone) whereParts.push(`PHONE_NUMBER = N'${sqlEscape(normalizedPhone)}'`);
  if (!whereParts.length) return;
  runSql(`UPDATE dbo.USERS SET ACCOUNT_STATUS = 'ACTIVE' WHERE ${whereParts.join(' OR ')};`);
}

export function cleanupDisposableUser({ email, phoneNumber, userId } = {}) {
  const normalizedPhone = phoneNumber ? normalizeVnPhone(phoneNumber) : '';
  let resolvedId = userId ? Number(userId) : null;

  if (!resolvedId && (email || normalizedPhone)) {
    const conds = [];
    if (email) conds.push(`LOWER(EMAIL) = LOWER(N'${sqlEscape(email)}')`);
    if (normalizedPhone) conds.push(`PHONE_NUMBER = N'${sqlEscape(normalizedPhone)}'`);
    const rows = querySqlRows(`SELECT USER_ID FROM dbo.USERS WHERE ${conds.join(' OR ')};`);
    if (rows.length && rows[0][0]) {
      resolvedId = Number(rows[0][0]);
    }
  }

  if (resolvedId && Number.isFinite(resolvedId)) {
    runSql(`
      DELETE FROM dbo.CART_ITEM_MODIFIERS WHERE CART_ITEM_ID IN (SELECT CART_ITEM_ID FROM dbo.CART_ITEMS WHERE USER_ID = ${resolvedId});
      DELETE FROM dbo.CART_ITEMS WHERE USER_ID = ${resolvedId};
      DELETE FROM dbo.MENU_ITEM_REVIEWS WHERE USER_ID = ${resolvedId};
      DELETE FROM dbo.USER_VOUCHER_USAGES WHERE USER_ID = ${resolvedId};
      DELETE FROM dbo.PAYMENT_TRANSACTIONS WHERE ORDER_ID IN (SELECT ORDER_ID FROM dbo.ORDERS WHERE USER_ID = ${resolvedId});
      DELETE FROM dbo.ORDER_ITEM_MODIFIERS WHERE ORDER_ITEM_ID IN (SELECT ORDER_ITEM_ID FROM dbo.ORDER_ITEMS WHERE ORDER_ID IN (SELECT ORDER_ID FROM dbo.ORDERS WHERE USER_ID = ${resolvedId}));
      DELETE FROM dbo.KITCHEN_TICKET_ITEMS WHERE TICKET_ID IN (SELECT TICKET_ID FROM dbo.KITCHEN_TICKETS WHERE ORDER_ID IN (SELECT ORDER_ID FROM dbo.ORDERS WHERE USER_ID = ${resolvedId}));
      DELETE FROM dbo.KITCHEN_TICKETS WHERE ORDER_ID IN (SELECT ORDER_ID FROM dbo.ORDERS WHERE USER_ID = ${resolvedId});
      DELETE FROM dbo.ORDER_ITEMS WHERE ORDER_ID IN (SELECT ORDER_ID FROM dbo.ORDERS WHERE USER_ID = ${resolvedId});
      DELETE FROM dbo.ORDERS WHERE USER_ID = ${resolvedId};
      DELETE FROM dbo.RESERVATIONS WHERE USER_ID = ${resolvedId};
      DELETE FROM dbo.REFRESH_TOKENS WHERE ACCOUNT_ID = '${resolvedId}';
      DELETE FROM dbo.USER_ADDRESSES WHERE USER_ID = ${resolvedId};
      DELETE FROM dbo.USERS WHERE USER_ID = ${resolvedId};
    `);
  }

  if (normalizedPhone) {
    runSql(`DELETE FROM dbo.OTP_VERIFICATIONS WHERE PHONE_NUMBER = N'${sqlEscape(normalizedPhone)}';`);
  }
}

export function uniqueTestIdentity(prefix = 'e2e') {
  const rand = Math.floor(100000 + Math.random() * 900000);
  const ts = String(Date.now()).slice(-6);
  const tail = `${ts.slice(-4)}${String(rand).slice(-3)}`.slice(0, 7);
  return {
    fullName: `E2E ${prefix} User ${rand}`,
    email: `e2e.${prefix}.${Date.now()}.${rand}@example.com`.toLowerCase(),
    phoneNumber: `+849${tail.padStart(8, '1')}`,
    password: 'E2eUser@123456',
  };
}

export async function createDisposableCustomer({ prefix = 'disp', activate = true } = {}) {
  const identity = uniqueTestIdentity(prefix);
  const regRes = await apiRequest('/auth/register', {
    method: 'POST',
    body: {
      fullName: identity.fullName,
      email: identity.email,
      phoneNumber: identity.phoneNumber,
      password: identity.password,
    },
  });
  assert.equal(
    regRes.status,
    201,
    `Failed to register disposable user: status=${regRes.status} body=${regRes.text}`
  );
  const userId = Number(regRes.data?.userId);

  let accessToken = null;
  let refreshToken = null;
  let user = null;

  if (activate) {
    activateUserByEmailOrPhone(identity.email, identity.phoneNumber);
    const loginRes = await freshLogin({
      email: identity.email,
      phoneNumber: identity.email,
      password: identity.password,
    });
    assert.equal(
      loginRes.status,
      200,
      `Failed to log in activated disposable user: status=${loginRes.status} body=${loginRes.text}`
    );
    accessToken = loginRes.data.accessToken;
    refreshToken = loginRes.data.refreshToken;
    user = loginRes.data.user || null;
  }

  return {
    ...identity,
    userId,
    accessToken,
    refreshToken,
    user,
    cleanup: () => cleanupDisposableUser({ email: identity.email, phoneNumber: identity.phoneNumber, userId }),
  };
}

export async function clearCart(token) {
  if (!token) return;
  await apiRequest('/cart', { method: 'DELETE', token });
}

export async function cancelOrder(token, orderId, reason = 'E2E cleanup') {
  if (!token || !orderId) return;
  await apiRequest(`/orders/${orderId}/cancel`, {
    method: 'POST',
    token,
    body: { reason },
  });
}

export async function cancelReservation(token, reservationId, reason = 'E2E cleanup') {
  if (!token || !reservationId) return;
  await apiRequest(`/reservations/${reservationId}/cancel`, {
    method: 'POST',
    token,
    body: { reason },
  });
}

export async function getCatalogSnapshot(forceRefresh = false) {
  if (catalogCache && !forceRefresh) return catalogCache;
  const [catRes, dishesRes] = await Promise.all([
    apiRequest('/menu/categories'),
    apiRequest('/menu/dishes?page=1&pageSize=50'),
  ]);
  assert.equal(catRes.status, 200, `Expected 200 on /menu/categories, got ${catRes.status}`);
  assert.equal(dishesRes.status, 200, `Expected 200 on /menu/dishes, got ${dishesRes.status}`);
  const categories = Array.isArray(catRes.data) ? catRes.data : [];
  const dishes = Array.isArray(dishesRes.data?.items) ? dishesRes.data.items : [];
  catalogCache = {
    categories,
    dishes,
    totalCount: dishesRes.data?.totalCount ?? dishes.length,
    byCode: new Map(dishes.map((d) => [d.code, d])),
  };
  return catalogCache;
}

export async function getDishDetail(code) {
  const res = await apiRequest(`/menu/dishes/${encodeURIComponent(code)}`);
  assert.equal(res.status, 200, `Expected 200 on /menu/dishes/${code}, got ${res.status}`);
  return res.data;
}

export function futureReservationSlot(daysAhead = 3, hour = 19, minute = 0) {
  const d = new Date(Date.now() + daysAhead * 86400_000);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  const min = String(minute).padStart(2, '0');
  return {
    dateStr: `${yyyy}-${mm}-${dd}`,
    timeStr: `${hh}:${min}`,
    isoUtc: `${yyyy}-${mm}-${dd}T${hh}:${min}:00Z`,
  };
}

export function createMinimalPngBuffer() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
}
