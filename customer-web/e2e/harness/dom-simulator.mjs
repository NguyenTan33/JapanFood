import assert from 'node:assert/strict';

export function assertContainsText(containerText, expectedText, message) {
  assert.ok(
    String(containerText).toLowerCase().includes(String(expectedText).toLowerCase()),
    message || `Expected text "${expectedText}" not found in container: "${containerText.slice(0, 100)}..."`
  );
}

export function assertElementMatchesPattern(htmlString, regex, message) {
  assert.match(htmlString, regex, message || `HTML string did not match expected pattern`);
}

export function assertCssTokens(classString, requiredTokens) {
  for (const token of requiredTokens) {
    assert.ok(
      classString.includes(token),
      `Expected CSS class token "${token}" was missing from class list: "${classString}"`
    );
  }
}

export function parseHexToRgb(hex) {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return { r, g, b };
}

export function calculateRelativeLuminance({ r, g, b }) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function calculateContrastRatio(hex1, hex2) {
  const lum1 = calculateRelativeLuminance(parseHexToRgb(hex1));
  const lum2 = calculateRelativeLuminance(parseHexToRgb(hex2));
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

export function verifyContrastRatio(textColor, backgroundColor, minRatio = 4.5) {
  const ratio = calculateContrastRatio(textColor, backgroundColor);
  assert.ok(
    ratio >= minRatio,
    `Contrast ratio ${ratio.toFixed(2)} between ${textColor} and ${backgroundColor} is below WCAG standard ${minRatio}:1`
  );
  return ratio;
}
