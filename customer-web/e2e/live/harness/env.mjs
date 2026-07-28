import os from 'node:os';
import path from 'node:path';

export const E2E_BASE_URL = (process.env.E2E_BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');
export const E2E_API_URL = (process.env.E2E_API_URL || 'http://localhost:5243/api').replace(/\/+$/, '');
export const E2E_API_ORIGIN = new URL(E2E_API_URL).origin;
export const E2E_HEALTH_URL = `${E2E_API_ORIGIN}/health`;

export const E2E_BROWSER_CHANNEL = process.env.E2E_BROWSER_CHANNEL || 'msedge';
export const E2E_HEADLESS = process.env.E2E_HEADLESS !== '0';

export const E2E_SQL_SERVER = process.env.E2E_SQL_SERVER || 'localhost';
export const E2E_SQL_DB = process.env.E2E_SQL_DB || 'JapanFood';

export const E2E_OTP_CODE = process.env.E2E_OTP_CODE || '';
export const E2E_OTP_SECRET = process.env.E2E_OTP_SECRET || 'JapanFood_Otp_Secret_Key_Hmac_2026!';

export const E2E_GOOGLE_ID_TOKEN = process.env.E2E_GOOGLE_ID_TOKEN || '';
export const E2E_GOOGLE_NEW_ID_TOKEN = process.env.E2E_GOOGLE_NEW_ID_TOKEN || '';

export const E2E_SESSION_CACHE_FILE =
  process.env.E2E_SESSION_CACHE_FILE ||
  path.join(os.tmpdir(), 'japanfood-e2e-live-sessions.json');

export const SEEDED_USERS = {
  customer: {
    email: process.env.E2E_CUSTOMER_EMAIL || 'customer@japanfood.vn',
    phoneNumber: '+84966666666',
    password: process.env.E2E_CUSTOMER_PASSWORD || 'Customer@123456',
    role: 'CUSTOMER',
  },
  staff: {
    email: process.env.E2E_STAFF_EMAIL || 'staff@japanfood.vn',
    phoneNumber: '+84977777777',
    password: process.env.E2E_STAFF_PASSWORD || 'Staff@123456',
    role: 'STAFF',
  },
  manager: {
    email: process.env.E2E_MANAGER_EMAIL || 'manager@japanfood.vn',
    phoneNumber: '+84988888888',
    password: process.env.E2E_MANAGER_PASSWORD || 'Manager@123456',
    role: 'MANAGER',
  },
  admin: {
    email: process.env.E2E_ADMIN_EMAIL || 'admin@japanfood.vn',
    phoneNumber: '+84999999999',
    password: process.env.E2E_ADMIN_PASSWORD || 'Admin@123456',
    role: 'ADMIN',
  },
};

export const VIEWPORTS = {
  DESKTOP_1280: { width: 1280, height: 800, isMobile: false, hasTouch: false },
  DESKTOP_1440: { width: 1440, height: 900, isMobile: false, hasTouch: false },
  IPHONE_375: {
    width: 375,
    height: 812,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  },
  IPHONE_390: {
    width: 390,
    height: 844,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  },
};
