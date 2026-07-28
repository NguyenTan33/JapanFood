import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { TIMEOUTS } from './config.mjs';
import { createCleanupRegistry } from './test-data.mjs';

export function discoverTestFiles(testsDir, { tier } = {}) {
  const results = [];
  if (!fs.existsSync(testsDir)) return results;

  const tiers = tier ? [Number(tier)] : [1, 2, 3, 4];
  for (const t of tiers) {
    const tierDir = path.join(testsDir, `tier${t}`);
    if (!fs.existsSync(tierDir)) continue;

    const walk = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      entries.sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile() && entry.name.endsWith('.test.mjs')) {
          results.push({ filePath: full, expectedTier: t });
        }
      }
    };

    walk(tierDir);
  }

  return results;
}

export function validateTestModule(mod, filePath, expectedTier) {
  if (!mod || typeof mod !== 'object') {
    throw new Error(`Invalid test module ${filePath}: module export object missing`);
  }

  const { meta, registerTests } = mod;
  if (!meta || typeof meta !== 'object') {
    throw new Error(`Contract violation in ${filePath}: missing exported 'meta' object`);
  }
  if (typeof meta.id !== 'string' || !meta.id.trim()) {
    throw new Error(`Contract violation in ${filePath}: meta.id must be a non-empty string`);
  }
  if (![1, 2, 3, 4].includes(Number(meta.tier))) {
    throw new Error(`Contract violation in ${filePath}: meta.tier must be 1, 2, 3, or 4 (got ${meta.tier})`);
  }
  if (expectedTier !== undefined && Number(meta.tier) !== Number(expectedTier)) {
    throw new Error(
      `Contract violation in ${filePath}: meta.tier (${meta.tier}) does not match folder tier (${expectedTier})`,
    );
  }
  if (typeof meta.feature !== 'string' || !meta.feature.trim()) {
    throw new Error(`Contract violation in ${filePath}: meta.feature must be a non-empty string`);
  }
  if (typeof meta.title !== 'string' || !meta.title.trim()) {
    throw new Error(`Contract violation in ${filePath}: meta.title must be a non-empty string`);
  }
  if (typeof registerTests !== 'function') {
    throw new Error(`Contract violation in ${filePath}: missing exported 'registerTests(suite)' function`);
  }
}

function extractTestId(name, metaId, index) {
  const str = String(name || '').trim();
  const colonIdx = str.indexOf(':');
  if (colonIdx > 0) {
    const prefix = str.slice(0, colonIdx).trim();
    if (/^[A-Za-z0-9._-]+$/.test(prefix)) {
      return prefix;
    }
  }
  return `${metaId}#${index}`;
}

export class SuiteRegistry {
  constructor() {
    this.suites = [];
    this.tests = [];
    this.testIds = new Set();
  }

  registerModule(mod, filePath, expectedTier) {
    validateTestModule(mod, filePath, expectedTier);

    const suiteRecord = {
      meta: {
        id: mod.meta.id.trim(),
        tier: Number(mod.meta.tier),
        feature: mod.meta.feature.trim(),
        title: mod.meta.title.trim(),
      },
      filePath,
      hooks: {
        beforeAll: [],
        afterAll: [],
        beforeEach: [],
        afterEach: [],
      },
      tests: [],
    };

    const suiteProxy = {
      meta: suiteRecord.meta,
      test: (name, optionsOrFn, maybeFn) => {
        const opts = typeof optionsOrFn === 'function' ? {} : optionsOrFn || {};
        const fn = typeof optionsOrFn === 'function' ? optionsOrFn : maybeFn;

        if (typeof name !== 'string' || !name.trim()) {
          throw new Error(`Contract violation in ${filePath}: suite.test(name, ...) requires a non-empty name`);
        }
        if (typeof fn !== 'function') {
          throw new Error(`Contract violation in ${filePath} (${name}): suite.test requires a test callback function`);
        }

        const testIndex = suiteRecord.tests.length + 1;
        const id = extractTestId(name, suiteRecord.meta.id, testIndex);
        if (this.testIds.has(id)) {
          throw new Error(`Duplicate test ID '${id}' detected in ${filePath}`);
        }
        this.testIds.add(id);

        const testRecord = {
          id,
          name: name.trim(),
          title: name.trim(),
          tier: suiteRecord.meta.tier,
          feature: String(opts.feature || suiteRecord.meta.feature).trim(),
          tags: Array.isArray(opts.tags) ? opts.tags.map(String) : [],
          timeoutMs: Number(opts.timeoutMs || TIMEOUTS.testMs),
          skip: Boolean(opts.skip),
          fn,
          meta: suiteRecord.meta,
          filePath,
          suite: suiteRecord,
        };

        suiteRecord.tests.push(testRecord);
        this.tests.push(testRecord);
      },
      beforeAll: (fn) => {
        if (typeof fn !== 'function') throw new TypeError(`beforeAll in ${filePath} requires a function`);
        suiteRecord.hooks.beforeAll.push(fn);
      },
      afterAll: (fn) => {
        if (typeof fn !== 'function') throw new TypeError(`afterAll in ${filePath} requires a function`);
        suiteRecord.hooks.afterAll.push(fn);
      },
      beforeEach: (fn) => {
        if (typeof fn !== 'function') throw new TypeError(`beforeEach in ${filePath} requires a function`);
        suiteRecord.hooks.beforeEach.push(fn);
      },
      afterEach: (fn) => {
        if (typeof fn !== 'function') throw new TypeError(`afterEach in ${filePath} requires a function`);
        suiteRecord.hooks.afterEach.push(fn);
      },
    };

    mod.registerTests(suiteProxy);
    this.suites.push(suiteRecord);
    return suiteRecord;
  }

  getAllTests() {
    return [...this.tests];
  }

  filterTests({ tier, filter } = {}) {
    const tierNum = tier !== undefined && tier !== null && tier !== '' ? Number(tier) : null;
    const needle = filter ? String(filter).toLowerCase() : '';

    return this.tests.filter((t) => {
      if (tierNum !== null && t.tier !== tierNum) return false;
      if (!needle) return true;

      const haystack = [
        t.id,
        t.name,
        t.meta.id,
        t.meta.title,
        t.feature,
        t.tags.join(' '),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }

  getSummaryCounts(tests = this.tests) {
    const byTier = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const byFeature = {};
    const suiteFiles = new Set();

    for (const t of tests) {
      suiteFiles.add(t.filePath);
      byTier[t.tier] = (byTier[t.tier] || 0) + 1;
      byFeature[t.feature] = (byFeature[t.feature] || 0) + 1;
    }

    return {
      total: tests.length,
      suites: suiteFiles.size,
      byTier,
      byFeature,
    };
  }

  async run({
    tier,
    filter,
    bail = false,
    contextFactory,
    onSuiteStart,
    onTestStart,
    onTestEnd,
    onTestFailure,
  } = {}) {
    const startedAt = new Date().toISOString();
    const runStart = performance.now();
    const selected = this.filterTests({ tier, filter });

    const suiteMap = new Map();
    for (const t of selected) {
      if (!suiteMap.has(t.filePath)) {
        suiteMap.set(t.filePath, { suite: t.suite, tests: [] });
      }
      suiteMap.get(t.filePath).tests.push(t);
    }

    const totals = {
      suites: suiteMap.size,
      total: selected.length,
      passed: 0,
      failed: 0,
      skipped: 0,
    };
    const byTier = {};
    const byFeature = {};
    const results = [];

    const bumpBucket = (bucket, key, status) => {
      if (!bucket[key]) {
        bucket[key] = { total: 0, passed: 0, failed: 0, skipped: 0 };
      }
      bucket[key].total += 1;
      bucket[key][status] += 1;
    };

    let bailed = false;

    for (const { suite, tests } of suiteMap.values()) {
      if (bailed) break;
      if (onSuiteStart) await onSuiteStart(suite, tests);

      const suiteCleanup = createCleanupRegistry();
      const suiteCtx = contextFactory
        ? await contextFactory({ suite, cleanup: suiteCleanup })
        : { cleanup: suiteCleanup };

      let beforeAllError = null;
      try {
        for (const hook of suite.hooks.beforeAll) {
          await hook(suiteCtx);
        }
      } catch (err) {
        beforeAllError = err;
      }

      try {
        for (const test of tests) {
          if (bailed) break;
          if (onTestStart) await onTestStart(test);

          const t0 = performance.now();
          const artifacts = [];
          const testCleanup = createCleanupRegistry();

          if (test.skip) {
            const res = {
              id: test.id,
              name: test.name,
              tier: test.tier,
              feature: test.feature,
              tags: test.tags,
              filePath: test.filePath,
              status: 'skipped',
              durationMs: 0,
              error: null,
              artifacts,
            };
            results.push(res);
            totals.skipped += 1;
            bumpBucket(byTier, String(test.tier), 'skipped');
            bumpBucket(byFeature, test.feature, 'skipped');
            if (onTestEnd) await onTestEnd(res);
            continue;
          }

          if (beforeAllError) {
            const res = {
              id: test.id,
              name: test.name,
              tier: test.tier,
              feature: test.feature,
              tags: test.tags,
              filePath: test.filePath,
              status: 'failed',
              durationMs: Math.round(performance.now() - t0),
              error: {
                message: `beforeAll hook failed: ${beforeAllError?.message || String(beforeAllError)}`,
                stack: beforeAllError?.stack || '',
              },
              artifacts,
            };
            results.push(res);
            totals.failed += 1;
            bumpBucket(byTier, String(test.tier), 'failed');
            bumpBucket(byFeature, test.feature, 'failed');
            if (onTestEnd) await onTestEnd(res);
            if (bail) bailed = true;
            continue;
          }

          const ctx = contextFactory
            ? await contextFactory({ suite, test, cleanup: testCleanup, artifacts })
            : { cleanup: testCleanup, artifacts };

          let testError = null;
          let timerId = null;
          try {
            for (const hook of suite.hooks.beforeEach) {
              await hook(ctx);
            }

            const timeoutPromise = new Promise((_, reject) => {
              timerId = setTimeout(() => {
                reject(new Error(`Test '${test.id}' timed out after ${test.timeoutMs}ms`));
              }, test.timeoutMs);
            });

            await Promise.race([test.fn(ctx), timeoutPromise]);
          } catch (err) {
            testError = err;
            if (err?.screenshotPath) {
              artifacts.push(err.screenshotPath);
            }
            if (onTestFailure) {
              try {
                const extraArtifacts = await onTestFailure(test, err, ctx);
                if (Array.isArray(extraArtifacts)) {
                  artifacts.push(...extraArtifacts.filter(Boolean));
                }
              } catch {
                // Never allow an onTestFailure hook error to abort remaining tests
              }
            }
          } finally {
            if (timerId) clearTimeout(timerId);

            for (const hook of suite.hooks.afterEach) {
              try {
                await hook(ctx);
              } catch (hookErr) {
                if (!testError) testError = hookErr;
              }
            }

            const cleanupErrors = await testCleanup.runAll();
            if (cleanupErrors.length > 0 && !testError) {
              testError = new Error(
                `Cleanup failed: ${cleanupErrors.map((e) => `${e.label}: ${e.message}`).join('; ')}`,
              );
            }
          }

          const status = testError ? 'failed' : 'passed';
          const res = {
            id: test.id,
            name: test.name,
            tier: test.tier,
            feature: test.feature,
            tags: test.tags,
            filePath: test.filePath,
            status,
            durationMs: Math.round(performance.now() - t0),
            error: testError
              ? {
                  message: testError?.message || String(testError),
                  stack: testError?.stack || '',
                }
              : null,
            artifacts: Array.from(new Set(artifacts)),
          };

          results.push(res);
          totals[status] += 1;
          bumpBucket(byTier, String(test.tier), status);
          bumpBucket(byFeature, test.feature, status);

          if (onTestEnd) await onTestEnd(res);
          if (status === 'failed' && bail) {
            bailed = true;
          }
        }
      } finally {
        for (const hook of suite.hooks.afterAll) {
          try {
            await hook(suiteCtx);
          } catch {
            // preserve primary test results
          }
        }
        await suiteCleanup.runAll();
      }
    }

    const finishedAt = new Date().toISOString();
    return {
      startedAt,
      finishedAt,
      durationMs: Math.round(performance.now() - runStart),
      totals,
      byTier,
      byFeature,
      results,
    };
  }
}

export default {
  discoverTestFiles,
  validateTestModule,
  SuiteRegistry,
};
