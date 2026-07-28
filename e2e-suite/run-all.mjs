import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import config, { API_ORIGIN, API_URL, PATHS, TIMEOUTS, WEB_URL } from './lib/config.mjs';
import apiClient from './lib/api-client.mjs';
import browserLib from './lib/browser.mjs';
import assertions from './lib/assertions.mjs';
import staticHygiene from './lib/static-hygiene.mjs';
import layoutAudit from './lib/layout-audit.mjs';
import testData, { fixtures } from './lib/test-data.mjs';
import { discoverTestFiles, SuiteRegistry } from './lib/test-registry.mjs';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function parseArgs(argv) {
  const opts = {
    list: false,
    dryRun: false,
    tier: null,
    filter: null,
    jsonPath: null,
    bail: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--list') {
      opts.list = true;
    } else if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--bail') {
      opts.bail = true;
    } else if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg.startsWith('--tier=')) {
      opts.tier = arg.slice('--tier='.length);
    } else if (arg === '--tier') {
      opts.tier = argv[i + 1] ?? '';
      i += 1;
    } else if (arg.startsWith('--filter=')) {
      opts.filter = arg.slice('--filter='.length);
    } else if (arg === '--filter') {
      opts.filter = argv[i + 1] ?? '';
      i += 1;
    } else if (arg.startsWith('--json=')) {
      opts.jsonPath = arg.slice('--json='.length);
    } else if (arg === '--json') {
      opts.jsonPath = argv[i + 1] ?? '';
      i += 1;
    } else {
      throw new Error(`Unknown CLI argument: ${arg}. Pass --help for usage.`);
    }
  }

  if (opts.tier !== null && !['1', '2', '3', '4'].includes(String(opts.tier))) {
    throw new Error(`Invalid --tier value '${opts.tier}'. Expected 1, 2, 3, or 4.`);
  }

  return opts;
}

function printHelp() {
  console.log(`JapanFood E2E Suite Runner

Usage:
  node ./run-all.mjs [options]

Options:
  --list              Discover and validate test modules, print counts by tier/feature (no live servers)
  --dry-run           Run syntax check, contract validation, fixture/Playwright check, and static hygiene diagnostics
  --tier=1|2|3|4      Filter tests by tier (1=Feature, 2=Boundary, 3=Pairwise, 4=Scenarios)
  --filter=<pattern>  Case-insensitive substring match against test ID, name, feature, or tags
  --json=<path>       Write machine-readable JSON report to <path>
  --bail              Stop executing after the first failed test
  --help, -h          Show this help message
`);
}

function writeJsonReport(jsonPath, payload) {
  if (!jsonPath) return;
  const resolved = path.resolve(jsonPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`JSON report written: ${resolved}`);
}

async function loadRegistry({ tier } = {}) {
  const discovered = discoverTestFiles(PATHS.TESTS_DIR, { tier });
  const registry = new SuiteRegistry();
  for (const { filePath, expectedTier } of discovered) {
    const mod = await import(pathToFileURL(filePath).href);
    registry.registerModule(mod, filePath, expectedTier);
  }
  return { discovered, registry };
}

function collectLibMjsFiles() {
  const libDir = path.join(PATHS.SUITE_ROOT, 'lib');
  if (!fs.existsSync(libDir)) return [];
  return fs
    .readdirSync(libDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.mjs'))
    .map((e) => path.join(libDir, e.name))
    .sort();
}

function verifySampleReceiptFixture() {
  const fixturePath = PATHS.SAMPLE_RECEIPT_PATH;
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Missing required PNG fixture: ${fixturePath}`);
  }
  const buf = fs.readFileSync(fixturePath);
  if (buf.length < 32) {
    throw new Error(`PNG fixture too small (${buf.length} bytes): ${fixturePath}`);
  }
  if (!buf.subarray(0, 8).equals(PNG_MAGIC)) {
    throw new Error(`Invalid PNG magic header in fixture: ${fixturePath}`);
  }
  return { path: fixturePath, bytes: buf.length };
}

async function probeUrl(url) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(TIMEOUTS.serverProbeMs),
    });
    return { ok: res.status < 500, status: res.status, url };
  } catch (err) {
    return { ok: false, status: 0, url, error: err?.message || String(err) };
  }
}

async function ensureLiveServersReachable() {
  const apiCandidates = [
    `${API_ORIGIN}/health`,
    `${API_URL}/menu/categories`,
    `${API_URL}/reservations/areas`,
  ];
  let apiOk = null;
  const apiErrors = [];
  for (const url of apiCandidates) {
    const res = await probeUrl(url);
    if (res.ok) {
      apiOk = res;
      break;
    }
    apiErrors.push(`${url} -> ${res.status || res.error}`);
  }

  if (!apiOk) {
    throw new Error(
      `Backend API is not reachable at ${API_URL}. Probes failed:\n  - ${apiErrors.join('\n  - ')}`,
    );
  }

  const webRes = await probeUrl(`${WEB_URL}/`);
  if (!webRes.ok) {
    throw new Error(
      `Frontend web app is not reachable at ${WEB_URL} (${webRes.status || webRes.error}).`,
    );
  }

  return { api: apiOk, web: webRes };
}

async function runListMode(opts) {
  const { discovered, registry } = await loadRegistry({ tier: opts.tier });
  const tests = registry.filterTests({ tier: opts.tier, filter: opts.filter });
  const summary = registry.getSummaryCounts(tests);

  console.log(`Discovered ${discovered.length} test file(s), ${summary.total} matching test(s):`);
  console.log(`  Tier counts: T1=${summary.byTier[1] || 0}, T2=${summary.byTier[2] || 0}, T3=${summary.byTier[3] || 0}, T4=${summary.byTier[4] || 0}`);
  const featureKeys = Object.keys(summary.byFeature).sort();
  if (featureKeys.length > 0) {
    console.log(
      `  Feature counts: ${featureKeys.map((k) => `${k}=${summary.byFeature[k]}`).join(', ')}`,
    );
  }

  for (const t of tests) {
    console.log(`  [T${t.tier}][${t.feature}] ${t.id} — ${t.name}`);
  }

  if (opts.jsonPath) {
    writeJsonReport(opts.jsonPath, {
      mode: 'list',
      timestamp: new Date().toISOString(),
      discoveredFiles: discovered.map((d) => path.relative(PATHS.SUITE_ROOT, d.filePath)),
      summary,
      tests: tests.map((t) => ({
        id: t.id,
        name: t.name,
        tier: t.tier,
        feature: t.feature,
        tags: t.tags,
        filePath: path.relative(PATHS.SUITE_ROOT, t.filePath),
      })),
    });
  }

  return 0;
}

async function runDryRunMode(opts) {
  const runAllPath = path.join(PATHS.SUITE_ROOT, 'run-all.mjs');
  const libFiles = collectLibMjsFiles();
  const discovered = discoverTestFiles(PATHS.TESTS_DIR, { tier: opts.tier });
  const filesToCheck = [runAllPath, ...libFiles, ...discovered.map((d) => d.filePath)];

  console.log(`[dry-run] Running node --check on ${filesToCheck.length} ESM file(s)...`);
  for (const file of filesToCheck) {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  }
  console.log(`[dry-run] Syntax check passed (${filesToCheck.length} files).`);

  const registry = new SuiteRegistry();
  for (const { filePath, expectedTier } of discovered) {
    const mod = await import(pathToFileURL(filePath).href);
    registry.registerModule(mod, filePath, expectedTier);
  }
  const tests = registry.filterTests({ tier: opts.tier, filter: opts.filter });
  const summary = registry.getSummaryCounts(tests);
  console.log(
    `[dry-run] Test contract validation passed: ${discovered.length} file(s), ${summary.total} test(s).`,
  );

  const fixtureInfo = verifySampleReceiptFixture();
  console.log(
    `[dry-run] PNG fixture verified: ${path.relative(PATHS.SUITE_ROOT, fixtureInfo.path)} (${fixtureInfo.bytes} bytes).`,
  );

  const pwSource = await browserLib.resolvePlaywrightSource();
  console.log(`[dry-run] Playwright resolved: ${pwSource}`);

  const hygiene = staticHygiene.scanFrontendHygiene(PATHS.CUSTOMER_WEB_SRC_DIR);
  console.log(
    `[dry-run] Static hygiene diagnostic (non-blocking): scanned ${hygiene.scannedFiles} file(s), ${hygiene.findings.length} finding(s).`,
  );
  if (hygiene.findings.length > 0) {
    for (const f of hygiene.findings.slice(0, 15)) {
      console.log(`  - [${f.ruleId}] ${f.file}:${f.line} — ${f.message}`);
    }
    if (hygiene.findings.length > 15) {
      console.log(`  ... and ${hygiene.findings.length - 15} more finding(s).`);
    }
  }

  if (opts.jsonPath) {
    writeJsonReport(opts.jsonPath, {
      mode: 'dry-run',
      timestamp: new Date().toISOString(),
      syntaxCheckedFiles: filesToCheck.map((f) => path.relative(PATHS.SUITE_ROOT, f)),
      summary,
      fixture: {
        path: path.relative(PATHS.SUITE_ROOT, fixtureInfo.path),
        bytes: fixtureInfo.bytes,
        validPngHeader: true,
      },
      playwrightSource: pwSource,
      staticHygieneDiagnostic: hygiene,
    });
  }

  return 0;
}

async function runLiveMode(opts) {
  const { registry } = await loadRegistry({ tier: opts.tier });
  const selected = registry.filterTests({ tier: opts.tier, filter: opts.filter });

  if (selected.length === 0) {
    console.error(
      `No matching tests found (tier=${opts.tier ?? 'all'}, filter=${opts.filter ?? 'none'}). Refusing false-green exit 0.`,
    );
    return 1;
  }

  const probes = await ensureLiveServersReachable();
  console.log(
    `Live servers reachable: API (${probes.api.url} -> ${probes.api.status}), Web (${probes.web.url} -> ${probes.web.status}).`,
  );
  console.log(`Running ${selected.length} test(s) sequentially...`);

  let report;
  try {
    report = await registry.run({
      tier: opts.tier,
      filter: opts.filter,
      bail: opts.bail,
      contextFactory: async ({ test, cleanup }) => {
        const openedPages = [];

        const trackedNewPage = async (options = {}) => {
          const handle = await browserLib.newPage({
            screenshotLabel: test ? `fail-${test.id}` : 'fail-suite',
            ...options,
          });
          openedPages.push(handle);
          cleanup.add(`close browser context (${test?.id || 'suite'})`, async () => {
            await handle.close();
          });
          return handle;
        };

        const trackedWithPage = async (optionsOrFn, maybeFn) => {
          const hasOpts = typeof optionsOrFn !== 'function';
          const options = hasOpts ? { screenshotLabel: test ? `fail-${test.id}` : 'fail-suite', ...optionsOrFn } : { screenshotLabel: test ? `fail-${test.id}` : 'fail-suite' };
          const fn = hasOpts ? maybeFn : optionsOrFn;
          return browserLib.withPage(options, fn);
        };

        return {
          config,
          api: apiClient,
          browser: browserLib,
          newPage: trackedNewPage,
          withPage: trackedWithPage,
          loginAs: async (roleOrPage, maybeRole) => {
            if (typeof roleOrPage === 'string') {
              return apiClient.asRole(roleOrPage);
            }
            return browserLib.loginInBrowser(roleOrPage, maybeRole);
          },
          assert: assertions,
          staticHygiene,
          layoutAudit,
          fixtures,
          testData,
          cleanup,
          cleanupRegistry: cleanup,
          _openedPages: openedPages,
        };
      },
      onTestStart: (test) => {
        console.log(`-> [T${test.tier}][${test.feature}] ${test.id}: ${test.name}`);
      },
      onTestFailure: async (test, err, ctx) => {
        const shots = [];
        const pages = ctx?._openedPages || [];
        for (let i = 0; i < pages.length; i += 1) {
          const handle = pages[i];
          try {
            if (handle?.page && !handle.page.isClosed()) {
              const p = await browserLib.captureScreenshot(
                handle.page,
                `fail-${test.id}-${i + 1}`,
                { fullPage: true },
              );
              shots.push(p);
            }
          } catch {
            // ignore closed/crashed page screenshot failures
          }
        }
        return shots;
      },
      onTestEnd: (res) => {
        const badge = res.status === 'passed' ? 'PASS' : res.status === 'skipped' ? 'SKIP' : 'FAIL';
        console.log(`   [${badge}] ${res.id} (${res.durationMs}ms)`);
        if (res.error) {
          console.error(`     Error: ${res.error.message}`);
        }
        if (res.artifacts && res.artifacts.length > 0) {
          console.error(`     Artifacts: ${res.artifacts.join(', ')}`);
        }
      },
    });
  } finally {
    await browserLib.closeBrowser();
  }

  console.log('\n=== E2E Execution Summary ===');
  console.log(
    `Total: ${report.totals.total} | Passed: ${report.totals.passed} | Failed: ${report.totals.failed} | Skipped: ${report.totals.skipped} | Duration: ${report.durationMs}ms`,
  );

  if (opts.jsonPath) {
    writeJsonReport(opts.jsonPath, report);
  }

  if (report.totals.failed === 0 && report.totals.passed > 0) {
    return 0;
  }
  return 1;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  let exitCode = 1;
  if (opts.list) {
    exitCode = await runListMode(opts);
  } else if (opts.dryRun) {
    exitCode = await runDryRunMode(opts);
  } else {
    exitCode = await runLiveMode(opts);
  }
  process.exit(exitCode);
}

main().catch((err) => {
  console.error(`[e2e-runner] Fatal error: ${err?.stack || err?.message || String(err)}`);
  process.exit(1);
});
