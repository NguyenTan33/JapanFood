import assert from 'node:assert/strict';

export async function auditHorizontalOverflow(
  page,
  { rootSelector = 'body', tolerancePx = 1 } = {},
) {
  const metrics = await page.evaluate(({ rootSelector: rootSel, tolerancePx: tol }) => {
    const docEl = document.documentElement;
    const docOverflow = docEl.scrollWidth - docEl.clientWidth;
    const violations = [];

    if (docOverflow > tol) {
      violations.push({
        type: 'document-horizontal-overflow',
        scrollWidth: docEl.scrollWidth,
        clientWidth: docEl.clientWidth,
        overflowPx: docOverflow,
      });
    }

    const root = document.querySelector(rootSel) || document.body;
    const containers = root ? [root, ...root.querySelectorAll('main, aside, [role="dialog"]')] : [];
    const seen = new Set();

    for (const el of containers) {
      if (!el || seen.has(el)) continue;
      seen.add(el);
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      if (style.overflowX === 'auto' || style.overflowX === 'scroll') continue;

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      const overflowPx = el.scrollWidth - el.clientWidth;
      if (overflowPx > tol) {
        // Ignore if overflow comes exclusively from an intentional overflow-x-auto descendant (e.g. wide table wrapper)
        const hasScrollChild = Array.from(el.querySelectorAll('*')).some((child) => {
          const cs = window.getComputedStyle(child);
          return (cs.overflowX === 'auto' || cs.overflowX === 'scroll') && child.scrollWidth > child.clientWidth;
        });
        if (!hasScrollChild) {
          violations.push({
            type: 'container-horizontal-overflow',
            tag: el.tagName.toLowerCase(),
            id: el.id || null,
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
            overflowPx,
          });
        }
      }
    }

    return {
      docScrollWidth: docEl.scrollWidth,
      docClientWidth: docEl.clientWidth,
      violations,
    };
  }, { rootSelector, tolerancePx });

  return {
    ok: metrics.violations.length === 0,
    violations: metrics.violations,
    metrics,
  };
}

export async function auditNoOverlappingSiblings(
  page,
  {
    containerSelector = 'main, header, nav, [role="dialog"]',
    itemSelector = 'button, a, select, input, [data-audit-item]',
    minIntersectionPx = 2,
  } = {},
) {
  const metrics = await page.evaluate(
    ({ containerSelector: cSel, itemSelector: iSel, minIntersectionPx: minPx }) => {
      const containers = Array.from(document.querySelectorAll(cSel));
      const violations = [];
      let checkedPairs = 0;

      for (const container of containers) {
        const cStyle = window.getComputedStyle(container);
        if (cStyle.display === 'none' || cStyle.visibility === 'hidden') continue;

        const items = Array.from(container.querySelectorAll(iSel)).filter((el) => {
          const s = window.getComputedStyle(el);
          if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
          const r = el.getBoundingClientRect();
          return r.width > 1 && r.height > 1;
        });

        for (let i = 0; i < items.length; i += 1) {
          for (let j = i + 1; j < items.length; j += 1) {
            const a = items[i];
            const b = items[j];
            if (a.contains(b) || b.contains(a)) continue;

            checkedPairs += 1;
            const ra = a.getBoundingClientRect();
            const rb = b.getBoundingClientRect();

            const overlapX = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
            const overlapY = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);

            if (overlapX > minPx && overlapY > minPx) {
              violations.push({
                type: 'overlapping-elements',
                overlapX: Math.round(overlapX * 10) / 10,
                overlapY: Math.round(overlapY * 10) / 10,
                first: {
                  tag: a.tagName.toLowerCase(),
                  text: (a.innerText || a.getAttribute('aria-label') || '').trim().slice(0, 60),
                  rect: { x: Math.round(ra.x), y: Math.round(ra.y), w: Math.round(ra.width), h: Math.round(ra.height) },
                },
                second: {
                  tag: b.tagName.toLowerCase(),
                  text: (b.innerText || b.getAttribute('aria-label') || '').trim().slice(0, 60),
                  rect: { x: Math.round(rb.x), y: Math.round(rb.y), w: Math.round(rb.width), h: Math.round(rb.height) },
                },
              });
            }
          }
        }
      }

      return { containersScanned: containers.length, checkedPairs, violations };
    },
    { containerSelector, itemSelector, minIntersectionPx },
  );

  return {
    ok: metrics.violations.length === 0,
    violations: metrics.violations,
    metrics,
  };
}

export async function auditNoClippedText(
  page,
  {
    rootSelector = 'body',
    selectors = 'h1,h2,h3,h4,button,a,span,p,th,td,label',
    tolerancePx = 2,
    noTruncate = false,
  } = {},
) {
  const metrics = await page.evaluate(
    ({ rootSelector: rSel, selectors: sel, tolerancePx: tol, noTruncate: disallowEllipsis }) => {
      const root = document.querySelector(rSel) || document.body;
      const vw = window.innerWidth;
      const elements = root ? Array.from(root.querySelectorAll(sel)) : [];
      const violations = [];
      let checked = 0;

      for (const el of elements) {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;

        const text = (el.innerText || '').trim();
        if (!text) continue;

        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        checked += 1;

        // Viewport protrusion check for elements inside visible area
        if (rect.bottom > 0 && rect.top < window.innerHeight) {
          if (rect.right > vw + tol || rect.left < -tol) {
            let containedByAncestor = false;
            let anc = el.parentElement;
            while (anc && anc !== document.body && anc !== document.documentElement) {
              const ancStyle = window.getComputedStyle(anc);
              const ox = ancStyle.overflowX;
              if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') {
                const ancRect = anc.getBoundingClientRect();
                if (ancRect.left >= -tol && ancRect.right <= vw + tol) {
                  containedByAncestor = true;
                  break;
                }
              }
              anc = anc.parentElement;
            }
            if (!containedByAncestor) {
              violations.push({
                type: 'element-protrudes-viewport',
                tag: el.tagName.toLowerCase(),
                text: text.slice(0, 80),
                rect: { left: Math.round(rect.left), right: Math.round(rect.right) },
                viewportWidth: vw,
              });
            }
          }
        }

        const isEllipsisTruncated = style.textOverflow === 'ellipsis' && style.whiteSpace === 'nowrap';
        if ((style.overflowX === 'hidden' || style.overflowX === 'clip') && (!isEllipsisTruncated || disallowEllipsis)) {
          const diffX = el.scrollWidth - el.clientWidth;
          if (diffX > tol) {
            violations.push({
              type: 'clipped-horizontal-text',
              tag: el.tagName.toLowerCase(),
              text: text.slice(0, 80),
              scrollWidth: el.scrollWidth,
              clientWidth: el.clientWidth,
              overflowPx: diffX,
            });
          }
        }

        if (
          (el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button') &&
          (style.overflowY === 'hidden' || style.overflowY === 'clip')
        ) {
          const diffY = el.scrollHeight - el.clientHeight;
          if (diffY > tol) {
            violations.push({
              type: 'clipped-vertical-text',
              tag: el.tagName.toLowerCase(),
              text: text.slice(0, 80),
              scrollHeight: el.scrollHeight,
              clientHeight: el.clientHeight,
              overflowPx: diffY,
            });
          }
        }
      }

      return { checked, violations };
    },
    { rootSelector, selectors, tolerancePx, noTruncate },
  );

  return {
    ok: metrics.violations.length === 0,
    violations: metrics.violations,
    metrics,
  };
}

export async function auditViewportBounds(
  page,
  { selector = '[role="dialog"]', marginPx = 1 } = {},
) {
  const metrics = await page.evaluate(
    ({ selector: sel, marginPx: margin }) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const els = Array.from(document.querySelectorAll(sel));
      const violations = [];

      for (const el of els) {
        const s = window.getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;

        if (r.left < -margin || r.top < -margin || r.right > vw + margin || r.bottom > vh + margin) {
          violations.push({
            type: 'out-of-viewport-bounds',
            selector: sel,
            rect: { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom) },
            viewport: { width: vw, height: vh },
          });
        }
      }
      return { checked: els.length, viewport: { width: vw, height: vh }, violations };
    },
    { selector, marginPx },
  );

  return {
    ok: metrics.violations.length === 0,
    violations: metrics.violations,
    metrics,
  };
}

async function resolveBoundingBox(page, target) {
  if (typeof target === 'string') {
    const loc = page.locator(target).first();
    return loc.boundingBox();
  }
  if (target && typeof target.boundingBox === 'function') {
    return target.boundingBox();
  }
  return null;
}

export async function auditTopRightBadgePosition(
  page,
  cardLocatorOrSelector,
  badgeLocatorOrSelector,
  { minRightBiasRatio = 0.45, tolerancePx = 4 } = {},
) {
  const cardBox = await resolveBoundingBox(page, cardLocatorOrSelector);
  const badgeBox = await resolveBoundingBox(page, badgeLocatorOrSelector);

  const violations = [];
  if (!cardBox) {
    violations.push({ type: 'card-not-visible', message: 'Card boundingBox is null.' });
  }
  if (!badgeBox) {
    violations.push({ type: 'badge-not-visible', message: 'Badge boundingBox is null.' });
  }

  if (cardBox && badgeBox) {
    const cardRight = cardBox.x + cardBox.width;
    const cardBottom = cardBox.y + cardBox.height;
    const badgeRight = badgeBox.x + badgeBox.width;
    const badgeBottom = badgeBox.y + badgeBox.height;
    const cardCenterX = cardBox.x + cardBox.width / 2;
    const cardCenterY = cardBox.y + cardBox.height / 2;
    const badgeCenterX = badgeBox.x + badgeBox.width / 2;
    const badgeCenterY = badgeBox.y + badgeBox.height / 2;

    if (
      badgeBox.x < cardBox.x - tolerancePx ||
      badgeBox.y < cardBox.y - tolerancePx ||
      badgeRight > cardRight + tolerancePx ||
      badgeBottom > cardBottom + tolerancePx
    ) {
      violations.push({
        type: 'badge-outside-card',
        cardBox,
        badgeBox,
      });
    }

    if (badgeCenterY >= cardCenterY) {
      violations.push({
        type: 'badge-not-in-top-half',
        badgeCenterY,
        cardCenterY,
      });
    }

    const minX = cardBox.x + cardBox.width * minRightBiasRatio;
    const rightMargin = cardRight - badgeRight;
    const leftMargin = badgeBox.x - cardBox.x;
    if (badgeCenterX < minX || rightMargin > leftMargin + tolerancePx || badgeCenterX < cardCenterX * 0.9) {
      violations.push({
        type: 'badge-not-in-top-right',
        badgeCenterX,
        minRightX: minX,
        leftMargin,
        rightMargin,
      });
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    metrics: { cardBox, badgeBox },
  };
}

export async function auditImagesLoaded(page, rootSelector = 'main') {
  const metrics = await page.evaluate((rSel) => {
    const root = document.querySelector(rSel) || document.body;
    const imgs = root ? Array.from(root.querySelectorAll('img')) : [];
    const violations = [];
    let checked = 0;

    for (const img of imgs) {
      const s = window.getComputedStyle(img);
      if (s.display === 'none' || s.visibility === 'hidden') continue;
      const r = img.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;

      checked += 1;
      if (!img.complete || img.naturalWidth === 0) {
        violations.push({
          type: 'broken-image',
          src: img.getAttribute('src') || '',
          alt: img.getAttribute('alt') || '',
        });
      }
    }

    return { checked, violations };
  }, rootSelector);

  return {
    ok: metrics.violations.length === 0,
    violations: metrics.violations,
    metrics,
  };
}

export async function runFullLayoutAudit(
  page,
  {
    rootSelector = 'main',
    cardContainerSelector,
    cardSelector,
    interactiveContainerSelectors = 'main, header, nav, [role="dialog"]',
    checkDialogs = true,
    noTruncate = false,
  } = {},
) {
  const overflow = await auditHorizontalOverflow(page, { rootSelector: 'body' });
  const overlap = await auditNoOverlappingSiblings(page, {
    containerSelector: interactiveContainerSelectors,
  });
  const cardOverlap =
    cardContainerSelector && cardSelector
      ? await auditNoOverlappingSiblings(page, {
          containerSelector: cardContainerSelector,
          itemSelector: cardSelector,
        })
      : { ok: true, violations: [], metrics: {} };
  const clipped = await auditNoClippedText(page, { rootSelector, noTruncate });
  const dialogs = checkDialogs
    ? await auditViewportBounds(page, { selector: '[role="dialog"]' })
    : { ok: true, violations: [], metrics: {} };
  const images = await auditImagesLoaded(page, rootSelector);

  const violations = [
    ...overflow.violations,
    ...overlap.violations,
    ...cardOverlap.violations,
    ...clipped.violations,
    ...dialogs.violations,
    ...images.violations,
  ];

  return {
    ok: violations.length === 0,
    violations,
    metrics: {
      overflow: overflow.metrics,
      overlap: overlap.metrics,
      cardOverlap: cardOverlap.metrics,
      clipped: clipped.metrics,
      dialogs: dialogs.metrics,
      images: images.metrics,
    },
  };
}

export function assertLayoutClean(result, label = 'Layout audit') {
  if (!result || !result.ok) {
    const violations = result?.violations || [];
    const summary = violations
      .slice(0, 10)
      .map((v) => `  - ${v.type}: ${JSON.stringify(v)}`)
      .join('\n');
    throw new assert.AssertionError({
      message: `${label} failed with ${violations.length} layout violation(s):\n${summary}`,
      operator: 'assertLayoutClean',
    });
  }
  return result;
}

export default {
  auditHorizontalOverflow,
  auditNoOverlappingSiblings,
  auditNoClippedText,
  auditViewportBounds,
  auditTopRightBadgePosition,
  auditImagesLoaded,
  runFullLayoutAudit,
  assertLayoutClean,
};
