import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PATHS } from './config.mjs';

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

const FORBIDDEN_OPERATIONAL_STORAGE_KEYS = [
  'torisakura_pos_active_shift',
  'torisakura_pos_shift_history',
  'torisakura_pos_tables_state',
  'torisakura_kds_tickets',
  'torisakura_pos_customers',
  'torisakura_pos_alerts',
  'torisakura_user_addresses',
];

const ALLOWLISTED_STORAGE_KEYS = [
  'torisakura_access_token',
  'torisakura_refresh_token',
  'torisakura_user_v2',
  'torisakura_cart_v2',
  'torisakura_dismissed_review_',
  'torisakura_buzz_table_',
];

/**
 * Strip JS/TS comments (//... and /*...* /) while preserving string/template literals
 * and preserving newline characters so reported line numbers remain exact.
 */
export function stripCommentsPreservingLines(source) {
  let out = '';
  const len = source.length;
  let i = 0;

  while (i < len) {
    const ch = source[i];
    const next = source[i + 1];

    // String / template literals
    if (ch === '\'' || ch === '"' || ch === '`') {
      const quote = ch;
      out += ch;
      i += 1;
      while (i < len) {
        const c = source[i];
        out += c;
        if (c === '\\') {
          if (i + 1 < len) {
            out += source[i + 1];
            i += 2;
            continue;
          }
        }
        if (c === quote) {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }

    // Single-line comment //
    if (ch === '/' && next === '/') {
      out += '  ';
      i += 2;
      while (i < len && source[i] !== '\n') {
        out += ' ';
        i += 1;
      }
      continue;
    }

    // Multi-line comment /* ... */
    if (ch === '/' && next === '*') {
      out += '  ';
      i += 2;
      while (i < len) {
        if (source[i] === '*' && source[i + 1] === '/') {
          out += '  ';
          i += 2;
          break;
        }
        out += source[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

function collectSourceFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'artifacts') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(full));
    } else if (entry.isFile() && CODE_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(full);
    }
  }
  results.sort();
  return results;
}

function findMatchesWithLines(stripped, regex) {
  const matches = [];
  const lines = stripped.split(/\r?\n/);
  for (let idx = 0; idx < lines.length; idx += 1) {
    const lineText = lines[idx];
    const re = new RegExp(regex.source, regex.flags.replace('g', ''));
    if (re.test(lineText)) {
      matches.push({
        line: idx + 1,
        snippet: lineText.trim().slice(0, 140),
      });
    }
  }
  return matches;
}

function isAllowlistedStorageLine(lineText) {
  if (/localStorage\.removeItem\(\s*['"]torisakura_(?:user|cart)_v1['"]\s*\)/.test(lineText)) {
    return true;
  }
  return ALLOWLISTED_STORAGE_KEYS.some((k) => lineText.includes(k)) &&
    !FORBIDDEN_OPERATIONAL_STORAGE_KEYS.some((k) => lineText.includes(k));
}

export function scanFrontendHygiene(srcDir = PATHS.CUSTOMER_WEB_SRC_DIR) {
  const findings = [];
  if (!fs.existsSync(srcDir)) {
    findings.push({
      ruleId: 'SRC_DIR_MISSING',
      severity: 'error',
      file: srcDir,
      line: 0,
      snippet: '',
      message: `Frontend source directory not found: ${srcDir}`,
    });
    return { ok: false, scannedFiles: 0, findings };
  }

  // Rule 1a: src/data/mockData.ts (or .tsx/.js/.jsx) must not exist
  for (const ext of CODE_EXTENSIONS) {
    const mockFile = path.join(srcDir, 'data', `mockData${ext}`);
    if (fs.existsSync(mockFile)) {
      findings.push({
        ruleId: 'NO_MOCK_DATA_FILE',
        severity: 'error',
        file: path.relative(srcDir, mockFile).replace(/\\/g, '/'),
        line: 1,
        snippet: `File exists: data/mockData${ext}`,
        message: 'Forbidden mock data file must be removed.',
      });
    }
  }

  const files = collectSourceFiles(srcDir);

  for (const filePath of files) {
    const rel = path.relative(srcDir, filePath).replace(/\\/g, '/');
    const raw = fs.readFileSync(filePath, 'utf8');
    const stripped = stripCommentsPreservingLines(raw);
    const lines = stripped.split(/\r?\n/);

    const pushMatch = (ruleId, line, snippet, message) => {
      findings.push({
        ruleId,
        severity: 'error',
        file: rel,
        line,
        snippet: snippet.trim().slice(0, 140),
        message,
      });
    };

    // Rule 1b: No imports from data/mockData
    for (const m of findMatchesWithLines(stripped, /from\s+['"][^'"]*data\/mockData(?:\.[^'"]*)?['"]/)) {
      pushMatch('NO_MOCK_DATA_FILE', m.line, m.snippet, 'Forbidden import from data/mockData.');
    }

    // Rule 2: No demo role switcher or mock activeUser fallback
    for (const m of findMatchesWithLines(
      stripped,
      /\bhandleRoleChange\b|Quick Role Switcher|Phân Quyền Hiện Tại|activeUser\s*=\s*currentUser\s*\|\|/,
    )) {
      pushMatch('NO_DEMO_ROLE_SWITCHER', m.line, m.snippet, 'Demo role switcher or unauthenticated mock user fallback detected.');
    }

    // Rule 3: No DEMO_TICKETS
    for (const m of findMatchesWithLines(stripped, /\bDEMO_TICKETS\b/)) {
      pushMatch('NO_DEMO_TICKETS', m.line, m.snippet, 'Hardcoded DEMO_TICKETS fallback detected.');
    }

    // Rule 4: No INITIAL_TABLES
    for (const m of findMatchesWithLines(stripped, /\bINITIAL_TABLES\b/)) {
      pushMatch('NO_INITIAL_TABLES', m.line, m.snippet, 'Hardcoded INITIAL_TABLES fallback detected.');
    }

    // Rule 5: No localStorage operational state keys
    for (let idx = 0; idx < lines.length; idx += 1) {
      const lineText = lines[idx];
      if (!lineText.includes('torisakura_')) continue;
      if (isAllowlistedStorageLine(lineText)) continue;

      const matchedKey = FORBIDDEN_OPERATIONAL_STORAGE_KEYS.find((k) => lineText.includes(k));
      if (matchedKey) {
        pushMatch(
          'NO_LOCALSTORAGE_OPERATIONAL_STATE',
          idx + 1,
          lineText,
          `Forbidden operational localStorage key '${matchedKey}' detected.`,
        );
      }
    }

    // Rule 6: No hardcoded voucher codes
    for (const m of findMatchesWithLines(
      stripped,
      /\b(?:SAKURA10|VIP20|SAKURAVIP20|FREESHIP)\b/,
    )) {
      pushMatch('NO_HARDCODED_VOUCHERS', m.line, m.snippet, 'Hardcoded demo voucher code detected.');
    }

    // Rule 7: No "Đã Lên Bàn" POS mark-served button (excluding descriptive "Món Đã Lên Bàn" heading)
    if (rel.startsWith('pages/pos/') || rel.startsWith('components/pos/')) {
      const reportedLines = new Set();
      for (let idx = 0; idx < lines.length; idx += 1) {
        const lineText = lines[idx];
        if (/\bhandleMarkServed\b/.test(lineText)) {
          reportedLines.add(idx + 1);
          pushMatch('NO_POS_MARK_SERVED_BUTTON', idx + 1, lineText, 'Forbidden handleMarkServed action in POS component.');
          continue;
        }
        const hasTagLabel = />\s*Đã\s+Lên\s+Bàn\s*</i.test(lineText);
        const hasQuotedLabel = /['"]\s*Đã\s+Lên\s+Bàn\s*['"]/i.test(lineText);
        if ((hasTagLabel || hasQuotedLabel) && !/Món\s+Đã\s+Lên\s+Bàn/i.test(lineText)) {
          reportedLines.add(idx + 1);
          pushMatch('NO_POS_MARK_SERVED_BUTTON', idx + 1, lineText, 'Forbidden "Đã Lên Bàn" button label in POS UI.');
        }
      }

      // Multiline scan against comment-stripped full-file content
      const lineNumberAt = (index) => {
        let line = 1;
        for (let k = 0; k < index; k += 1) {
          if (stripped[k] === '\n') line += 1;
        }
        return line;
      };

      const multilinePatterns = [
        />\s*Đã\s+Lên\s+Bàn\s*</gi,
        /['"]\s*Đã\s+Lên\s+Bàn\s*['"]/gi,
      ];
      for (const re of multilinePatterns) {
        let match;
        while ((match = re.exec(stripped)) !== null) {
          const innerRel = match[0].search(/Đã/i);
          const daOffset = match.index + (innerRel >= 0 ? innerRel : 0);
          const preceding = stripped.slice(Math.max(0, daOffset - 24), daOffset);
          if (/Món\s+$/i.test(preceding)) continue;
          const line = lineNumberAt(daOffset);
          if (reportedLines.has(line)) continue;
          reportedLines.add(line);
          const compactSnippet = match[0].replace(/\s+/g, ' ');
          pushMatch('NO_POS_MARK_SERVED_BUTTON', line, compactSnippet, 'Forbidden "Đã Lên Bàn" button label in POS UI.');
        }
      }
    }

    // Rule 8: No demo fallback artifacts
    const fallbackRules = [
      { re: /chế độ demo/i, msg: 'Demo-mode notice detected in frontend source.' },
      { re: /\btok_dinein_demo\b/, msg: 'Hardcoded demo dine-in token detected.' },
      { re: /\bdefaultCustomers\b/, msg: 'Hardcoded defaultCustomers fallback detected.' },
      { re: /#ORD-9021|#ORD-8944/, msg: 'Hardcoded demo order history ID detected.' },
      { re: /18\.450\.000/, msg: 'Hardcoded static revenue KPI amount detected.' },
      { re: /Nguyễn Quản Trị\s*\(Admin\)/, msg: 'Hardcoded mock cashier/admin name fallback detected.' },
      { re: /bankId\s*:\s*['"]970422['"]/, msg: 'Hardcoded mock VietQR bankId fallback detected.' },
    ];
    for (const rule of fallbackRules) {
      for (const m of findMatchesWithLines(stripped, rule.re)) {
        pushMatch('NO_DEMO_FALLBACK_ARTIFACTS', m.line, m.snippet, rule.msg);
      }
    }
  }

  return {
    ok: findings.length === 0,
    scannedFiles: files.length,
    findings,
  };
}

export function assertStaticHygieneClean(srcDir = PATHS.CUSTOMER_WEB_SRC_DIR) {
  const result = scanFrontendHygiene(srcDir);
  if (!result.ok) {
    const details = result.findings
      .map((f) => `  - [${f.ruleId}] ${f.file}:${f.line} — ${f.message}${f.snippet ? ` (${f.snippet})` : ''}`)
      .join('\n');
    throw new assert.AssertionError({
      message: `Frontend static hygiene check failed with ${result.findings.length} violation(s) across ${result.scannedFiles} files:\n${details}`,
      operator: 'assertStaticHygieneClean',
    });
  }
  return result;
}

export default {
  stripCommentsPreservingLines,
  scanFrontendHygiene,
  assertStaticHygieneClean,
};
