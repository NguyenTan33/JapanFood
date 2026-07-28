# JapanFood E2E Test Suite (`e2e-suite`)

Standalone, requirement-driven opaque-box End-to-End (E2E) test harness for the JapanFood POS, KDS, and SQL Server operational system. Kept completely isolated from `F&B/` and `customer-web/`.

## Prerequisites

- **Node.js**: `>= 20` (verified on `v24.12.0`).
- **Playwright**: `playwright-core` (`^1.65.1`). `lib/browser.mjs` automatically resolves `playwright-core` locally, from `../customer-web/node_modules/playwright-core`, or from the npm `_npx` cache, and launches system Chrome or Microsoft Edge (with fake camera flags for webcam tests).
- **Live Servers** (required for live test execution, not for `--list` or `--dry-run`):
  - Backend `.NET 9` API running at `http://localhost:5243/api`
  - Frontend Vite SPA running at `http://localhost:5173`

## Directory Structure

```text
e2e-suite/
├── package.json              # ESM manifest & npm scripts
├── .gitignore                # Ignores artifacts/ and node_modules/
├── run-all.mjs               # Unified CLI runner & JSON/console reporter
├── README.md
├── fixtures/
│   └── sample-receipt.png    # Valid 16x16 RGBA PNG for cash-drawer withdrawal uploads
├── lib/
│   ├── config.mjs            # URLs, seeded credentials, timeouts, viewports, paths
│   ├── test-registry.mjs     # Test discovery, meta contract validation, runner hooks
│   ├── api-client.mjs        # Zero-dep fetch client, JWT session cache, multipart upload
│   ├── browser.mjs           # Playwright launcher, print() spy, camera/upload, telemetry
│   ├── layout-audit.mjs      # DOM geometry checks (overflow, overlap, clipping, badges)
│   ├── static-hygiene.mjs    # Read-only scanner forbidding mockData/demo/localStorage state
│   ├── assertions.mjs        # HTTP, JSON shape, VND currency, print, eventual assertions
│   └── test-data.mjs         # Unique IDs, PNG generator, shift/table/cleanup helpers
├── tests/
│   ├── tier1/                # F1–F11 core feature verification
│   ├── tier2/                # F1–F11 boundary & viewport stress cases
│   ├── tier3/                # Pairwise cross-feature integration suites
│   └── tier4/                # Full-day real-world restaurant operational scenarios
└── artifacts/                # Runtime failure screenshots & JSON reports (gitignored)
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `E2E_WEB_URL` | `http://localhost:5173` | Frontend SPA base URL |
| `E2E_API_URL` | `http://localhost:5243/api` | Backend API base URL (without `/v1/`) |
| `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` | `admin@japanfood.vn` / `Admin@123456` | Seeded Admin credentials |
| `E2E_MANAGER_EMAIL` / `E2E_MANAGER_PASSWORD` | `manager@japanfood.vn` / `Manager@123456` | Seeded Manager credentials |
| `E2E_STAFF_EMAIL` / `E2E_STAFF_PASSWORD` | `staff@japanfood.vn` / `Staff@123456` | Seeded Staff credentials |
| `E2E_CUSTOMER_EMAIL` / `E2E_CUSTOMER_PASSWORD` | `customer@japanfood.vn` / `Customer@123456` | Seeded Customer credentials |
| `E2E_BROWSER_CHANNEL` | `msedge` | Browser channel preference (`chrome`, `msedge`) |
| `E2E_EXECUTABLE_PATH` / `CHROME_PATH` | *(unset)* | Explicit browser executable override |
| `E2E_HEADLESS` | `1` (`!= '0'`) | Set `E2E_HEADLESS=0` for headed browser debugging |

## CLI Usage

```bash
# Discover and validate test modules without starting servers
node ./run-all.mjs --list

# Offline readiness: node --check, contract validation, PNG fixture, Playwright, static hygiene diagnostics
node ./run-all.mjs --dry-run --json=./artifacts/dry-run.json

# Run live tests (all tiers, or filtered by tier / substring)
node ./run-all.mjs
node ./run-all.mjs --tier=1
node ./run-all.mjs --tier=2 --filter=kds --bail
node ./run-all.mjs --json=./artifacts/results.json
```

## Test Module Contract (`*.test.mjs`)

Every file under `tests/tier{1,2,3,4}/` must export `meta` and `registerTests(suite)`:

```js
export const meta = {
  id: 't1-01-auth-rbac-no-mock',
  tier: 1, // 1 | 2 | 3 | 4
  feature: 'F1',
  title: 'Real Auth, RBAC & Zero Demo Artifacts',
};

export function registerTests(suite) {
  suite.test('T1-F1-01: ...', { feature: 'F1', tags: ['api', 'ui'] }, async (ctx) => {
    // ctx: { config, api, browser, newPage, withPage, loginAs, assert, staticHygiene, layoutAudit, fixtures, testData, cleanup }
  });
}
```

### Context Helpers (`ctx`)

- `const { page, context, telemetry, close } = await ctx.newPage(options)` — Opens an isolated Playwright browser context and page with `window.print()` spy and telemetry collectors (`consoleErrors`, `pageErrors`, `requestFailed`, `serverErrors`, `httpErrors`). Auto-closed in test cleanup, or manually via `await close()`.
- `await ctx.loginAs(page, role)` — Injects real JWT session tokens into `localStorage` on the Playwright `page` (pass `handle.page`, e.g., `await ctx.loginAs(page, 'ADMIN')`). Calling `await ctx.loginAs('ADMIN')` with a role string returns an authenticated API client (`apiClient.asRole('ADMIN')`).
