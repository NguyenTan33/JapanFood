/**
 * State Storage & Session Simulation
 * In-memory mock implementing Storage interface with JSON helpers and R2/R4-aligned token keys.
 */

export const AUTH_STORAGE_KEYS = {
  ACCESS_TOKEN: 'torisakura_access_token',
  REFRESH_TOKEN: 'torisakura_refresh_token',
};

export class MockStorage {
  constructor() {
    this.store = new Map();
  }

  get length() {
    return this.store.size;
  }

  key(index) {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    this.store.set(String(key), String(value));
  }

  removeItem(key) {
    this.store.delete(String(key));
  }

  clear() {
    this.store.clear();
  }

  getJSON(key) {
    const val = this.getItem(key);
    if (!val) return null;
    try {
      return JSON.parse(val);
    } catch {
      return null;
    }
  }

  setJSON(key, obj) {
    this.setItem(key, JSON.stringify(obj));
  }
}

export function setAuthTokens(storage, { accessToken, refreshToken }) {
  if (accessToken) {
    storage.setItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN, accessToken);
  }
  if (refreshToken) {
    storage.setItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
  }
}

export function getAuthTokens(storage) {
  return {
    accessToken: storage.getItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN),
    refreshToken: storage.getItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN),
  };
}

export function clearAuthTokens(storage) {
  storage.removeItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN);
  storage.removeItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN);
}

export const mockStorage = new MockStorage();
