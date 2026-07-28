#!/usr/bin/env node

/**
 * TORI SAKURA JAPANESE DINING (customer-web)
 * Unified Opaque-Box E2E Test Suite Runner
 *
 * Modes:
 *   --mode=contract  (default) Offline R2/R3/R4 contract & build tests (e2e/tier1..4)
 *   --mode=live      Live Playwright + F&B API + SQL Server tests (e2e/live/tier1..4)
 *   --mode=all       Both contract and live suites sequentially
 *
 * Options:
 *   --tier=1|2|3|4   Run only the specified tier
 */

import { spawn, spawnSync } from 'node:child_process';
import { readdirSync, statSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const E2E_ROOT = join(PROJECT_ROOT, 'e2e');
const LIVE_E2E_ROOT = join(E2E_ROOT, 'live');

// ANSI Color Codes
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bgRed: '\x1b[41m\x1b[37m\x1b[1m',
  bgGreen: '\x1b[42m\x1b[30m\x1b[1m',
};

const CONTRACT_THRESHOLDS = {
  minTotal: 71,
  minTier1: 30,
  minTier2: 30,
  minTier3: 6,
  minTier4: 5,
};

const LIVE_THRESHOLDS = {
  minTotal: 200,
  minTier1: 90,
  minTier2: 90,
  minTier3: 18,
  minTier4: 9,
};

function stripAnsi(str = '') {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function getFilesRecursively(dir, { excludeDirNames = [] } = {}) {
  if (!existsSync(dir)) return [];
  let results = [];
  const list = readdirSync(dir);
  for (const file of list) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (excludeDirNames.includes(file)) continue;
      results = results.concat(getFilesRecursively(fullPath, { excludeDirNames }));
    } else if (file.endsWith('.test.mjs') || file.endsWith('.test.js')) {
      results.push(fullPath);
    }
  }
  return results.sort();
}

function parseTestOutput(stdout) {
  let passLines = 0;
  let failLines = 0;
  let passSummary = null;
  let failSummary = null;
  let testSummary = null;
  let suiteSummary = 0;
  let durationMs = 0;

  const clean = stripAnsi(stdout);
  const lines = clean.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('✔') || trimmed.startsWith('ok ')) {
      passLines++;
    }
    if (trimmed.startsWith('✖') || trimmed.startsWith('not ok ')) {
      failLines++;
    }
    if (trimmed.startsWith('ℹ pass') || trimmed.startsWith('# pass')) {
      const m = trimmed.match(/(\d+)/);
      if (m) passSummary = parseInt(m[1], 10);
    }
    if (trimmed.startsWith('ℹ fail') || trimmed.startsWith('# fail')) {
      const m = trimmed.match(/(\d+)/);
      if (m) failSummary = parseInt(m[1], 10);
    }
    if (trimmed.startsWith('ℹ tests') || trimmed.startsWith('# tests')) {
      const m = trimmed.match(/(\d+)/);
      if (m) testSummary = parseInt(m[1], 10);
    }
    if (trimmed.startsWith('ℹ suites') || trimmed.startsWith('# suites')) {
      const m = trimmed.match(/(\d+)/);
      if (m) suiteSummary = parseInt(m[1], 10);
    }
    if (trimmed.startsWith('ℹ duration_ms') || trimmed.startsWith('# duration_ms')) {
      const m = trimmed.match(/([\d.]+)/);
      if (m) durationMs = parseFloat(m[1]);
    }
  }

  const passCount = passSummary !== null ? passSummary : passLines;
  const failCount = failSummary !== null ? failSummary : failLines;
  const testCount = testSummary !== null ? testSummary : passCount + failCount;

  return { testCount, passCount, failCount, suiteCount: suiteSummary, durationMs };
}

function runNodeTestFiles(files, { concurrency = null, env = {} } = {}) {
  return new Promise((resolvePromise) => {
    const nodeArgs = ['--test'];
    if (concurrency !== null) {
      nodeArgs.push(`--test-concurrency=${concurrency}`);
    }
    nodeArgs.push(...files);

    const child = spawn(process.execPath, nodeArgs, {
      cwd: PROJECT_ROOT,
      env: { ...process.env, NODE_ENV: 'test', ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      resolvePromise({
        status: 1,
        stdout,
        stderr: `${stderr}\n${err.message}`,
      });
    });

    child.on('close', (code) => {
      resolvePromise({
        status: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

async function runTier(name, dirPath, options = {}) {
  const files = getFilesRecursively(dirPath, { excludeDirNames: options.excludeDirNames || [] });
  if (files.length === 0) {
    return {
      name,
      files: 0,
      testCount: 0,
      passCount: 0,
      failCount: 0,
      durationMs: 0,
      status: 'EMPTY',
      output: '',
      errorOutput: `No test files found under ${dirPath}`,
      exitCode: 1,
    };
  }

  const startTime = Date.now();
  const res = await runNodeTestFiles(files, {
    concurrency: options.concurrency ?? null,
    env: options.env || {},
  });

  const fullOutput = (res.stdout || '') + '\n' + (res.stderr || '');
  const parsed = parseTestOutput(fullOutput);
  const durationMs = Date.now() - startTime;
  const effectiveFailCount = res.status !== 0 && parsed.failCount === 0 ? 1 : parsed.failCount;
  const passed = res.status === 0 && effectiveFailCount === 0;

  return {
    name,
    files: files.length,
    testCount: parsed.testCount || parsed.passCount,
    passCount: parsed.passCount,
    failCount: effectiveFailCount,
    durationMs,
    status: passed ? 'PASS' : 'FAIL',
    output: res.stdout,
    errorOutput: res.stderr,
    exitCode: res.status,
  };
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function probeHttpOk(url, timeoutMs = 3500) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { ok: response.ok, status: response.status };
  } catch (err) {
    return { ok: false, status: 0, error: err?.message || String(err) };
  }
}

async function ensureApiReachable(apiUrl) {
  const normalizedApi = apiUrl.replace(/\/+$/, '');
  const apiRoot = normalizedApi.replace(/\/api$/i, '');
  const probeUrls = [
    `${apiRoot}/health`,
    `${normalizedApi}/health`,
    `${normalizedApi}/menu/categories`,
  ];

  const failures = [];
  for (const url of probeUrls) {
    const res = await probeHttpOk(url, 4000);
    if (res.ok) {
      console.log(`${C.green}✔ Live F&B API reachable${C.reset} (${url} → HTTP ${res.status})`);
      return;
    }
    failures.push(`${url} → ${res.status || res.error}`);
  }

  throw new Error(
    `F&B API is unreachable at E2E_API_URL="${normalizedApi}".\n` +
      `  Probed:\n    - ${failures.join('\n    - ')}\n` +
      `  Start the backend first (e.g. \`dotnet run --project ..\\F&B\\API\`) and re-run \`npm run test:e2e:live\`.`
  );
}

function killProcessTree(child) {
  if (!child || !child.pid) return;
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
    }
  } catch {
    // Ignore errors if process already exited
  }
}

async function ensureFrontendRunning(baseUrl) {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const existing = await probeHttpOk(normalizedBase, 2500);
  if (existing.ok) {
    console.log(`${C.green}✔ Frontend already listening${C.reset} (${normalizedBase} → HTTP ${existing.status})`);
    return { child: null, owned: false };
  }

  const parsedUrl = new URL(normalizedBase);
  const port = parsedUrl.port || (parsedUrl.protocol === 'https:' ? '443' : '5173');
  const serveMode = (process.env.E2E_SERVE_MODE || 'dev').toLowerCase();
  const viteBin = join(PROJECT_ROOT, 'node_modules', 'vite', 'bin', 'vite.js');

  if (!existsSync(viteBin)) {
    throw new Error(`Cannot auto-spawn frontend: Vite binary missing at ${viteBin}`);
  }

  const viteArgs =
    serveMode === 'preview'
      ? [viteBin, 'preview', '--port', port, '--strictPort']
      : [viteBin, '--port', port, '--strictPort'];

  console.log(`${C.cyan}▸ Frontend unreachable at ${normalizedBase}; spawning \`vite ${serveMode === 'preview' ? 'preview ' : ''}--port ${port}\`...${C.reset}`);

  const child = spawn(process.execPath, viteArgs, {
    cwd: PROJECT_ROOT,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  });

  let logs = '';
  let exitedEarly = false;
  let earlyCode = null;

  child.stdout.on('data', (d) => {
    logs += d.toString();
  });
  child.stderr.on('data', (d) => {
    logs += d.toString();
  });
  child.on('exit', (code) => {
    exitedEarly = true;
    earlyCode = code;
  });

  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (exitedEarly) {
      throw new Error(
        `Auto-spawned Vite (${serveMode}) exited prematurely with code ${earlyCode}.\n${logs}`
      );
    }
    const probe = await probeHttpOk(normalizedBase, 1500);
    if (probe.ok) {
      console.log(`${C.green}✔ Auto-spawned Vite (${serveMode}) ready${C.reset} at ${normalizedBase}`);
      return { child, owned: true };
    }
    await sleep(400);
  }

  killProcessTree(child);
  throw new Error(`Timed out waiting 30s for Vite (${serveMode}) at ${normalizedBase}.\n${logs}`);
}

async function runSuiteGroup({ label, tiers, thresholds, tierFilter, concurrency = null, env = {} }) {
  const activeTiers = tiers.filter((t) => !tierFilter || t.id === tierFilter);
  const results = [];
  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalDuration = 0;

  console.log(`${C.bold}${C.magenta}══ ${label} ══${C.reset}\n`);

  for (const tier of activeTiers) {
    process.stdout.write(`${C.cyan}▸ Running ${tier.name}...${C.reset} `);
    const result = await runTier(tier.name, tier.dir, {
      concurrency,
      env,
      excludeDirNames: tier.excludeDirNames || [],
    });
    results.push({ ...result, minExpected: tier.minExpected });
    totalTests += result.testCount;
    totalPassed += result.passCount;
    totalFailed += result.failCount;
    totalDuration += result.durationMs;

    if (result.status === 'PASS') {
      console.log(`${C.green}${C.bold}✔ PASS${C.reset} (${result.testCount} tests in ${result.files} suites, ${result.durationMs}ms)`);
    } else {
      console.log(`${C.red}${C.bold}✖ FAIL${C.reset} (${result.failCount} failed, exit code ${result.exitCode}, ${result.durationMs}ms)`);
      if (result.errorOutput || result.output) {
        console.log(C.dim + (result.output || result.errorOutput) + C.reset);
      }
    }
  }

  const effectiveMinTotal = tierFilter
    ? activeTiers.reduce((acc, t) => acc + t.minExpected, 0)
    : thresholds.minTotal;

  console.log(`\n${C.bold}========================================================================${C.reset}`);
  console.log(`${C.bold}  ${label.toUpperCase()} — TEST EXECUTION SCORECARD${C.reset}`);
  console.log(`${C.bold}========================================================================${C.reset}`);
  console.log(`Tier                                    Suites   Tests    Min Req   Status`);
  console.log(`------------------------------------------------------------------------`);
  for (const r of results) {
    const isPass = r.status === 'PASS' && r.testCount >= r.minExpected;
    const statusCol = isPass
      ? `${C.green}PASS${C.reset}`
      : `${C.red}FAIL (${r.status})${C.reset}`;
    console.log(`${r.name.padEnd(38)} ${String(r.files).padStart(6)}   ${String(r.testCount).padStart(5)}    ${String(r.minExpected).padStart(7)}   ${statusCol}`);
  }
  console.log(`------------------------------------------------------------------------`);
  console.log(`${C.bold}Total Tests Executed : ${totalTests} (Threshold: ≥${effectiveMinTotal})${C.reset}`);
  console.log(`${C.bold}Total Passed         : ${C.green}${totalPassed}${C.reset}`);
  console.log(`${C.bold}Total Failed         : ${totalFailed > 0 ? C.red + totalFailed : C.green + '0'}${C.reset}`);
  console.log(`${C.bold}Total Duration       : ${(totalDuration / 1000).toFixed(2)}s${C.reset}`);
  console.log(`========================================================================\n`);

  const isThresholdMet = totalTests >= effectiveMinTotal;
  const isZeroFailures = totalFailed === 0;
  const allTiersMet = results.every((r) => r.testCount >= r.minExpected && r.status === 'PASS');

  return {
    passed: isThresholdMet && isZeroFailures && allTiersMet,
    totalTests,
    totalPassed,
    totalFailed,
    totalDuration,
  };
}

async function main() {
  console.log(`\n${C.bold}${C.red}╔════════════════════════════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.red}║   🍣  TORI SAKURA JAPANESE DINING — E2E TEST RUNNER  🥢                ║${C.reset}`);
  console.log(`${C.bold}${C.red}║   Requirement-Driven Opaque-Box Verification (Tiers 1-4)               ║${C.reset}`);
  console.log(`${C.bold}${C.red}╚════════════════════════════════════════════════════════════════════════╝${C.reset}\n`);

  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node ./scripts/run-e2e-tests.mjs [--mode=contract|live|all] [--tier=1|2|3|4]');
    process.exit(0);
  }

  const modeArg = args.find((a) => a.startsWith('--mode='))?.split('=')[1] || 'contract';
  const tierFilter = args.find((a) => a.startsWith('--tier='))?.split('=')[1];

  if (!['contract', 'live', 'all'].includes(modeArg)) {
    console.error(`${C.red}Invalid --mode="${modeArg}". Expected contract, live, or all.${C.reset}`);
    process.exit(1);
  }
  if (tierFilter && !['1', '2', '3', '4'].includes(tierFilter)) {
    console.error(`${C.red}Invalid --tier="${tierFilter}". Expected 1, 2, 3, or 4.${C.reset}`);
    process.exit(1);
  }

  const runContract = modeArg === 'contract' || modeArg === 'all';
  const runLive = modeArg === 'live' || modeArg === 'all';

  let contractSummary = null;
  let liveSummary = null;

  if (runContract) {
    const contractTiers = [
      { id: '1', name: 'Tier 1: Contract Features (F1-F17)', dir: join(E2E_ROOT, 'tier1-features'), minExpected: CONTRACT_THRESHOLDS.minTier1, excludeDirNames: ['live'] },
      { id: '2', name: 'Tier 2: Contract Boundaries', dir: join(E2E_ROOT, 'tier2-boundaries'), minExpected: CONTRACT_THRESHOLDS.minTier2, excludeDirNames: ['live'] },
      { id: '3', name: 'Tier 3: Contract Pairwise', dir: join(E2E_ROOT, 'tier3-pairwise'), minExpected: CONTRACT_THRESHOLDS.minTier3, excludeDirNames: ['live'] },
      { id: '4', name: 'Tier 4: Contract Scenarios', dir: join(E2E_ROOT, 'tier4-scenarios'), minExpected: CONTRACT_THRESHOLDS.minTier4, excludeDirNames: ['live'] },
    ];

    contractSummary = await runSuiteGroup({
      label: 'Offline Contract & Build Suite (--mode=contract)',
      tiers: contractTiers,
      thresholds: CONTRACT_THRESHOLDS,
      tierFilter,
    });
  }

  if (runLive) {
    const apiUrl = (process.env.E2E_API_URL || 'http://localhost:5243/api').replace(/\/+$/, '');
    const baseUrl = (process.env.E2E_BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');
    const externalCacheFile = process.env.E2E_SESSION_CACHE_FILE;
    const sessionCacheFile =
      externalCacheFile ||
      join(tmpdir(), `torisakura-e2e-session-${process.pid}-${Date.now()}.json`);

    let serverHandle = { child: null, owned: false };

    const cleanup = () => {
      if (serverHandle.owned && serverHandle.child) {
        killProcessTree(serverHandle.child);
        serverHandle = { child: null, owned: false };
      }
      if (!externalCacheFile && existsSync(sessionCacheFile)) {
        try {
          rmSync(sessionCacheFile, { force: true });
        } catch {
          // Ignore cleanup errors
        }
      }
    };

    const onSignal = (sig) => {
      cleanup();
      process.exit(sig === 'SIGINT' ? 130 : 143);
    };
    process.once('SIGINT', onSignal);
    process.once('SIGTERM', onSignal);

    try {
      await ensureApiReachable(apiUrl);
      serverHandle = await ensureFrontendRunning(baseUrl);

      const liveTiers = [
        { id: '1', name: 'Live Tier 1: Features (F1-F18)', dir: join(LIVE_E2E_ROOT, 'tier1-features'), minExpected: LIVE_THRESHOLDS.minTier1 },
        { id: '2', name: 'Live Tier 2: Boundaries & Security', dir: join(LIVE_E2E_ROOT, 'tier2-boundaries'), minExpected: LIVE_THRESHOLDS.minTier2 },
        { id: '3', name: 'Live Tier 3: Pairwise Interactions', dir: join(LIVE_E2E_ROOT, 'tier3-pairwise'), minExpected: LIVE_THRESHOLDS.minTier3 },
        { id: '4', name: 'Live Tier 4: Real-World Journeys', dir: join(LIVE_E2E_ROOT, 'tier4-scenarios'), minExpected: LIVE_THRESHOLDS.minTier4 },
      ];

      liveSummary = await runSuiteGroup({
        label: 'Live Browser + API + SQL Suite (--mode=live)',
        tiers: liveTiers,
        thresholds: LIVE_THRESHOLDS,
        tierFilter,
        concurrency: 1,
        env: {
          E2E_BASE_URL: baseUrl,
          E2E_API_URL: apiUrl,
          E2E_SESSION_CACHE_FILE: sessionCacheFile,
        },
      });
    } catch (err) {
      console.error(`\n${C.bgRed}  ✖ LIVE PREFLIGHT / EXECUTION ERROR  ${C.reset}\n${C.red}${err.message}${C.reset}\n`);
      liveSummary = { passed: false };
    } finally {
      process.removeListener('SIGINT', onSignal);
      process.removeListener('SIGTERM', onSignal);
      cleanup();
    }
  }

  const allPassed =
    (!runContract || Boolean(contractSummary?.passed)) &&
    (!runLive || Boolean(liveSummary?.passed));

  if (allPassed) {
    console.log(`${C.bgGreen}  ✓ ALL GATES PASSED: Ready for TEST_READY.md publication!  ${C.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${C.bgRed}  ✖ GATE VERIFICATION FAILED! Check failures and test thresholds above.  ${C.reset}\n`);
    process.exit(1);
  }
}

main();
