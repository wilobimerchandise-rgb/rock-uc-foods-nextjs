import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/usr/local/share/bun-global/node_modules/playwright-core');

const BASE_URL = process.env.RUC_TEST_URL || 'http://127.0.0.1:3000/';
const CHROME_BIN =
  process.env.CHROME_BIN ||
  '/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell';

const VIEWPORTS = [375, 390, 768, 1280];
const SCHEMES = (process.env.RUC_AUDIT_SCHEMES || 'dark,light')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter((s) => s === 'dark' || s === 'light');
const AUDIT_GROUP = (process.env.RUC_AUDIT_GROUP || 'all').trim().toLowerCase();

async function auditPage(page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    function parseCssColor(colorStr) {
      if (!colorStr || colorStr === 'transparent' || colorStr === 'rgba(0, 0, 0, 0)') {
        return [0, 0, 0, 0];
      }
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000000';
      ctx.fillStyle = colorStr;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return [r, g, b, a / 255];
    }

    function compositeOver(fg, bg) {
      const a = fg[3];
      return [
        Math.round(fg[0] * a + bg[0] * (1 - a)),
        Math.round(fg[1] * a + bg[1] * (1 - a)),
        Math.round(fg[2] * a + bg[2] * (1 - a)),
        1,
      ];
    }

    function getEffectiveBg(el) {
      const chain = [];
      let cur = el;
      while (cur && cur.nodeType === 1) {
        chain.unshift(cur);
        cur = cur.parentElement;
      }
      const rootDark = window.matchMedia('(prefers-color-scheme: light)').matches
        ? [247, 239, 217, 1]
        : [11, 10, 9, 1];
      let bg = rootDark;
      for (const node of chain) {
        const c = parseCssColor(getComputedStyle(node).backgroundColor);
        if (c[3] > 0.01) {
          bg = compositeOver(c, bg);
        }
      }
      return bg;
    }

    function relLuminance([r, g, b]) {
      const f = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    }

    function contrastRatio(c1, c2) {
      const l1 = relLuminance(c1);
      const l2 = relLuminance(c2);
      const hi = Math.max(l1, l2);
      const lo = Math.min(l1, l2);
      return (hi + 0.05) / (lo + 0.05);
    }

    function isVisible(el) {
      let cur = el;
      while (cur && cur.nodeType === 1) {
        const st = getComputedStyle(cur);
        if (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity) === 0) {
          return false;
        }
        cur = cur.parentElement;
      }
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    const scrollW = document.documentElement.scrollWidth;
    const innerW = window.innerWidth;
    const bodyBg = getComputedStyle(document.body).backgroundColor;
    const parsedBodyBg = parseCssColor(bodyBg);

    const smallControls = [];
    const controls = document.querySelectorAll('a, button, input, select, textarea');
    for (const el of controls) {
      if (!isVisible(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 43.5 || rect.height < 43.5) {
        smallControls.push({
          tag: el.tagName,
          text: (el.innerText || el.getAttribute('aria-label') || el.id || '').trim().slice(0, 40),
          width: Math.round(rect.width * 10) / 10,
          height: Math.round(rect.height * 10) / 10,
        });
      }
    }

    const smallTexts = [];
    const lowContrasts = [];
    const checkedEls = new Set();

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue || !node.nodeValue.trim()) continue;
      const el = node.parentElement;
      if (!el || checkedEls.has(el) || !isVisible(el)) continue;
      checkedEls.add(el);

      const st = getComputedStyle(el);
      const fontSize = parseFloat(st.fontSize);
      const fontWeight = parseInt(st.fontWeight, 10) || 400;
      const isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
      const minRatio = isLarge ? 3.0 : 4.5;

      if (fontSize < 13.99) {
        smallTexts.push({
          tag: el.tagName,
          text: (el.innerText ?? el.textContent ?? '').trim().slice(0, 40),
          fontSize: Math.round(fontSize * 10) / 10,
        });
      }

      const bg = getEffectiveBg(el);
      const fgRaw = parseCssColor(st.color);
      const fg = compositeOver(fgRaw, bg);
      const ratio = contrastRatio(fg, bg);
      if (ratio < minRatio) {
        lowContrasts.push({
          tag: el.tagName,
          text: (el.innerText ?? el.textContent ?? '').trim().slice(0, 40),
          ratio: Math.round(ratio * 100) / 100,
          minRatio,
          fg: st.color,
          bgRgb: `rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`,
        });
      }
    }

    const truncatedNavLabels = [];
    if (window.innerWidth < 768) {
      const navSpans = document.querySelectorAll('[data-testid="mobile-bottom-tab-bar"] span');
      for (const sp of navSpans) {
        if (sp.scrollWidth > sp.clientWidth + 1) {
          truncatedNavLabels.push({
            text: sp.textContent?.trim(),
            scrollWidth: sp.scrollWidth,
            clientWidth: sp.clientWidth,
          });
        }
      }
    }

    return {
      scrollW,
      innerW,
      horizontalOverflow: scrollW > innerW,
      bodyBgRgb: `rgb(${parsedBodyBg[0]}, ${parsedBodyBg[1]}, ${parsedBodyBg[2]})`,
      smallControls,
      smallTexts,
      lowContrasts,
      truncatedNavLabels,
    };
  });
}

async function auditLoadedRouteAcrossViewports(page, routeLabel, routeUrl, scheme, widths) {
  await page.setViewportSize({ width: widths[0], height: 844 });
  await page.goto(routeUrl, { waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(200);

  let allPassed = true;
  const expectedBg = scheme === 'light' ? 'rgb(247, 239, 217)' : 'rgb(11, 10, 9)';

  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(80);
    const res = await auditPage(page);
    const bgMatches = res.bodyBgRgb === expectedBg;
    const pass =
      !res.horizontalOverflow &&
      bgMatches &&
      res.smallControls.length === 0 &&
      res.smallTexts.length === 0 &&
      res.lowContrasts.length === 0;

    console.log(
      `[${pass ? 'PASS' : 'FAIL'}] ${routeLabel.padEnd(24)} | ${scheme.toUpperCase().padEnd(5)} | ${String(width).padStart(4)}px | scroll=${res.scrollW}/${res.innerW} | bg=${res.bodyBgRgb} | controls<44px=${res.smallControls.length} | text<14px=${res.smallTexts.length} | contrastFail=${res.lowContrasts.length}`
    );

    if (!pass) {
      allPassed = false;
      if (!bgMatches) {
        console.log(`   Expected ${routeLabel} bg ${expectedBg}, got ${res.bodyBgRgb}`);
      }
      if (res.smallControls.length) console.log(`   ${routeLabel} smallControls:`, JSON.stringify(res.smallControls.slice(0, 8)));
      if (res.smallTexts.length) console.log(`   ${routeLabel} smallTexts:`, JSON.stringify(res.smallTexts.slice(0, 8)));
      if (res.lowContrasts.length) console.log(`   ${routeLabel} lowContrasts:`, JSON.stringify(res.lowContrasts.slice(0, 8)));
    }
  }
  return allPassed;
}

async function run() {
  const browser = await chromium.launch({
    executablePath: CHROME_BIN,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  let hasFailure = false;

  // Create one synthetic sample order against running server to inspect live /order/[code] UI
  let sampleTrackingUrl = null;
  try {
    const orderRes = await fetch(new URL('/api/orders', BASE_URL).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Playwright Audit Customer',
        customerPhone: '08033729125',
        deliveryType: 'collection',
        acceptedPolicy: true,
        policyVersion: '2026-10-15-v3',
        items: [{ menuItemId: 'item-t001', quantity: 1 }],
      }),
    });
    if (orderRes.ok) {
      const data = await orderRes.json();
      if (data?.trackingUrl) {
        sampleTrackingUrl = new URL(data.trackingUrl, BASE_URL).toString();
      }
    }
  } catch {
    // fallback handled below
  }

  try {
    for (const scheme of SCHEMES) {
      const context = await browser.newContext({
        viewport: { width: 375, height: 844 },
        colorScheme: scheme,
      });
      const page = await context.newPage();

      if (AUDIT_GROUP === 'all' || AUDIT_GROUP === 'public') {
      // 1. Public & Auth Routes
      const publicRoutes = [
        { label: '/', path: '/' },
        { label: '/refund-policy', path: '/refund-policy' },
        { label: '/menu', path: '/menu' },
        { label: '/estimate', path: '/estimate' },
        { label: '/estimate?tier=tier-gold', path: '/estimate?tier=tier-gold' },
        { label: '/catering', path: '/catering' },
        { label: '/terms', path: '/terms' },
        { label: '/privacy', path: '/privacy' },
        { label: '/login', path: '/login' },
        { label: '/login/mfa', path: '/login/mfa' },
        { label: '/not-found', path: '/404-not-found-audit' },
      ];

      for (const r of publicRoutes) {
        const ok = await auditLoadedRouteAcrossViewports(
          page,
          r.label,
          new URL(r.path, BASE_URL).toString(),
          scheme,
          VIEWPORTS
        );
        if (!ok) hasFailure = true;

        if (r.path === '/estimate?tier=tier-gold') {
          const goldPressed = await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button')).find((b) =>
              b.textContent?.includes('Gold Royal')
            );
            return btn?.getAttribute('aria-pressed') === 'true';
          });
          if (!goldPressed) {
            console.log(`   [FAIL] /estimate?tier=tier-gold Gold Royal aria-pressed !== "true" (${scheme})`);
            hasFailure = true;
          }
        }

        if (r.path === '/login') {
          await page.setViewportSize({ width: 390, height: 844 });
          await page.fill('input[type="email"]', 'invalid@example.com');
          await page.fill('input[type="password"]', 'WrongPass123!');
          await page.click('button[type="submit"]');
          await page.waitForSelector('[role="alert"]', { timeout: 5000 });
          const alertVisible = await page.locator('[role="alert"]').isVisible();
          const alertAudit = await auditPage(page);
          const loginAlertPass =
            alertVisible &&
            !alertAudit.horizontalOverflow &&
            alertAudit.smallControls.length === 0 &&
            alertAudit.smallTexts.length === 0 &&
            alertAudit.lowContrasts.length === 0;
          console.log(
            `[${loginAlertPass ? 'PASS' : 'FAIL'}] /login invalid alert   | ${scheme.toUpperCase().padEnd(5)} |  390px | alertVisible=${alertVisible} | contrastFail=${alertAudit.lowContrasts.length}`
          );
          if (!loginAlertPass) hasFailure = true;
        }
      }

      // Interactive AssistantWidget Popover check on / at 375 and 1280
      for (const w of [375, 1280]) {
        await page.setViewportSize({ width: w, height: 844 });
        await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(150);
        const fab = page.locator('[data-testid="floating-assistant-button"]');
        await fab.click();
        await page.waitForSelector('#ruc-assistant-panel:popover-open', { timeout: 5000 });

        const input = page.locator('#assistant-input');
        await input.fill('Do you cater a 50-guest wedding?');
        await page.locator('[data-testid="assistant-send-button"]').click();
        await page.waitForSelector('[data-testid="assistant-estimator-link"]', { timeout: 5000 });

        const openAudit = await auditPage(page);
        const widgetPass =
          !openAudit.horizontalOverflow &&
          openAudit.smallControls.length === 0 &&
          openAudit.smallTexts.length === 0 &&
          openAudit.lowContrasts.length === 0;

        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);
        const escState = await page.evaluate(() => ({
          openAfterEsc: document.getElementById('ruc-assistant-panel')?.matches(':popover-open') ?? false,
          activeTestId: document.activeElement?.getAttribute('data-testid') || null,
        }));

        const escPass = !escState.openAfterEsc && escState.activeTestId === 'floating-assistant-button';
        console.log(
          `[${widgetPass && escPass ? 'PASS' : 'FAIL'}] AssistantWidget          | ${scheme.toUpperCase().padEnd(5)} | ${String(w).padStart(4)}px | escClosed=${!escState.openAfterEsc} | focusReturn=${escState.activeTestId} | openControlsFail=${openAudit.smallControls.length} | openTextFail=${openAudit.smallTexts.length} | openContrastFail=${openAudit.lowContrasts.length}`
        );
        if (!widgetPass || !escPass) {
          hasFailure = true;
        }
      }

      // /checkout with populated cart
      await page.goto(new URL('/menu', BASE_URL).toString(), { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        window.localStorage.setItem(
          'rock_uc_cart_items_v2',
          JSON.stringify([{ key: 'item-t001:def:', menuItemId: 'item-t001', quantity: 2 }])
        );
      });
      const checkoutPass = await auditLoadedRouteAcrossViewports(
        page,
        '/checkout',
        new URL('/checkout', BASE_URL).toString(),
        scheme,
        VIEWPORTS
      );
      if (!checkoutPass) hasFailure = true;

      // /order/[code]
      const orderTargetUrl =
        sampleTrackingUrl || new URL('/order/RUC-NOTFOUND', BASE_URL).toString();
      const orderPass = await auditLoadedRouteAcrossViewports(
        page,
        '/order/[code]',
        orderTargetUrl,
        scheme,
        VIEWPORTS
      );
      if (!orderPass) hasFailure = true;
      }

      if (AUDIT_GROUP === 'all' || AUDIT_GROUP === 'admin') {
      if (AUDIT_GROUP === 'admin') {
        await page.goto(new URL('/login', BASE_URL).toString(), { waitUntil: 'domcontentloaded' });
      }
      // 2. Authenticated Admin Routes (login as Staff single-step in browser context)
      const loginRes = await page.evaluate(async () => {
        const r = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'staff@rockucfoods.com',
            password: 'StaffService2026!',
            next: '/admin',
          }),
        });
        return { ok: r.ok, status: r.status, body: await r.json() };
      });

      if (!loginRes.ok || loginRes.body?.step !== 'done') {
        console.log(`[FAIL] Staff login in Playwright failed:`, JSON.stringify(loginRes));
        hasFailure = true;
      } else {
        const adminRoutes = [
          { label: '/admin (live_orders)', path: '/admin' },
          { label: '/admin?tab=kds', path: '/admin?tab=kds' },
          { label: '/admin?tab=dispatch', path: '/admin?tab=dispatch' },
          { label: '/admin?tab=events', path: '/admin?tab=events' },
          { label: '/admin?tab=security', path: '/admin?tab=security' },
          { label: '/admin?tab=alerts', path: '/admin?tab=alerts' },
          { label: '/admin?tab=reports', path: '/admin?tab=reports' },
          { label: '/admin?tab=menu', path: '/admin?tab=menu' },
          { label: '/admin?tab=zones', path: '/admin?tab=zones' },
          { label: '/admin?tab=content', path: '/admin?tab=content' },
          { label: '/admin?tab=staff', path: '/admin?tab=staff' },
          { label: '/admin/estimator', path: '/admin/estimator' },
          { label: '/admin/reconciliation', path: '/admin/reconciliation' },
          { label: '/admin/invoices', path: '/admin/invoices' },
        ];

        for (const ar of adminRoutes) {
          const ok = await auditLoadedRouteAcrossViewports(
            page,
            ar.label,
            new URL(ar.path, BASE_URL).toString(),
            scheme,
            VIEWPORTS
          );
          if (!ok) hasFailure = true;
        }
      }
      }

      await context.close();
    }

    if (AUDIT_GROUP === 'all' || AUDIT_GROUP === 'public') {
    // 3. Narrow phone check (360px) for 5-item BottomTabBar label truncation at 14px
    const narrowCtx = await browser.newContext({ viewport: { width: 360, height: 740 }, colorScheme: 'dark' });
    const narrowPage = await narrowCtx.newPage();
    await narrowPage.goto(BASE_URL, { waitUntil: 'networkidle' });
    await narrowPage.waitForTimeout(150);
    const narrowRes = await auditPage(narrowPage);
    const narrowPass = !narrowRes.horizontalOverflow && narrowRes.truncatedNavLabels.length === 0;
    console.log(
      `[${narrowPass ? 'PASS' : 'FAIL'}] / (360px nav check)     | DARK  |  360px | scroll=${narrowRes.scrollW}/${narrowRes.innerW} | navTrunc=${narrowRes.truncatedNavLabels.length}`
    );
    if (!narrowPass) {
      hasFailure = true;
      console.log('   360px truncatedNavLabels:', JSON.stringify(narrowRes.truncatedNavLabels));
    }
    await narrowCtx.close();
    }
  } finally {
    await browser.close();
  }

  if (hasFailure) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
