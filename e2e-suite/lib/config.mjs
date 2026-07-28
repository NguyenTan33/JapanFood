import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUITE_ROOT = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(SUITE_ROOT, '..');

function stripTrailingSlash(url) {
  return String(url || '').replace(/\/+$/, '');
}

export const WEB_URL = stripTrailingSlash(
  process.env.E2E_WEB_URL || process.env.E2E_BASE_URL || 'http://localhost:5173',
);

export const API_URL = stripTrailingSlash(
  process.env.E2E_API_URL || 'http://localhost:5243/api',
);

export const API_ORIGIN = new URL(API_URL).origin;

export const USERS = Object.freeze({
  ADMIN: Object.freeze({
    email: process.env.E2E_ADMIN_EMAIL || 'admin@japanfood.vn',
    phoneNumber: '+84999999999',
    password: process.env.E2E_ADMIN_PASSWORD || process.env.SEED_ADMIN_PASSWORD || 'Admin@123456',
    role: 'ADMIN',
  }),
  MANAGER: Object.freeze({
    email: process.env.E2E_MANAGER_EMAIL || 'manager@japanfood.vn',
    phoneNumber: '+84988888888',
    password: process.env.E2E_MANAGER_PASSWORD || process.env.SEED_MANAGER_PASSWORD || 'Manager@123456',
    role: 'MANAGER',
  }),
  STAFF: Object.freeze({
    email: process.env.E2E_STAFF_EMAIL || 'staff@japanfood.vn',
    phoneNumber: '+84977777777',
    password: process.env.E2E_STAFF_PASSWORD || process.env.SEED_STAFF_PASSWORD || 'Staff@123456',
    role: 'STAFF',
  }),
  CUSTOMER: Object.freeze({
    email: process.env.E2E_CUSTOMER_EMAIL || 'customer@japanfood.vn',
    phoneNumber: '+84966666666',
    password: process.env.E2E_CUSTOMER_PASSWORD || process.env.SEED_CUSTOMER_PASSWORD || 'Customer@123456',
    role: 'CUSTOMER',
  }),
});

export const TIMEOUTS = Object.freeze({
  apiMs: Number(process.env.E2E_API_TIMEOUT_MS || 15_000),
  actionMs: Number(process.env.E2E_ACTION_TIMEOUT_MS || 15_000),
  navMs: Number(process.env.E2E_NAV_TIMEOUT_MS || 25_000),
  testMs: Number(process.env.E2E_TEST_TIMEOUT_MS || 60_000),
  serverProbeMs: Number(process.env.E2E_PROBE_TIMEOUT_MS || 4_000),
});

export const VIEWPORTS = Object.freeze({
  POS_1280: Object.freeze({ width: 1280, height: 800 }),
  POS_1366: Object.freeze({ width: 1366, height: 768 }),
  POS_1920: Object.freeze({ width: 1920, height: 1080 }),
  MOBILE_390: Object.freeze({ width: 390, height: 844, isMobile: true, hasTouch: true }),
});

export const BROWSER = Object.freeze({
  channel: process.env.E2E_BROWSER_CHANNEL || 'msedge',
  headless: process.env.E2E_HEADLESS !== '0',
  executablePath: process.env.E2E_EXECUTABLE_PATH || process.env.CHROME_PATH || '',
});

const ARTIFACTS_DIR = path.resolve(SUITE_ROOT, 'artifacts');

export const PATHS = Object.freeze({
  SUITE_ROOT,
  ROOT_DIR,
  CUSTOMER_WEB_DIR: path.resolve(ROOT_DIR, 'customer-web'),
  CUSTOMER_WEB_SRC_DIR: path.resolve(ROOT_DIR, 'customer-web', 'src'),
  TESTS_DIR: path.resolve(SUITE_ROOT, 'tests'),
  FIXTURES_DIR: path.resolve(SUITE_ROOT, 'fixtures'),
  ARTIFACTS_DIR,
  SCREENSHOTS_DIR: path.join(ARTIFACTS_DIR, 'screenshots'),
  SAMPLE_RECEIPT_PATH: path.resolve(SUITE_ROOT, 'fixtures', 'sample-receipt.png'),
});

export const STORAGE_KEYS = Object.freeze({
  accessToken: 'torisakura_access_token',
  refreshToken: 'torisakura_refresh_token',
  user: 'torisakura_user_v2',
});

export const config = Object.freeze({
  WEB_URL,
  API_URL,
  API_ORIGIN,
  USERS,
  TIMEOUTS,
  VIEWPORTS,
  BROWSER,
  PATHS,
  STORAGE_KEYS,
});

export default config;
