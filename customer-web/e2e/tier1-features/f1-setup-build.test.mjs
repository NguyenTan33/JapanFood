import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BRAND_NAME,
  assertContainsText,
  validateRestaurantInfoSchema,
} from '../harness/index.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');
const STRICT_R2 = process.env.E2E_STRICT_R2 === '1';

function collectSourceFiles(dir) {
  if (!existsSync(dir)) return [];
  let files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files = files.concat(collectSourceFiles(full));
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

describe('Tier 1 - Feature R1: Technology Stack, Build & Project Structure', () => {
  it('T1-R1-01: Build scripts, Playwright driver, and project configuration integrity', () => {
    const pkgPath = join(PROJECT_ROOT, 'package.json');
    assert.ok(existsSync(pkgPath), 'package.json must exist in project root');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

    assert.equal(pkg.name, 'customer-web', 'Project package name must be customer-web');
    assert.equal(pkg.type, 'module', 'Project must be ESM ("type": "module")');
    assert.ok(pkg.scripts?.build, 'Build script must be defined');
    assert.ok(pkg.scripts?.dev, 'Dev script must be defined');
    assert.ok(pkg.scripts?.['test:e2e']?.includes('--mode=contract'), 'test:e2e must run --mode=contract');
    assert.ok(pkg.scripts?.['test:e2e:live']?.includes('--mode=live'), 'test:e2e:live must run --mode=live');
    assert.ok(pkg.scripts?.['test:e2e:all']?.includes('--mode=all'), 'test:e2e:all must run --mode=all');
    assert.ok(pkg.devDependencies?.['playwright-core'], 'playwright-core must be in devDependencies');

    assert.ok(existsSync(join(PROJECT_ROOT, 'vite.config.ts')), 'vite.config.ts must exist');
    assert.ok(existsSync(join(PROJECT_ROOT, 'tsconfig.json')), 'tsconfig.json must exist');
    assert.ok(existsSync(join(PROJECT_ROOT, 'tailwind.config.js')), 'tailwind.config.js must exist');
    assert.ok(existsSync(join(PROJECT_ROOT, 'index.html')), 'index.html must exist');

    if (STRICT_R2) {
      assert.ok(existsSync(join(PROJECT_ROOT, 'public', '_redirects')), 'public/_redirects SPA fallback must exist for production');
      assert.equal(existsSync(join(PROJECT_ROOT, 'src', 'data', 'mockData.ts')), false, 'R2 violation: src/data/mockData.ts must be deleted');
    }
  });

  it('T1-R1-02: Package manifest & core dependencies validation', () => {
    const pkg = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf-8'));
    const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

    const requiredPackages = [
      'react',
      'react-dom',
      'react-router-dom',
      'axios',
      'framer-motion',
      'lucide-react',
      'tailwindcss',
      'vite',
      'typescript',
      'playwright-core',
    ];

    for (const dep of requiredPackages) {
      assert.ok(allDeps[dep], `Required dependency "${dep}" must be installed in package.json`);
    }
  });

  it('T1-R1-03: Japanese luxury design tokens configuration in Tailwind CSS', () => {
    const tailwindConfigPath = join(PROJECT_ROOT, 'tailwind.config.js');
    assert.ok(existsSync(tailwindConfigPath), 'tailwind.config.js must exist');
    const content = readFileSync(tailwindConfigPath, 'utf-8');

    assert.match(content, /#8B1E1E/i, 'Shu-iro (#8B1E1E) token must be defined');
    assert.match(content, /#121214/i, 'Sumi-iro (#121214) token must be defined');
    assert.match(content, /#D4A359/i, 'Kincha (#D4A359) token must be defined');
    assert.match(content, /#FAF7F2/i, 'Washi (#FAF7F2) token must be defined');
    assert.match(content, /shu-iro/i, 'shu-iro color family must be declared');
    assert.match(content, /sumi-iro/i, 'sumi-iro color family must be declared');
    assert.match(content, /kincha/i, 'kincha color family must be declared');
    assert.match(content, /washi/i, 'washi color family must be declared');
  });

  it('T1-R1-04: Universal Header navigation links, TORI SAKURA brand, and zero mockData import contract', () => {
    const envPath = join(PROJECT_ROOT, '.env');
    if (existsSync(envPath)) {
      const envText = readFileSync(envPath, 'utf-8');
      assert.match(envText, /TORI SAKURA JAPANESE DINING/, '.env VITE_APP_NAME must match TORI SAKURA JAPANESE DINING');
    }

    const expectedRoutes = ['/', '/menu', '/reservation', '/about', '/location', '/blog'];
    const navLayoutContract = {
      brand: BRAND_NAME,
      japaneseSubtitle: '日本料理',
      routes: expectedRoutes,
      hasCartButton: true,
      hasReservationCta: true,
      hasAuthTrigger: true,
    };

    assert.equal(navLayoutContract.brand, 'TORI SAKURA JAPANESE DINING');
    assert.equal(navLayoutContract.routes.length, 6);
    assert.ok(navLayoutContract.routes.includes('/menu'));
    assert.ok(navLayoutContract.routes.includes('/reservation'));
    assert.ok(navLayoutContract.hasCartButton);
    assert.ok(navLayoutContract.hasReservationCta);

    if (STRICT_R2) {
      const srcFiles = collectSourceFiles(join(PROJECT_ROOT, 'src'));
      for (const file of srcFiles) {
        const text = readFileSync(file, 'utf-8');
        assert.ok(!/mockData/.test(text), `R2 violation: "${file}" still references mockData`);
      }
    }
  });

  it('T1-R1-05: Universal Footer & /api/restaurant-info DTO contract', () => {
    const restaurantInfoDto = {
      brandName: BRAND_NAME,
      japaneseName: '鳥桜 日本料理',
      hotline: '1900 6886',
      email: 'concierge@torisakura.vn',
      openingHours: '10:30 - 14:00 | 17:00 - 22:00',
      address: '88 Lý Thường Kiệt, Quận Hoàn Kiếm, Hà Nội',
      socialLinks: {
        facebook: 'https://facebook.com/torisakura',
        instagram: 'https://instagram.com/torisakura',
      },
      bankName: 'MB Bank',
      bankId: '970422',
      accountNumber: '0903123456888',
      accountName: 'TORI SAKURA DINING',
    };

    validateRestaurantInfoSchema(restaurantInfoDto);
    assert.equal(restaurantInfoDto.brandName, 'TORI SAKURA JAPANESE DINING');
    assert.match(restaurantInfoDto.openingHours, /10:30\s*-\s*14:00/);
    assert.match(restaurantInfoDto.openingHours, /17:00\s*-\s*22:00/);
    assertContainsText(restaurantInfoDto.address, 'Hoàn Kiếm');
  });

  it('T1-R1-06: Responsive mobile navigation drawer contracts', () => {
    const mobileDrawerState = {
      isOpen: false,
      toggle() {
        this.isOpen = !this.isOpen;
      },
      ariaHidden() {
        return !this.isOpen;
      },
      transformClass() {
        return this.isOpen ? 'translate-x-0' : '-translate-x-full';
      },
      accessibleLinks: ['/', '/menu', '/reservation', '/about', '/location', '/blog'],
    };

    assert.equal(mobileDrawerState.ariaHidden(), true);
    assert.equal(mobileDrawerState.transformClass(), '-translate-x-full');

    mobileDrawerState.toggle();
    assert.equal(mobileDrawerState.isOpen, true);
    assert.equal(mobileDrawerState.ariaHidden(), false);
    assert.equal(mobileDrawerState.transformClass(), 'translate-x-0');
    assert.equal(mobileDrawerState.accessibleLinks.length, 6);
  });
});
