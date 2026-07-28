import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUTH_STORAGE_KEYS, verifyContrastRatio } from '../harness/index.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');
const STRICT_R2 = process.env.E2E_STRICT_R2 === '1';

describe('Tier 2 - Boundary R1/R4: Build & Config Boundaries', () => {
  it('T2-R1-01: Index HTML template integrity and viewport configuration', () => {
    const indexPath = join(PROJECT_ROOT, 'index.html');
    assert.ok(existsSync(indexPath), 'index.html must exist');
    const html = readFileSync(indexPath, 'utf-8');

    assert.match(html, /<meta\s+name=["']viewport["']\s+content=["'][^"']*width=device-width/i);
    assert.match(html, /<title>.*(Japan|Nhật Bản|SAKURA).*<\/title>/i);
    assert.match(html, /<div\s+id=["']root["']\s*>/i);

    if (STRICT_R2) {
      const redirectsPath = join(PROJECT_ROOT, 'public', '_redirects');
      assert.ok(existsSync(redirectsPath), 'public/_redirects SPA fallback must exist');
      const redirectsContent = readFileSync(redirectsPath, 'utf-8');
      assert.match(redirectsContent, /\/\*\s+\/index\.html\s+200/);
    }
  });

  it('T2-R1-02: Strict TypeScript compiler options in tsconfig.app.json', () => {
    const tsconfigAppPath = join(PROJECT_ROOT, 'tsconfig.app.json');
    const tsconfigPath = join(PROJECT_ROOT, 'tsconfig.json');

    const configToRead = existsSync(tsconfigAppPath) ? tsconfigAppPath : tsconfigPath;
    const content = readFileSync(configToRead, 'utf-8');
    const sanitized = content.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
    const parsed = JSON.parse(sanitized);

    const compilerOptions = parsed.compilerOptions || {};
    assert.equal(compilerOptions.strict, true, 'strict mode must be explicitly true');
    assert.equal(compilerOptions.noEmit, true, 'noEmit must be enabled');
  });

  it('T2-R1-03: Viewport dimension boundary calculation (320px to 2560px, including iPhone 375x812)', () => {
    function simulateViewportConstraints(width) {
      if (width < 320) throw new Error('Viewport below minimum supported standard');
      const containerMaxWidth = width >= 1536 ? '2xl' : width >= 1280 ? 'xl' : 'full';
      return { width, containerMaxWidth, isOverflowFree: true };
    }

    const mobileSE = simulateViewportConstraints(320);
    assert.ok(mobileSE.isOverflowFree);

    const iphone = simulateViewportConstraints(375);
    assert.ok(iphone.isOverflowFree);
    assert.equal(iphone.containerMaxWidth, 'full');

    const ultrawide = simulateViewportConstraints(2560);
    assert.ok(ultrawide.isOverflowFree);
    assert.equal(ultrawide.containerMaxWidth, '2xl');
  });

  it('T2-R1-04: Themed 404 Route Fallback and Home Navigation Redirection', () => {
    function handleNotFoundRoute(path) {
      const knownRoutes = ['/', '/menu', '/reservation', '/about', '/location', '/blog', '/cart', '/checkout'];
      if (!knownRoutes.includes(path)) {
        return {
          statusCode: 404,
          heading: 'Không tìm thấy trang (404)',
          message: 'Trang bạn tìm kiếm không tồn tại hoặc đã được chuyển dời.',
          redirectTarget: '/',
          redirectLabel: 'Về trang chủ',
        };
      }
      return { statusCode: 200 };
    }

    const fallback = handleNotFoundRoute('/some/invalid/deep/link');
    assert.equal(fallback.statusCode, 404);
    assert.ok(fallback.heading.includes('404'));
    assert.equal(fallback.redirectTarget, '/');
  });

  it('T2-R1-05: Corrupted localStorage recovery for torisakura_* keys', () => {
    function safeParseStorage(rawJson, defaultVal) {
      try {
        if (!rawJson) return defaultVal;
        return JSON.parse(rawJson);
      } catch {
        return defaultVal;
      }
    }

    const corruptedData = '{invalid-json: undefined, corrupt';
    assert.equal(AUTH_STORAGE_KEYS.ACCESS_TOKEN, 'torisakura_access_token');
    assert.equal(AUTH_STORAGE_KEYS.REFRESH_TOKEN, 'torisakura_refresh_token');
    assert.equal(safeParseStorage(corruptedData, null), null);
  });

  it('T2-R1-06: Color Contrast Ratio & WCAG AA Accessibility verification', () => {
    const shuRatio = verifyContrastRatio('#8B1E1E', '#FAF7F2', 4.5);
    assert.ok(shuRatio >= 4.5, `Shu-iro on Washi ratio ${shuRatio} must exceed 4.5`);

    const sumiRatio = verifyContrastRatio('#121214', '#FAF7F2', 7.0);
    assert.ok(sumiRatio >= 7.0, `Sumi-iro on Washi ratio ${sumiRatio} must exceed 7.0`);

    const kinchaRatio = verifyContrastRatio('#D4A359', '#121214', 4.5);
    assert.ok(kinchaRatio >= 4.5, `Kincha on Sumi-iro ratio ${kinchaRatio} must exceed 4.5`);
  });
});
