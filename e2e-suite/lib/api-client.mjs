import { API_ORIGIN, API_URL, TIMEOUTS, USERS } from './config.mjs';
import { assertStatus } from './assertions.mjs';

const sessionCache = new Map();

export function normalizeApiPath(endpoint) {
  const raw = String(endpoint || '');
  if (/^https?:\/\//i.test(raw)) return raw;
  let clean = raw.replace(/^\/+/, '');
  if (API_URL.endsWith('/api') && clean.toLowerCase().startsWith('api/')) {
    clean = clean.slice(4);
  } else if (API_URL.endsWith('/api') && clean.toLowerCase() === 'api') {
    clean = '';
  }
  return clean ? `${API_URL}/${clean}` : API_URL;
}

export function normalizeOriginPath(endpoint) {
  const raw = String(endpoint || '');
  if (/^https?:\/\//i.test(raw)) return raw;
  const clean = raw.replace(/^\/+/, '');
  return clean ? `${API_ORIGIN}/${clean}` : API_ORIGIN;
}

export function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const json = Buffer.from(b64 + pad, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function isTokenFresh(token, minRemainingMs = 90_000) {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return false;
  return payload.exp * 1000 > Date.now() + minRemainingMs;
}

export function extractError(res) {
  if (!res) return { code: 'NO_RESPONSE', message: 'No response received', statusCode: 0 };
  const d = res.data;
  if (d && typeof d === 'object') {
    let validationMsg = '';
    if (d.errors && typeof d.errors === 'object') {
      const firstKey = Object.keys(d.errors)[0];
      if (firstKey) {
        const val = d.errors[firstKey];
        validationMsg = Array.isArray(val) ? String(val[0] || '') : String(val || '');
      }
    }
    return {
      statusCode: d.statusCode ?? d.status ?? res.status,
      code: d.code || (res.status === 400 ? 'BAD_REQUEST' : `HTTP_${res.status}`),
      message: d.message || validationMsg || d.title || res.text || `HTTP ${res.status}`,
      errors: d.errors || null,
    };
  }
  return {
    statusCode: res.status,
    code: `HTTP_${res.status}`,
    message: res.text || `HTTP ${res.status}`,
    errors: null,
  };
}

export function expectStatus(res, expectedStatus, contextMsg = '') {
  return assertStatus(res, expectedStatus, contextMsg);
}

async function rawFetch(url, options = {}) {
  const {
    method = 'GET',
    headers = {},
    body,
    token,
    timeoutMs = TIMEOUTS.apiMs,
    retryOn429 = false,
  } = options;

  const finalHeaders = new Headers(headers);
  if (token && !finalHeaders.has('Authorization')) {
    finalHeaders.set('Authorization', `Bearer ${token}`);
  }

  let finalBody = body;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (isFormData) {
    // Let fetch compute multipart boundary automatically
    finalHeaders.delete('Content-Type');
  } else if (
    body !== undefined &&
    body !== null &&
    typeof body === 'object' &&
    !(body instanceof Uint8Array) &&
    !(body instanceof ArrayBuffer) &&
    !(typeof Blob !== 'undefined' && body instanceof Blob)
  ) {
    finalBody = JSON.stringify(body);
    if (!finalHeaders.has('Content-Type')) {
      finalHeaders.set('Content-Type', 'application/json');
    }
  }

  const doOnce = async () => {
    const response = await fetch(url, {
      method,
      headers: finalHeaders,
      body: method === 'GET' || method === 'HEAD' ? undefined : finalBody,
      signal: AbortSignal.timeout(timeoutMs),
    });

    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }

    const resObj = {
      status: response.status,
      ok: response.ok,
      headers: response.headers,
      data,
      text,
      url: response.url || url,
      method,
    };
    resObj.error = response.ok ? null : extractError(resObj);
    return resObj;
  };

  let res = await doOnce();
  if (res.status === 429 && retryOn429) {
    const rawRetryAfter = res.headers.get('Retry-After');
    let retryAfterSec = rawRetryAfter !== null && rawRetryAfter !== '' ? Number(rawRetryAfter) : 1;
    if (!Number.isFinite(retryAfterSec)) {
      const parsedDateMs = rawRetryAfter ? Date.parse(rawRetryAfter) : NaN;
      retryAfterSec = Number.isFinite(parsedDateMs)
        ? Math.ceil((parsedDateMs - Date.now()) / 1000)
        : 1;
    }
    const waitMs = Math.min(Math.max(retryAfterSec, 1), 3) * 1000;
    await new Promise((r) => setTimeout(r, waitMs));
    res = await doOnce();
  }
  return res;
}

export async function request(endpoint, options = {}) {
  return rawFetch(normalizeApiPath(endpoint), options);
}

export async function originRequest(endpoint, options = {}) {
  return rawFetch(normalizeOriginPath(endpoint), options);
}

export function get(endpoint, options = {}) {
  return request(endpoint, { ...options, method: 'GET' });
}

export function post(endpoint, body, options = {}) {
  return request(endpoint, { ...options, method: 'POST', body });
}

export function put(endpoint, body, options = {}) {
  return request(endpoint, { ...options, method: 'PUT', body });
}

export function patch(endpoint, body, options = {}) {
  return request(endpoint, { ...options, method: 'PATCH', body });
}

export function del(endpoint, body, options = {}) {
  return request(endpoint, { ...options, method: 'DELETE', body });
}

export function postMultipart(endpoint, formData, options = {}) {
  return request(endpoint, { ...options, method: 'POST', body: formData });
}

export async function freshLogin({ email, phoneNumber, password } = {}) {
  const payload = { password };
  if (email) payload.email = email;
  if (phoneNumber) payload.phoneNumber = phoneNumber;

  const res = await post('/auth/login', payload);
  return {
    res,
    accessToken: res.data?.accessToken || null,
    refreshToken: res.data?.refreshToken || null,
    expiresAt: res.data?.expiresAt || null,
    expiresInMinutes: res.data?.expiresInMinutes ?? null,
    user: res.data?.user || null,
  };
}

export async function refresh(refreshToken) {
  const res = await post('/auth/refresh', { refreshToken });
  return {
    res,
    accessToken: res.data?.accessToken || null,
    refreshToken: res.data?.refreshToken || null,
    expiresAt: res.data?.expiresAt || null,
    expiresInMinutes: res.data?.expiresInMinutes ?? null,
  };
}

export async function logout(refreshToken) {
  return post('/auth/logout', { refreshToken });
}

function resolveRoleCredentials(roleOrCreds) {
  if (typeof roleOrCreds === 'string') {
    const key = roleOrCreds.toUpperCase();
    const creds = USERS[key];
    if (!creds) {
      throw new Error(`Unknown role '${roleOrCreds}'. Expected one of: ${Object.keys(USERS).join(', ')}`);
    }
    return { cacheKey: `${API_URL}::${key}`, role: key, creds };
  }
  if (roleOrCreds && typeof roleOrCreds === 'object') {
    return { cacheKey: null, role: roleOrCreds.role || 'CUSTOM', creds: roleOrCreds };
  }
  return { cacheKey: `${API_URL}::ADMIN`, role: 'ADMIN', creds: USERS.ADMIN };
}

export async function getSession(roleOrCreds = 'ADMIN') {
  const { cacheKey, role, creds } = resolveRoleCredentials(roleOrCreds);
  if (cacheKey) {
    const cached = sessionCache.get(cacheKey);
    if (cached && isTokenFresh(cached.accessToken)) {
      return cached;
    }
  }

  const loginRes = await freshLogin({
    email: creds.email,
    phoneNumber: creds.phoneNumber,
    password: creds.password,
  });
  expectStatus(loginRes.res, 200, `Login as ${role} (${creds.email || creds.phoneNumber})`);

  const session = {
    role,
    accessToken: loginRes.accessToken,
    refreshToken: loginRes.refreshToken,
    expiresAt: loginRes.expiresAt,
    user: loginRes.user,
  };

  if (cacheKey) {
    sessionCache.set(cacheKey, session);
  }
  return session;
}

export const login = getSession;

export function withToken(token, user = null) {
  const withAuth = (opts = {}) => ({ ...opts, token });
  return {
    token,
    user,
    request: (endpoint, opts = {}) => request(endpoint, withAuth(opts)),
    originRequest: (endpoint, opts = {}) => originRequest(endpoint, withAuth(opts)),
    get: (endpoint, opts = {}) => get(endpoint, withAuth(opts)),
    post: (endpoint, body, opts = {}) => post(endpoint, body, withAuth(opts)),
    put: (endpoint, body, opts = {}) => put(endpoint, body, withAuth(opts)),
    patch: (endpoint, body, opts = {}) => patch(endpoint, body, withAuth(opts)),
    del: (endpoint, body, opts = {}) => del(endpoint, body, withAuth(opts)),
    postMultipart: (endpoint, formData, opts = {}) => postMultipart(endpoint, formData, withAuth(opts)),
  };
}

export async function asRole(role = 'ADMIN') {
  const session = await getSession(role);
  return {
    ...withToken(session.accessToken, session.user),
    role: session.role,
    refreshToken: session.refreshToken,
    session,
  };
}

export function invalidateSession(role) {
  if (!role) return;
  const key = `${API_URL}::${String(role).toUpperCase()}`;
  sessionCache.delete(key);
}

export function clearAllSessions() {
  sessionCache.clear();
}

export const apiClient = {
  normalizeApiPath,
  normalizeOriginPath,
  decodeJwtPayload,
  isTokenFresh,
  extractError,
  expectStatus,
  request,
  originRequest,
  get,
  post,
  put,
  patch,
  del,
  postMultipart,
  login,
  getSession,
  freshLogin,
  refresh,
  logout,
  asRole,
  withToken,
  invalidateSession,
  clearAllSessions,
};

export default apiClient;
