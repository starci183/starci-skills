#!/usr/bin/env node
// draw-render.mjs — the capture interface.draw uses for code-native regions: the drawing is a real render, not an
// image model's guess.
//
//   node scripts/work/draw-render.mjs --html <file> --out <dir> --viewports 390x844,1440x900
//        [--full-page] [--name <base>] [--theme light|dark] [--json]
//   node scripts/work/draw-render.mjs --component <module> --export <XBase> --props <fixture.json> [--css <file>]...
//        --out <dir> --viewports 390x844,1440x900 [--full-page] [--name <base>] [--theme light|dark] [--json]
//   [--trace]  also records a Playwright trace per viewport, <out>/<base>.trace.zip (screenshots + DOM snapshots), named in
//        the record's trace field and indexed by job-artifacts.mjs as subkind playwright-trace. Off by default: a trace
//        is 1-3 MB per viewport and a ui record's assets/ count against Work's byte budget; a draw loop's evidence
//        round or a debugging run turns it on.
//   [--state <state> [--base <XBase>]]  names the capture <XBase>#<state>--<w>x<h>--<theme>: a drawing is the XBase
//        content only, one per XBase#state (owner ruling 2026-09-27), never the page with its layout chrome; the XBase
//        is --export in fixture mode, --base with --html.
//
// Each viewport is loaded from a file:// URL at deviceScaleFactor 2 with prefers-color-scheme <theme>, waits for
// document.fonts.ready plus SETTLE_MS (modules/models/runtimes.yaml allocation.drawRender.settleMs), and writes <out>/<base>--<w>x<h>--<theme>.png and a .json record beside it:
// the fonts that loaded, the font families that did not render, page width vs scrollWidth, console errors, failed
// requests, uncaught page errors and the image sha256. A capture with a missing font, horizontal overflow, an
// uncaught page error, a failed request or (fixture mode) an empty render is red: exit 1. Usage or environment
// errors (no Playwright, no Chromium, no esbuild) exit 2. Nothing is ever green by default.
//
// Fixture mode renders the named pure export of a product module with the fixture JSON as its props, bundled by the
// product's own esbuild (so its tsconfig paths, React and CSS imports resolve as in the product). A fixture value
// "[Function]" becomes a no-op function (the Base's `on` actions). Each --css file is the product's global
// stylesheet: one that imports tailwindcss is compiled by the product's tailwindcss against the bundle's class
// candidates, any other is bundled by esbuild.
//
// Playwright, esbuild and tailwindcss are the project's own installs (scripts/lib/package-at.mjs), resolved from
// the HTML's or the component's directory, then the working directory; the runtime ships none of them.
import '../lib/hide-child-windows.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { sha256 } from '../../engine/index.mjs';
import { allocationMs } from '../../engine/config.mjs';
import { findPackage, requirePackage } from '../lib/package-at.mjs';
import { safeRemoveTree } from '../lib/safe-remove.mjs';
import { ACCENT_EXEMPT_SELECTOR } from '../checks/draw-taste.mjs';

export const RECORD_SCHEMA = 'starci/draw-render@1';
export const DEVICE_SCALE_FACTOR = 2;
export const SETTLE_MS = allocationMs('drawRender.settleMs');
export const THEMES = Object.freeze(['light', 'dark']);
export const FUNCTION_FIXTURE = '[Function]';
export const EXIT = Object.freeze({ ok: 0, red: 1, usage: 2 });
const GENERIC_FAMILIES = Object.freeze(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif',
  'ui-monospace', 'ui-rounded', 'math', 'emoji', 'fangsong', 'inherit', 'initial', 'unset']);
/** Family names that are a system-font alias on one platform only: skipped where absent, never missing. */
const PLATFORM_ALIASES = Object.freeze(['-apple-system', 'blinkmacsystemfont']);

export class UsageError extends Error {}

const VALUE_FLAGS = new Set(['--html', '--out', '--viewports', '--name', '--theme', '--component', '--export', '--props', '--css', '--state', '--base']);
const BOOL_FLAGS = new Set(['--full-page', '--json', '--trace']);

/** argv -> options; throws UsageError. */
export function parseArgs(argv) {
  const o = { css: [], fullPage: false, json: false, theme: 'light' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (BOOL_FLAGS.has(a)) { o[a === '--full-page' ? 'fullPage' : a === '--trace' ? 'trace' : 'json'] = true; continue; }
    if (!VALUE_FLAGS.has(a)) throw new UsageError(`unknown argument ${a}`);
    const v = argv[++i];
    if (v == null || v.startsWith('--')) throw new UsageError(`${a} needs a value`);
    if (a === '--css') o.css.push(path.resolve(v));
    else o[a.slice(2)] = v;
  }
  if (!o.out) throw new UsageError('--out <dir> is required');
  if (!o.viewports) throw new UsageError('--viewports <WxH,...> is required');
  o.viewports = parseViewports(o.viewports);
  if (!THEMES.includes(o.theme)) throw new UsageError(`--theme must be one of ${THEMES.join('|')}`);
  const fixture = ['component', 'export', 'props'].filter((k) => o[k]);
  if (o.html && fixture.length) throw new UsageError('--html and --component are exclusive');
  if (!o.html && fixture.length !== 3) throw new UsageError('give --html <file>, or --component <module> --export <XBase> --props <fixture.json>');
  if (o.html && o.css.length) throw new UsageError('--css applies to --component only');
  if (o.export && !/^[A-Za-z_$][\w$]*$/.test(o.export)) throw new UsageError(`--export ${o.export} is not an identifier`);
  o.mode = o.html ? 'html' : 'component';
  for (const k of ['html', 'component', 'props', 'out']) if (o[k]) o[k] = path.resolve(o[k]);
  // Owner ruling 2026-09-27: a drawing is the XBase content only, one per XBase#state - `--state <state>` names the
  // capture <XBase>#<state>--<w>x<h>--<theme> (the XBase is --export, or --base for an html render of it).
  if (o.state != null && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(o.state)) throw new UsageError(`--state ${o.state} must be a lowercase slug`);
  if (o.state != null && !o.name) {
    const base = o.base ?? o.export;
    if (!base) throw new UsageError('--state needs the XBase: --export <XBase>, or --base <XBase> with --html');
    o.name = `${base}#${o.state}`;
  }
  o.name ??= o.html ? path.basename(o.html).replace(/\.[^.]+$/, '') : o.export;
  if (!/^[\w.-]+(?:#[a-z0-9-]+)?$/.test(o.name)) throw new UsageError(`--name ${o.name} must be [A-Za-z0-9_.-] (or <XBase>#<state>)`);
  return o;
}

export function parseViewports(text) {
  const seen = new Set();
  const viewports = String(text).split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
    const m = /^(\d{2,5})x(\d{2,5})$/.exec(s);
    if (!m) throw new UsageError(`viewport ${s} is not <width>x<height>`);
    if (seen.has(s)) throw new UsageError(`viewport ${s} is listed twice`);
    seen.add(s);
    return { width: Number(m[1]), height: Number(m[2]) };
  });
  if (!viewports.length) throw new UsageError('--viewports is empty');
  return viewports;
}

export const captureBase = (name, { width, height }, theme) => `${name}--${width}x${height}--${theme}`;

export const splitFontStack = (stack) => String(stack).split(',').map((f) => f.trim().replace(/^(["'])(.*)\1$/, '$2')).filter(Boolean);
export const isGenericFamily = (family) => GENERIC_FAMILIES.includes(family.toLowerCase());

/**
 * Which family each rendered font stack used, and which named families before it did not render.
 * `loaded` are FontFace families with status loaded, `local(family)` answers whether the host has it installed.
 */
export function resolveFontStacks(stacks, { loaded, local }) {
  const webfonts = new Set(loaded.map((f) => f.toLowerCase()));
  const used = [], missing = new Set();
  for (const stack of stacks) {
    let hit = null;
    for (const family of splitFontStack(stack)) {
      if (isGenericFamily(family)) { hit = { family, source: 'generic' }; break; }
      if (webfonts.has(family.toLowerCase())) { hit = { family, source: 'webfont' }; break; }
      if (local(family)) { hit = { family, source: 'local' }; break; }
      if (!PLATFORM_ALIASES.includes(family.toLowerCase())) missing.add(family);
    }
    used.push({ stack, ...(hit ?? { family: null, source: 'browser-default' }) });
  }
  return { used, missing: [...missing] };
}

/** The failure codes of one measured viewport; empty means green. */
export function judgeCapture(m) {
  const failures = [];
  if (m.fonts.missing.length) failures.push('font-missing');
  if (m.layout.horizontalOverflow) failures.push('horizontal-overflow');
  if (m.pageErrors.length) failures.push('page-error');
  if (m.failedRequests.length) failures.push('request-failed');
  if (m.rendered === false) failures.push('empty-render');
  return failures;
}

/** Fixture JSON -> props: every "[Function]" becomes a no-op. */
export const fixtureProps = (value) => (value === FUNCTION_FIXTURE ? '__DRAW_NOOP__'
  : Array.isArray(value) ? value.map(fixtureProps)
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fixtureProps(v)])) : value);

/** Candidate class tokens of a bundle for tailwind's build(): everything between quotes and whitespace. */
export const classCandidates = (text) => [...new Set(String(text).split(/[\s"'`\\]+/).filter((t) => t.length > 0 && t.length <= 200))];

/* --------------------------------------------------------------- the page */

function measurePage({ generic, exemptSelector }) {
  const faces = [...document.fonts].map((f) => ({ family: f.family.replace(/^(["'])(.*)\1$/, '$2'), weight: f.weight, style: f.style, status: f.status }));
  const stacks = new Set();
  const visible = (el) => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden'; };
  const walker = document.createTreeWalker(document.body ?? document.documentElement, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (el && n.textContent.trim() && !['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(el.tagName) && visible(el)) stacks.add(getComputedStyle(el).fontFamily);
  }
  for (const el of document.querySelectorAll('input,textarea,select,button')) if (visible(el)) stacks.add(getComputedStyle(el).fontFamily);
  const ctx = document.createElement('canvas').getContext('2d');
  const sample = 'mmmmmmmmmmlli10WQ@#';
  const width = (font) => { ctx.font = `72px ${font}`; return ctx.measureText(sample).width; };
  const families = new Set([...stacks].flatMap((s) => s.split(',').map((f) => f.trim().replace(/^(["'])(.*)\1$/, '$2'))).filter((f) => f && !generic.includes(f.toLowerCase())));
  const local = [...families].filter((f) => ['monospace', 'serif', 'sans-serif'].some((b) => width(`"${f}", ${b}`) !== width(b)));
  const de = document.documentElement;
  const pageWidth = de.clientWidth;
  const scrollWidth = Math.max(de.scrollWidth, document.body?.scrollWidth ?? 0);
  const overflowing = scrollWidth > pageWidth ? [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > pageWidth + 0.5)
    .slice(0, 10).map((el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/).slice(0, 3).join('.')}` : ''}`) : [];
  const root = document.getElementById('root');
  // The brand art band a drawing marks (draw-taste.mjs ACCENT_EXEMPT_SELECTOR): its rects, in document CSS px, are
  // exempt from the accent budget.
  let accentExempt = [];
  try {
    accentExempt = [...document.querySelectorAll(exemptSelector)].map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0).map((r) => ({ x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height }));
  } catch { accentExempt = []; }
  // The anatomy draw-dna.mjs anatomyFindings judges (owner rulings 2026-09-27): each Alert's computed background
  // against the --surface token, its indicator box and colours; each Meter's track box against its band's content box,
  // and its segments.
  const anatomy = { alerts: [], meters: [] };
  try {
    const tag = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}`;
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;background-color:var(--surface)';
    document.body.appendChild(probe);
    const surface = getComputedStyle(probe).backgroundColor;
    probe.remove();
    const partIn = (root, names) => [...root.querySelectorAll('[data-grammar-part]')].find((d) => names.includes(d.getAttribute('data-grammar-part').trim()));
    for (const el of document.querySelectorAll('[data-grammar-component="Alert"]')) {
      if (el.hasAttribute('data-grammar-part')) continue;
      const indicator = partIn(el, ['alert-indicator', 'indicator']) ?? el.querySelector('.alert__indicator');
      const title = partIn(el, ['alert-title', 'title']) ?? el.querySelector('.alert__title');
      const box = indicator?.getBoundingClientRect();
      anatomy.alerts.push({ desc: tag(el), background: getComputedStyle(el).backgroundColor, surface,
        indicator: box ? { width: box.width, height: box.height } : null, tile: Boolean(el.querySelector('[data-grammar-component="IconTile"]')),
        indicatorColor: indicator ? getComputedStyle(indicator.querySelector('svg') ?? indicator).color : null, titleColor: title ? getComputedStyle(title).color : null });
    }
    for (const el of document.querySelectorAll('[data-grammar-component="Meter"]')) {
      if (el.hasAttribute('data-grammar-part')) continue;
      const track = partIn(el, ['meter-track', 'track']) ?? el.querySelector('.meter__track');
      const band = el.parentElement;
      if (!track || !band) continue;
      const cs = getComputedStyle(band);
      const t = track.getBoundingClientRect();
      const segments = [...el.querySelectorAll('[data-grammar-part*="segment"]:not([data-grammar-part$="segments"]), .starci-core-meter-segment, [data-grammar-meter-segment]')]
        .map((d) => d.getBoundingClientRect()).map((r) => ({ x: r.left, width: r.width }));
      const segmented = el.hasAttribute('data-grammar-meter-segments') || el.hasAttribute('data-segments') || segments.length > 1;
      anatomy.meters.push({ desc: tag(el), segmented, track: { width: t.width, height: t.height },
        band: { width: band.clientWidth - parseFloat(cs.paddingLeft || '0') - parseFloat(cs.paddingRight || '0') }, segments });
    }
  } catch { /* the anatomy is advisory measurement; the static gate still runs */ }
  return { anatomy, accentExempt, faces, stacks: [...stacks], local, pageWidth, innerWidth, scrollWidth, overflowing, documentHeight: de.scrollHeight,
    rendered: document.documentElement.dataset.drawHarness === 'component' ? Boolean(root && root.childElementCount) : null };
}

/* -------------------------------------------------------------- capture */

export function loadPlaywright(dirs) {
  const found = findPackage(dirs, ['playwright', '@playwright/test', 'playwright-core']);
  if (!found) throw new UsageError(`no playwright install resolvable from ${dirs.filter(Boolean).join(', ')} (install it in the project that owns the drawing)`);
  const pw = requirePackage(found);
  if (!pw.chromium) throw new UsageError(`${found.name} at ${found.root} exports no chromium`);
  return { chromium: pw.chromium, name: found.name, version: found.version, root: found.root };
}

async function captureViewport(browser, { url, viewport, theme, fullPage, file, traceFile = null }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: DEVICE_SCALE_FACTOR, colorScheme: theme });
  // A trace never decides a capture: a tracing failure only leaves the record without one.
  let tracing = false;
  if (traceFile) { try { await context.tracing.start({ screenshots: true, snapshots: true }); tracing = true; } catch { tracing = false; } }
  try {
    const page = await context.newPage();
    const consoleErrors = [], pageErrors = [], failedRequests = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => pageErrors.push(String(err?.message ?? err)));
    page.on('requestfailed', (req) => failedRequests.push(`${req.url()} ${req.failure()?.errorText ?? ''}`.trim()));
    page.on('response', (res) => { if (res.status() >= 400) failedRequests.push(`${res.url()} HTTP ${res.status()}`); });
    await page.goto(url, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await page.waitForTimeout(SETTLE_MS);
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const raw = await page.evaluate(measurePage, { generic: GENERIC_FAMILIES, exemptSelector: ACCENT_EXEMPT_SELECTOR });
    const png = await page.screenshot({ path: file, fullPage, animations: 'disabled', caret: 'hide' });
    const localSet = new Set(raw.local.map((f) => f.toLowerCase()));
    const loadedFaces = raw.faces.filter((f) => f.status === 'loaded');
    const resolved = resolveFontStacks(raw.stacks, { loaded: loadedFaces.map((f) => f.family), local: (f) => localSet.has(f.toLowerCase()) });
    const errored = raw.faces.filter((f) => f.status === 'error').map((f) => `${f.family} ${f.weight} ${f.style}`);
    return {
      fonts: {
        loaded: loadedFaces.map((f) => `${f.family} ${f.weight} ${f.style}`),
        used: resolved.used,
        local: raw.local.filter((f) => !loadedFaces.some((face) => face.family.toLowerCase() === f.toLowerCase())),
        missing: [...resolved.missing, ...errored],
      },
      layout: { pageWidth: raw.pageWidth, innerWidth: raw.innerWidth, scrollWidth: raw.scrollWidth, documentHeight: raw.documentHeight,
        horizontalOverflow: raw.scrollWidth > raw.pageWidth, overflowing: raw.overflowing, accentExempt: raw.accentExempt ?? [] },
      consoleErrors, pageErrors, failedRequests,
      anatomy: raw.anatomy ?? { alerts: [], meters: [] },
      rendered: raw.rendered,
      image: { sha256: sha256(png), bytes: png.length },
    };
  } finally {
    if (tracing) { try { await context.tracing.stop({ path: traceFile }); } catch { /* the capture stands without its trace */ } }
    await context.close();
  }
}

/** Capture every viewport of one HTML file; writes the PNGs and records, returns the records. */
export async function captureHtml({ html, out, viewports, theme, fullPage, name, source, playwright, trace = false }) {
  fs.mkdirSync(out, { recursive: true });
  const browser = await playwright.chromium.launch().catch((e) => { throw new UsageError(`chromium launch failed (${playwright.name} ${playwright.version}): ${e.message.split('\n')[0]}`); });
  const records = [];
  try {
    for (const viewport of viewports) {
      const base = captureBase(name, viewport, theme);
      const file = path.join(out, `${base}.png`);
      const traceFile = trace ? path.join(out, `${base}.trace.zip`) : null;
      const m = await captureViewport(browser, { url: pathToFileURL(html).href, viewport, theme, fullPage, file, traceFile });
      const failures = judgeCapture(m);
      const { rendered, image, ...measured } = m;
      const record = {
        schema: RECORD_SCHEMA,
        ok: failures.length === 0,
        failures,
        source,
        viewport: { ...viewport, deviceScaleFactor: DEVICE_SCALE_FACTOR },
        theme,
        fullPage,
        image: { path: file, ...image },
        ...measured,
        ...(rendered === null ? {} : { rendered }),
        tool: { playwright: `${playwright.name}@${playwright.version}`, settleMs: SETTLE_MS },
        ...(traceFile && fs.existsSync(traceFile) ? { trace: { path: traceFile } } : {}),
      };
      fs.writeFileSync(path.join(out, `${base}.json`), `${JSON.stringify(record, null, 2)}\n`);
      records.push(record);
    }
  } finally {
    await browser.close();
  }
  return records;
}

/* -------------------------------------------------------- fixture mode */

const cssFileOf = (id, base) => {
  if (id.startsWith('.') || path.isAbsolute(id)) return path.resolve(base, id);
  const [scope, rest] = id.startsWith('@') ? [id.split('/').slice(0, 2).join('/'), id.split('/').slice(2).join('/')] : [id.split('/')[0], id.split('/').slice(1).join('/')];
  const found = findPackage([base], [scope]);
  if (!found) throw new UsageError(`stylesheet ${id} does not resolve from ${base}`);
  const manifest = JSON.parse(fs.readFileSync(found.packageFile, 'utf8'));
  if (!rest) {
    const entry = manifest.exports?.['.']?.style ?? manifest.style;
    if (!entry) throw new UsageError(`${scope} has no style entry`);
    return path.join(found.root, entry);
  }
  const mapped = manifest.exports?.[`./${rest}`];
  const target = typeof mapped === 'string' ? mapped : mapped?.style ?? mapped?.default ?? `./${rest}`;
  return path.join(found.root, target);
};

async function compileStylesheet(file, { dirs, esbuild, candidates, workDir, index }) {
  const text = fs.readFileSync(file, 'utf8');
  if (/@import\s+["']tailwindcss(?:\/[^"']*)?["']|@tailwind\b/.test(text)) {
    const found = findPackage([path.dirname(file), ...dirs], ['tailwindcss']);
    if (!found) throw new UsageError(`${file} imports tailwindcss, which does not resolve from ${path.dirname(file)}`);
    const tw = requirePackage(found);
    const compiler = await tw.compile(text, {
      base: path.dirname(file),
      from: file,
      loadStylesheet: async (id, base) => { const p = cssFileOf(id, base); return { path: p, base: path.dirname(p), content: fs.readFileSync(p, 'utf8') }; },
      loadModule: async (id) => { throw new UsageError(`${file}: tailwind module ${id} (@plugin/@config) is not supported by draw-render`); },
    });
    return compiler.build(candidates);
  }
  const outfile = path.join(workDir, `global-${index}.css`);
  await esbuild.build({ entryPoints: [file], bundle: true, outfile, logLevel: 'silent', loader: ASSET_LOADERS });
  return fs.readFileSync(outfile, 'utf8');
}

const ASSET_LOADERS = Object.freeze({ '.png': 'file', '.jpg': 'file', '.jpeg': 'file', '.gif': 'file', '.webp': 'file', '.svg': 'file',
  '.woff': 'file', '.woff2': 'file', '.ttf': 'file', '.otf': 'file' });

/** Bundle a pure export with fixture props into <workDir>/index.html; returns that path and the source record. */
export async function buildFixtureHarness({ component, exportName, props, css, theme, workDir, cwd = process.cwd() }) {
  for (const f of [component, props, ...css]) if (!fs.existsSync(f)) throw new UsageError(`${f} does not exist`);
  let fixture;
  try { fixture = JSON.parse(fs.readFileSync(props, 'utf8')); } catch (e) { throw new UsageError(`${props}: ${e.message}`); }
  if (!fixture || typeof fixture !== 'object' || Array.isArray(fixture)) throw new UsageError(`${props} must hold the props object`);
  const dirs = [path.dirname(component), cwd];
  const found = findPackage(dirs, ['esbuild']);
  if (!found) throw new UsageError(`no esbuild resolvable from ${dirs.join(', ')}`);
  const esbuild = requirePackage(found);
  const entry = [
    "import * as React from 'react';",
    "import { flushSync } from 'react-dom';",
    "import { createRoot } from 'react-dom/client';",
    `import { ${exportName} as Base } from ${JSON.stringify(component.split(path.sep).join('/'))};`,
    'const noop = () => {};',
    `const revive = (v) => v === '__DRAW_NOOP__' ? noop : Array.isArray(v) ? v.map(revive) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, revive(x)])) : v;`,
    `const props = revive(${JSON.stringify(fixtureProps(fixture))});`,
    `if (typeof Base !== 'function' && !(Base && typeof Base === 'object')) throw new Error(${JSON.stringify(`${exportName} is not a component export`)});`,
    "const root = createRoot(document.getElementById('root'));",
    'flushSync(() => root.render(React.createElement(Base, props)));',
  ].join('\n');
  try {
    await esbuild.build({
      stdin: { contents: entry, resolveDir: path.dirname(component), loader: 'tsx', sourcefile: 'draw-harness.tsx' },
      bundle: true, format: 'iife', platform: 'browser', jsx: 'automatic', outdir: workDir, entryNames: 'harness',
      assetNames: 'assets/[name]-[hash]', loader: ASSET_LOADERS, logLevel: 'silent',
      define: { 'process.env.NODE_ENV': '"production"' },
    });
  } catch (e) {
    throw new UsageError(`esbuild could not bundle ${exportName} from ${component}: ${(e.errors ?? []).slice(0, 5).map((x) => `${x.location?.file ?? ''}:${x.location?.line ?? ''} ${x.text}`).join('; ') || e.message}`);
  }
  const js = fs.readFileSync(path.join(workDir, 'harness.js'), 'utf8');
  const candidates = classCandidates(js);
  const globals = [];
  for (const [index, file] of css.entries()) globals.push(await compileStylesheet(file, { dirs, esbuild, candidates, workDir, index }));
  fs.writeFileSync(path.join(workDir, 'global.css'), globals.join('\n'));
  const links = ['global.css', ...(fs.existsSync(path.join(workDir, 'harness.css')) ? ['harness.css'] : [])].map((h) => `<link rel="stylesheet" href="${h}">`).join('');
  const html = path.join(workDir, 'index.html');
  fs.writeFileSync(html, `<!doctype html><html lang="en" class="${theme}" data-theme="${theme}" data-draw-harness="component" style="color-scheme:${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${links}</head><body><div id="root"></div><script src="harness.js"></script></body></html>\n`);
  const digest = (f) => ({ path: f, sha256: sha256(fs.readFileSync(f)) });
  return { html, source: { mode: 'component', component: digest(component), export: exportName, props: digest(props), css: css.map(digest), esbuild: found.version } };
}

/* ------------------------------------------------------------------ main */

export async function run(argv, { cwd = process.cwd() } = {}) {
  const o = parseArgs(argv);
  if (o.html && !fs.existsSync(o.html)) throw new UsageError(`${o.html} does not exist`);
  const anchor = o.html ? path.dirname(o.html) : path.dirname(o.component);
  const playwright = loadPlaywright([anchor, cwd]);
  if (o.mode === 'html') {
    const source = { mode: 'html', html: { path: o.html, sha256: sha256(fs.readFileSync(o.html)) } };
    return captureHtml({ ...o, source, playwright });
  }
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-draw-render-'));
  try {
    const { html, source } = await buildFixtureHarness({ component: o.component, exportName: o.export, props: o.props, css: o.css, theme: o.theme, workDir, cwd });
    return await captureHtml({ ...o, html, source, playwright });
  } finally {
    safeRemoveTree(workDir);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const json = argv.includes('--json');
  try {
    const records = await run(argv);
    const ok = records.every((r) => r.ok);
    if (json) process.stdout.write(`${JSON.stringify({ ok, records }, null, 2)}\n`);
    else for (const r of records) process.stdout.write(`${r.ok ? 'ok  ' : 'RED '} ${r.image.path}${r.failures.length ? `  ${r.failures.join(', ')}` : ''}\n`);
    process.exitCode = ok ? EXIT.ok : EXIT.red;
  } catch (e) {
    const usage = e instanceof UsageError;
    if (json) process.stdout.write(`${JSON.stringify({ ok: false, error: e.message }, null, 2)}\n`);
    process.stderr.write(`draw-render: ${usage ? e.message : e.stack}\n`);
    process.exitCode = usage ? EXIT.usage : EXIT.red;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
