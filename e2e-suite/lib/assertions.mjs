import assert from 'node:assert/strict';

export { assert };

function prefix(label) {
  return label ? `${label}: ` : '';
}

export function assertApprox(actual, expected, tolerance = 0.01, label = '') {
  const isInvalidInput = (v) =>
    v === null ||
    v === undefined ||
    (typeof v === 'string' && v.trim() === '') ||
    typeof v === 'boolean' ||
    typeof v === 'object' ||
    typeof v === 'symbol';
  assert.ok(
    !isInvalidInput(actual) && !isInvalidInput(expected),
    `${prefix(label)}expected finite numbers, got actual=${String(actual)}, expected=${String(expected)}`,
  );
  const a = Number(actual);
  const e = Number(expected);
  assert.ok(
    Number.isFinite(a) && Number.isFinite(e),
    `${prefix(label)}expected finite numbers, got actual=${actual}, expected=${expected}`,
  );
  const diff = Math.abs(a - e);
  assert.ok(
    diff <= tolerance,
    `${prefix(label)}expected ${a} to be within ±${tolerance} of ${e} (diff=${diff})`,
  );
}

export function assertCurrencyVndNear(actual, expected, tolerance = 1, label = '') {
  assertApprox(actual, expected, tolerance, label || 'VND amount');
}

export function assertContains(haystack, needle, label = '') {
  const str = String(haystack ?? '');
  assert.ok(
    str.includes(String(needle)),
    `${prefix(label)}expected text to contain ${JSON.stringify(needle)}; got ${JSON.stringify(str.slice(0, 300))}`,
  );
}

export function assertNotContains(haystack, needle, label = '') {
  const str = String(haystack ?? '');
  assert.ok(
    !str.includes(String(needle)),
    `${prefix(label)}expected text NOT to contain ${JSON.stringify(needle)}; got ${JSON.stringify(str.slice(0, 300))}`,
  );
}

export function assertStatus(res, expected, label = '') {
  assert.ok(res && typeof res.status === 'number', `${prefix(label)}invalid HTTP response object`);
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(res.status)) {
    const snippet = String(res.text || JSON.stringify(res.data) || '').slice(0, 500);
    assert.fail(
      `${prefix(label)}expected HTTP status ${allowed.join('|')}, got ${res.status} on ${res.method || ''} ${res.url || ''}. Body: ${snippet}`,
    );
  }
  return res;
}

export function assertJsonShape(obj, keys, label = '') {
  assert.ok(
    obj !== null && typeof obj === 'object' && !Array.isArray(obj),
    `${prefix(label)}expected non-null object, got ${obj === null ? 'null' : typeof obj}`,
  );
  const missing = keys.filter((k) => obj[k] === undefined);
  assert.equal(
    missing.length,
    0,
    `${prefix(label)}missing required JSON keys: [${missing.join(', ')}] in {${Object.keys(obj).join(', ')}}`,
  );
  return obj;
}

export function assertNonEmptyArray(val, label = '') {
  assert.ok(
    Array.isArray(val) && val.length > 0,
    `${prefix(label)}expected non-empty array, got ${Array.isArray(val) ? 'empty array' : typeof val}`,
  );
  return val;
}

export function assertNoTelemetryErrors(
  telemetry,
  { allowConsoleError = false, allowedStatuses = [], label = '' } = {},
) {
  if (!telemetry) return;

  const allowedSet = new Set(allowedStatuses.map(Number));

  if (Array.isArray(telemetry.pageErrors) && telemetry.pageErrors.length > 0) {
    assert.fail(
      `${prefix(label)}uncaught pageerror(s): ${telemetry.pageErrors.map((e) => e.message || String(e)).join(' | ')}`,
    );
  }

  if (!allowConsoleError && Array.isArray(telemetry.consoleErrors) && telemetry.consoleErrors.length > 0) {
    const unexpectedConsoleErrors = telemetry.consoleErrors.filter((e) => {
      const text = e?.text || String(e);
      if (allowedSet.size > 0) {
        const match = text.match(/Failed to load resource:.*status of (\d{3})\b/i);
        if (match && allowedSet.has(Number(match[1]))) {
          return false;
        }
      }
      return true;
    });
    if (unexpectedConsoleErrors.length > 0) {
      assert.fail(
        `${prefix(label)}console.error(s): ${unexpectedConsoleErrors.map((e) => e.text || String(e)).join(' | ')}`,
      );
    }
  }

  if (Array.isArray(telemetry.requestFailed) && telemetry.requestFailed.length > 0) {
    assert.fail(
      `${prefix(label)}failed network request(s): ${telemetry.requestFailed.map((r) => `${r.method} ${r.url} (${r.failureText})`).join(' | ')}`,
    );
  }

  if (Array.isArray(telemetry.serverErrors) && telemetry.serverErrors.length > 0) {
    assert.fail(
      `${prefix(label)}unexpected 5xx response(s): ${telemetry.serverErrors.map((r) => `${r.status} ${r.method} ${r.url}`).join(' | ')}`,
    );
  }

  if (Array.isArray(telemetry.httpErrors) && telemetry.httpErrors.length > 0) {
    const unexpected = telemetry.httpErrors.filter((r) => !allowedSet.has(r.status));
    if (unexpected.length > 0) {
      assert.fail(
        `${prefix(label)}unexpected HTTP >=400 response(s): ${unexpected.map((r) => `${r.status} ${r.method} ${r.url}`).join(' | ')}`,
      );
    }
  }
}

export function assertPrintTriggeredOnce(printCalls, label = '') {
  assert.ok(
    Array.isArray(printCalls),
    `${prefix(label)}expected printCalls to be an array`,
  );
  assert.equal(
    printCalls.length,
    1,
    `${prefix(label)}expected window.print() to be called exactly 1 time, got ${printCalls.length}`,
  );
  return printCalls[0];
}

export async function assertEventually(
  fn,
  { timeoutMs = 6_000, intervalMs = 200, label = 'condition' } = {},
) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() <= deadline) {
    try {
      const value = await fn();
      if (value !== false && value !== undefined && value !== null) {
        return value;
      }
      if (value === undefined) {
        return true;
      }
      lastError = new Error(`${label} returned ${String(value)}`);
    } catch (err) {
      lastError = err;
    }
    if (Date.now() + intervalMs > deadline) break;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  const errMsg = lastError ? lastError.message : 'timed out';
  throw new assert.AssertionError({
    message: `${label} did not succeed within ${timeoutMs}ms: ${errMsg}`,
    operator: 'assertEventually',
  });
}

export default {
  assert,
  assertApprox,
  assertCurrencyVndNear,
  assertContains,
  assertNotContains,
  assertStatus,
  assertJsonShape,
  assertNonEmptyArray,
  assertNoTelemetryErrors,
  assertPrintTriggeredOnce,
  assertEventually,
};
