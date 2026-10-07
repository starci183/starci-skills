import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { walkFiles } from '../../lib/walk.mjs';
import { readEnv } from '../../lib/env.mjs';
import { eachInOrder, repeatInOrder } from '../../lib/in-order.mjs';
import { byCodeUnit } from '../../lib/list.mjs';
import { DEFAULT_VIEWPORT } from './grammar-geometry-resolve.mjs';

// grammar-geometry-page.mjs - rendering a page for grammar-geometry.mjs: the product's Playwright, one snapshot per html
// (every element's box, computed geometry and colour, and a keyboard focus pass).

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Playwright's chromium, resolved from the product repo first (the way .claude runs the project's own Playwright). */
export async function loadChromium(repo) {
  const bases = [repo, ROOT, readEnv('STARCI_PLAYWRIGHT_DIR')].filter(Boolean).map((d) => path.join(path.resolve(d), 'package.json'));
  for (const base of bases) for (const name of ['playwright', '@playwright/test', 'playwright-core']) {
    let resolved;
    try { resolved = createRequire(base).resolve(name); } catch { continue; }
    const mod = await import(pathToFileURL(resolved).href);
    const chromium = mod.chromium ?? mod.default?.chromium;
    if (chromium) return { chromium, from: resolved };
  }
  return null;
}

/** The html files a --check or --score target names: the file itself, or every .html of a capture dir. */
export function htmlTargets(target) {
  const abs = path.resolve(target);
  if (!fs.existsSync(abs)) return [];
  if (fs.statSync(abs).isFile()) return /\.html?$/i.test(abs) ? [abs] : [];
  return walkFiles(abs, {maxDepth: 2, filter: name => /\.html?$/i.test(name)}).sort(byCodeUnit);
}

/** In-page collector: every rendered element's box, computed geometry and colour (sRGB via canvas). */
function collectPage(probes) {
  const cv = document.createElement('canvas'); cv.width = 1; cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgba = (c) => {
    if (!c) return null;
    cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#010203'; cx.fillStyle = c;
    if (cx.fillStyle === '#010203' && !/^#010203$/i.test(c)) return null;
    cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], Math.round((d[3] / 255) * 1000) / 1000];
  };
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;left:-9999px;top:0;width:10px;height:10px';
  document.body.appendChild(probe);
  const probed = {};
  for (const [key, p] of Object.entries(probes || {})) {
    probe.style.cssText = 'position:absolute;left:-9999px;top:0;width:10px;height:10px';
    probe.style.setProperty(p.prop, p.value);
    const v = getComputedStyle(probe).getPropertyValue(p.prop);
    probed[key] = { value: v, rgba: /color/.test(p.prop) ? rgba(v) : null };
  }
  probe.remove();
  const all = [...document.querySelectorAll('body *')].filter((e) => !['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'TEMPLATE', 'BR'].includes(e.tagName));
  const index = new Map(all.map((e, i) => [e, i]));
  all.forEach((e, i) => { e.dataset.ggI = String(i); });
  const n = (v) => Number.parseFloat(v) || 0;
  const elements = all.slice(0, 5000).map((e, i) => {
    const s = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    const own = [...e.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join(' ').replace(/\s+/g, ' ').trim();
    let p = e.parentElement; while (p && !index.has(p)) p = p.parentElement;
    const radius = (v) => (String(v).endsWith('%') ? (n(v) * Math.min(r.width, r.height)) / 100 : n(v));
    const labelText = (() => {
      if (!/^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName) && e.getAttribute('contenteditable') !== 'true') return null;
      const parts = [];
      if (e.labels) for (const l of e.labels) parts.push(l.innerText.trim());
      const lb = e.getAttribute('aria-labelledby');
      if (lb) for (const id of lb.split(/\s+/)) { const t = document.getElementById(id); if (t) parts.push(t.innerText.trim()); }
      if (e.getAttribute('aria-label')) parts.push(e.getAttribute('aria-label'));
      return parts.join(' ').trim() || null;
    })();
    const described = (e.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)).filter(Boolean).map((t) => index.get(t)).filter((x) => x !== undefined);
    return {
      i, parent: p ? index.get(p) : null, tag: e.tagName.toLowerCase(), id: e.id || null, cls: typeof e.className === 'string' ? e.className : '',
      // A real grammar render (draw-render fixture mode of a <XBase>.draw.tsx): the component root it is, and whether it
      // is a layout element the drawing itself wrote (draw-source.mjs LAYOUT_ATTR).
      comp: e.getAttribute('data-component'), drawLayout: e.hasAttribute('data-draw-layout'), dataWidth: e.getAttribute('data-width'),
      role: e.getAttribute('role'), type: e.getAttribute('type'), href: e.getAttribute('href'),
      aria: { selected: e.getAttribute('aria-selected'), current: e.getAttribute('aria-current'), hidden: e.getAttribute('aria-hidden'), required: e.getAttribute('aria-required'), invalid: e.getAttribute('aria-invalid') },
      required: Boolean(e.required), disabled: Boolean(e.disabled), labelText, described, placeholder: e.getAttribute('placeholder'), value: 'value' in e && typeof e.value === 'string' ? e.value.slice(0, 80) : null,
      own: own.slice(0, 120), textLen: (e.innerText || '').length,
      rect: { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height },
      visible: s.visibility !== 'hidden' && s.display !== 'none' && n(s.opacity) > 0.01 && r.width > 0 && r.height > 0,
      style: {
        display: s.display, position: s.position, fontFamily: s.fontFamily, fontSize: n(s.fontSize), fontWeight: n(s.fontWeight), lineHeight: s.lineHeight === 'normal' ? null : n(s.lineHeight),
        color: rgba(s.color), bg: rgba(s.backgroundColor), bgImage: s.backgroundImage !== 'none',
        border: ['Top', 'Right', 'Bottom', 'Left'].map((k) => ({ w: n(s[`border${k}Width`]), style: s[`border${k}Style`], color: rgba(s[`border${k}Color`]) })),
        radius: radius(s.borderTopLeftRadius), shadow: s.boxShadow,
        padding: [n(s.paddingTop), n(s.paddingRight), n(s.paddingBottom), n(s.paddingLeft)],
        margin: [n(s.marginTop), n(s.marginRight), n(s.marginBottom), n(s.marginLeft)],
        rowGap: s.rowGap === 'normal' ? null : n(s.rowGap), columnGap: s.columnGap === 'normal' ? null : n(s.columnGap),
        outline: { style: s.outlineStyle, w: n(s.outlineWidth), color: rgba(s.outlineColor), offset: n(s.outlineOffset) },
        overflowX: s.overflowX, overflowY: s.overflowY, textAlign: s.textAlign,
      },
    };
  });
  const doc = document.documentElement;
  return {
    root: { fontPx: n(getComputedStyle(doc).fontSize), clientWidth: doc.clientWidth, scrollWidth: doc.scrollWidth, scrollHeight: doc.scrollHeight, bodyBg: rgba(getComputedStyle(document.body).backgroundColor), htmlBg: rgba(getComputedStyle(doc).backgroundColor) },
    fonts: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '')),
    probes: probed, elements,
  };
}

/** Render each html at `viewport` and return one snapshot per file (with a keyboard focus pass). */
export async function snapshotFiles(files, { repo = null, viewport = DEFAULT_VIEWPORT, probes = {}, focusStops = 40 } = {}) {
  const pw = await loadChromium(repo);
  if (!pw) return { ok: false, error: `Playwright is not installed in ${repo ?? '(no repo)'} or ${ROOT} (set STARCI_PLAYWRIGHT_DIR to a dir that has it)` };
  const browser = await pw.chromium.launch();
  try {
    const shots = [];
    await eachInOrder(files, async (file) => {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 1, colorScheme: 'light' });
      await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);
      const snap = await page.evaluate(collectPage, probes);
      const focus = [];
      const stops = Math.min(focusStops, snap.elements.filter((e) => /^(a|button|input|select|textarea)$/.test(e.tag) || e.role === 'tab').length + 2);
      await repeatInOrder(async (k) => {
        if (k >= stops) return true;
        await page.keyboard.press('Tab');
        focus.push(await page.evaluate(() => {
          const e = document.activeElement;
          if (!e || e === document.body) return null;
          const s = getComputedStyle(e);
          return { i: Number(e.getAttribute('data-gg-i')), outline: { style: s.outlineStyle, w: Number.parseFloat(s.outlineWidth) || 0, offset: Number.parseFloat(s.outlineOffset) || 0 }, shadow: s.boxShadow, focusVisible: e.matches(':focus-visible') };
        }));
        return undefined;
      });
      shots.push({ file, viewport, ...snap, focus });
      await page.close();
    });
    return { ok: true, snapshots: shots, playwright: pw.from };
  } finally { await browser.close(); }
}
