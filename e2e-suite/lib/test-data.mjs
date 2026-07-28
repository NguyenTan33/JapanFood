import fs from 'node:fs';
import zlib from 'node:zlib';
import { PATHS } from './config.mjs';
import { asRole } from './api-client.mjs';
import { assertStatus } from './assertions.mjs';

// Precompute IEEE 802.3 CRC32 table for valid PNG chunk generation
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makePngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const lenBytes = Buffer.alloc(4);
  lenBytes.writeUInt32BE(data.length, 0);

  const crcInput = Buffer.concat([typeBytes, data]);
  const crcBytes = Buffer.alloc(4);
  crcBytes.writeUInt32BE(crc32(crcInput), 0);

  return Buffer.concat([lenBytes, typeBytes, data, crcBytes]);
}

/**
 * Generate a valid RGBA PNG image buffer (default 16x16) with genuine IHDR, IDAT, and IEND chunks.
 */
export function createSamplePngBuffer(width = 16, height = 16) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = 1 + width * 4;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * stride;
    raw[rowStart] = 0; // filter type 0 (None)
    for (let x = 0; x < width; x += 1) {
      const px = rowStart + 1 + x * 4;
      raw[px] = (x * 16) & 0xff;     // R
      raw[px + 1] = (y * 16) & 0xff; // G
      raw[px + 2] = 180;             // B
      raw[px + 3] = 255;             // A
    }
  }

  const compressed = zlib.deflateSync(raw);

  return Buffer.concat([
    signature,
    makePngChunk('IHDR', ihdr),
    makePngChunk('IDAT', compressed),
    makePngChunk('IEND', Buffer.alloc(0)),
  ]);
}

export function createSamplePngFile(filename = 'withdrawal-proof.png', width = 16, height = 16) {
  return {
    name: filename,
    mimeType: 'image/png',
    buffer: createSamplePngBuffer(width, height),
  };
}

export function createSamplePngBlob(filename = 'withdrawal-proof.png', width = 16, height = 16) {
  const buf = createSamplePngBuffer(width, height);
  if (typeof File !== 'undefined') {
    return new File([buf], filename, { type: 'image/png' });
  }
  return new Blob([buf], { type: 'image/png' });
}

export const fixtures = {
  sampleReceiptPath: PATHS.SAMPLE_RECEIPT_PATH,
  get sampleReceiptBuffer() {
    if (fs.existsSync(PATHS.SAMPLE_RECEIPT_PATH)) {
      return fs.readFileSync(PATHS.SAMPLE_RECEIPT_PATH);
    }
    return createSamplePngBuffer(16, 16);
  },
};

export function uniqueSuffix(prefix = 'E2E') {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}_${ts}_${rnd}`;
}

export function uniqueCode(prefix = 'E2E', maxLen = 16) {
  const ts = Date.now().toString(36).slice(-5).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  const suffix = `${ts}${rnd}`;
  const cleanPrefix = String(prefix).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (maxLen <= 0) return '';
  if (suffix.length >= maxLen) {
    return suffix.slice(-maxLen);
  }
  const maxPrefixLen = maxLen - suffix.length;
  return `${cleanPrefix.slice(0, maxPrefixLen)}${suffix}`;
}

export function uniqueUserIdentity(prefix = 'e2e') {
  const ts = Date.now().toString().slice(-5);
  const rnd = Math.floor(100 + Math.random() * 900).toString();
  const suffix = `${ts}${rnd}`; // 8 digits
  const cleanPrefix = String(prefix).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'e2e';
  return {
    fullName: `E2E Test User ${suffix}`,
    email: `${cleanPrefix}.${suffix}.${Math.random().toString(36).slice(2, 5)}@e2e.japanfood.vn`,
    phoneNumber: `+849${suffix}`,
  };
}

export function createCleanupRegistry() {
  const entries = [];
  const register = (labelOrFn, maybeFn) => {
    const fn = typeof labelOrFn === 'function' ? labelOrFn : maybeFn;
    const label = typeof labelOrFn === 'string' ? labelOrFn : 'cleanup';
    if (typeof fn !== 'function') {
      throw new TypeError('Cleanup callback must be a function');
    }
    entries.push({ label, fn });
  };
  register.add = register;
  register.runAll = async () => {
    const errors = [];
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      const entry = entries[i];
      try {
        await entry.fn();
      } catch (err) {
        errors.push({ label: entry.label, message: err?.message || String(err) });
      }
    }
    entries.length = 0;
    return errors;
  };
  Object.defineProperty(register, 'count', {
    get() {
      return entries.length;
    },
  });
  return register;
}

export async function ensureOpenShift({
  role = 'STAFF',
  openingCash = 1_000_000,
  notes = 'E2E auto-opened shift',
} = {}) {
  const client = await asRole(role);
  const currentRes = await client.get('/shifts/current');
  assertStatus(currentRes, 200, 'GET /shifts/current');

  if (currentRes.data?.hasOpenShift && currentRes.data?.shift) {
    return { shift: currentRes.data.shift, createdByHelper: false };
  }

  const openRes = await client.post('/shifts/open', { openingCash, notes });
  assertStatus(openRes, [200, 201], 'POST /shifts/open');
  const shift = openRes.data?.shift || openRes.data;
  return { shift, createdByHelper: true };
}

export async function closeShiftIfOpen({
  role = 'STAFF',
  actualCash,
  notes = 'E2E cleanup close shift',
} = {}) {
  const client = await asRole(role);
  const currentRes = await client.get('/shifts/current');
  if (currentRes.status === 404 || !currentRes.data?.hasOpenShift || !currentRes.data?.shift) {
    return null;
  }

  const shift = currentRes.data.shift;
  const resolvedActualCash =
    actualCash ?? shift.currentRemainingCash ?? shift.openingCash ?? 0;

  const closeRes = await client.post('/shifts/close', {
    actualCash: resolvedActualCash,
    notes,
  });
  assertStatus(closeRes, 200, 'POST /shifts/close');
  return closeRes.data;
}

export async function createTempAreaAndTable({
  role = 'ADMIN',
  capacity = 4,
  minCapacity = 1,
  cleanup,
} = {}) {
  const client = await asRole(role);
  const code = uniqueCode('EA', 12);
  const name = `E2E Area ${code}`;
  const tableNumber = uniqueCode('ET', 12);

  const areaRes = await client.post('/reservations/areas', {
    code,
    name,
    areaCode: code,
    areaName: name,
    description: 'Temporary area created by E2E suite',
    minGuests: 1,
    maxGuests: Math.max(8, capacity),
    displayOrder: 99,
  });
  assertStatus(areaRes, [200, 201], 'Create temp area');
  const area = areaRes.data;
  const areaId = area?.id ?? area?.areaId;

  const tableRes = await client.post('/reservations/tables', {
    areaId,
    tableNumber,
    capacity,
    minCapacity,
  });
  assertStatus(tableRes, [200, 201], 'Create temp table');
  const table = tableRes.data;
  const tableId = table?.tableId ?? table?.id;

  if (cleanup && typeof cleanup.add === 'function') {
    cleanup.add(`cleanup temp table ${tableId} & area ${areaId}`, async () => {
      await cleanupTempResources({ tableIds: [tableId], areaIds: [areaId] });
    });
  }

  return { area, areaId, table, tableId, code, tableNumber };
}

export async function cleanupTempResources(tracker = {}) {
  const {
    orderIds = [],
    cleaningTableIds = [],
    tableIds = [],
    areaIds = [],
    voucherIds = [],
    userIds = [],
    reservationIds = [],
    role = 'ADMIN',
  } = tracker;

  const client = await asRole(role);
  const errors = [];

  const safeRun = async (label, fn, { allowFallbackStatuses = false } = {}) => {
    try {
      const res = await fn();
      if (res && res.status >= 400 && res.status !== 404) {
        if (res.status >= 500 || !allowFallbackStatuses) {
          errors.push({
            label,
            message: `HTTP ${res.status}: ${res.error?.message || res.text || 'Cleanup request failed'}`,
          });
        }
        return res;
      }
      return res;
    } catch (err) {
      errors.push({ label, message: err?.message || String(err) });
      return null;
    }
  };

  for (const orderId of orderIds) {
    if (!orderId) continue;
    await safeRun(`cancel order ${orderId}`, () =>
      client.post(`/orders/${orderId}/cancel`, { reason: 'E2E cleanup' }),
    );
  }

  for (const tableId of cleaningTableIds) {
    if (!tableId) continue;
    await safeRun(`complete cleaning table ${tableId}`, () =>
      client.post(`/reservations/tables/${tableId}/complete-cleaning`, {}),
    );
  }

  for (const reservationId of reservationIds) {
    if (!reservationId) continue;
    await safeRun(`cancel reservation ${reservationId}`, () =>
      client.post(`/reservations/${reservationId}/cancel`, { reason: 'E2E cleanup' }),
    );
  }

  for (const tableId of tableIds) {
    if (!tableId) continue;
    const delRes = await safeRun(
      `delete table ${tableId}`,
      () => client.del(`/reservations/tables/${tableId}`),
      { allowFallbackStatuses: true },
    );
    if (delRes && delRes.status >= 400 && delRes.status !== 404) {
      await safeRun(`deactivate table ${tableId}`, () =>
        client.patch(`/reservations/tables/${tableId}/status`, { isActive: false }),
      );
    }
  }

  for (const areaId of areaIds) {
    if (!areaId) continue;
    const delRes = await safeRun(
      `delete area ${areaId}`,
      () => client.del(`/reservations/areas/${areaId}`),
      { allowFallbackStatuses: true },
    );
    if (delRes && delRes.status >= 400 && delRes.status !== 404) {
      await safeRun(`deactivate area ${areaId}`, () =>
        client.patch(`/reservations/areas/${areaId}/status`, { isActive: false }),
      );
    }
  }

  for (const voucherId of voucherIds) {
    if (!voucherId) continue;
    const delRes = await safeRun(
      `delete voucher ${voucherId}`,
      () => client.del(`/vouchers/${voucherId}`),
      { allowFallbackStatuses: true },
    );
    if (delRes && delRes.status >= 400 && delRes.status !== 404) {
      await safeRun(`deactivate voucher ${voucherId}`, () =>
        client.patch(`/vouchers/${voucherId}/deactivate`, {}),
      );
    }
  }

  for (const userId of userIds) {
    if (!userId) continue;
    await safeRun(`lock temp user ${userId}`, () =>
      client.patch(`/admin/users/${userId}/lock`, {}),
    );
  }

  return errors;
}

export default {
  createSamplePngBuffer,
  createSamplePngFile,
  createSamplePngBlob,
  fixtures,
  uniqueSuffix,
  uniqueCode,
  uniqueUserIdentity,
  createCleanupRegistry,
  ensureOpenShift,
  closeShiftIfOpen,
  createTempAreaAndTable,
  cleanupTempResources,
};
