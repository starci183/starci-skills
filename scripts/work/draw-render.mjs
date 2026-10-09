#!/usr/bin/env node
// draw-render.mjs — the capture interface.draw uses for code-native regions: the drawing is a real render, not an image model's guess.
//
//   starci work draw-render --html <file> --out <dir> --viewports 390x844,1440x900
//        [--full-page] [--name <base>] [--theme light|dark] [--json]
//   starci work draw-render --component <module> --export <XBase> --props <fixture.json> [--css <file>]...
//        --out <dir> --viewports 390x844,1440x900 [--full-page] [--name <base>] [--theme light|dark] [--json]
//   [--trace]  also records a Playwright trace per viewport, <out>/<base>.trace.zip (screenshots + DOM snapshots), named in
//        the record's trace field and indexed by job-artifacts.mjs as subkind playwright-trace. Off by default: a trace
//        is 1-3 MB per viewport and a ui record's assets/ count against Work's byte budget; a draw loop's evidence
//        round or a debugging run turns it on.
//   [--rationale <file>]  the rationale.json of the drawing (owner ruling 2026-09-27; default: <html stem>.rationale.json,
//        else rationale.json beside the html). Every capture measures what the render uses (record `rationale`:
//        scripts/work/draw/draw-rationale.mjs measureRationale) and, with a rationale, also writes the annotated redline
//        <base>.redline.png (spacing brackets with value and rule id, DNA labels at component roots; record `redline`).
//   [--product <app dir>] [--grammar auto|product|claude-dist] [--grammar-dist <package root>] [--harness-out <dir>]
//        fixture mode with a real grammar drawing (owner ruling 2026-09-27: interface.draw draws WITH the real grammar
//        components - <XBase>.draw.tsx, scripts/work/draw/draw-source.mjs). --product is the product app whose own
//        node_modules every bare import resolves from (react, @heroui/*, tailwindcss, the icons), so the draw file may
//        live outside it (a ui record dir, a temp dir) and the product checkout is only read. The @starci/grammar the
//        bundle AND the CSS resolve is chosen by scripts/work/draw-grammar.mjs: the product's install when the draw
//        file type-checks against it, else the runtime-built claude-dist through an alias in THIS bundle only; the
//        record's source.grammar says which (grammarSource product@x | claude-dist@y) and upgradeOwed names an owed
//        product upgrade. A draw file that type-checks against no candidate is refused (DRAW_TYPECHECK_FAILED, exit 1).
//        A .draw.tsx is given --product = the nearest package.json above it that depends on @starci/grammar when the
//        flag is absent. Every layout element of the draw file is stamped data-draw-layout, so the capture measures
//        rendered-DOM ownership (record `ownership`: a painting element whose nearest marker is a drawn layout element,
//        not a grammar component) and writes the DOM snapshot <base>.dom.html (data-component copied to
//        data-grammar-component, so the html-reading metrics read the real render). --harness-out keeps the bundled
//        harness (index.html, harness.js, global.css) for the loop's browser metrics.
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
// Tailwindcss is the project's own install (package-at.mjs); Playwright and esbuild resolve from the HTML's or component's directory, the working directory, then the runtime's own install (render-tools.mjs).
import '../api/process/hide-child-windows.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import {sha256} from '../../engine/digest.mjs';
import { allocationMs } from '../../engine/config.mjs';
import { findPackage, requirePackage } from '../lib/package-at.mjs';
import { RENDER_TOOL_UNAVAILABLE, esbuildInstall, playwrightInstall } from './render-tools.mjs';
import { safeRemove } from '../api/fs/safe-remove.mjs';
import { artifactHoldReason } from '../machine/artifact-hold.mjs';
import { eachInOrder, mapInOrder } from '../lib/in-order.mjs';
import { ACCENT_EXEMPT_SELECTOR } from './draw/draw-taste.mjs';
import { LAYER_PROBE, measureLayer } from './draw/draw-layer.mjs';
import { measureInPage } from './draw-render-page.mjs';
import { MEASURE_SCHEMA, REDLINE_ATTR, REDLINE_LEAF_COMPONENTS, WHY_ATTR, drawRedlines, loadRationale, measureRationale, rationaleFileOf, redlineLabelsOf } from './draw/draw-rationale.mjs';
import { DRAW_SOURCE_SUFFIX, GRAMMAR_PACKAGE, LAYOUT_ATTR, markLayoutElements, rationaleFileFor, typecheckFindings } from './draw/draw-source.mjs';
import { grammarDistStatus, grammarDistMessage } from '../gates/grammar-dist.mjs';
import { PREFERENCES, grammarEntry, resolveDrawGrammar } from './draw-grammar.mjs'; import { isMain } from '../lib/is-main.mjs';
import { makeTempDir } from '../api/fs/make-temp-dir.mjs';

const RECORD_SCHEMA = 'starci/draw-render@1';
const DEVICE_SCALE_FACTOR = 2;
export const SETTLE_MS = allocationMs('drawRender.settleMs');
export const THEMES = Object.freeze(['light', 'dark']);
/** Root hooks of the grammar components that emitted no data-component before @starci/grammar 0.6.0 (their DNA name for
 * the rendered DOM). 0.6.0 stamps data-component on every renderer root; the map stays for a product still on 0.5.x. */
const GRAMMAR_ROOT_MARKERS = Object.freeze([['.starci-core-page-container', 'PageContainer'], ['[data-grammar-section-header]', 'SectionHeader'],
  ['[data-grammar-surface-card]', 'SurfaceCard'], ['.starci-core-media-frame', 'MediaFrame'], ['.starci-core-surface-copy-group', 'SurfaceCopyGroup'],
  ['.starci-core-rank-artwork', 'RankArtwork'], ['[data-grammar-label]', 'Label'], ['.starci-core-horizontal-scroll-region', 'HorizontalScrollRegion'],
  ['[data-grammar-scroll-region]', 'VerticalScrollRegion'], ['.starci-core-subnav', 'Subnav'], ['.starci-core-rail', 'Rail'], ['.starci-core-tabs', 'Tabs'],
  ['.starci-core-markdown-article', 'MarkdownArticle'], ['[data-grammar-included-mark]', 'IncludedMark'], ['[data-grammar-tooltip]', 'Tooltip']]);
const FUNCTION_FIXTURE = '[Function]';
export const EXIT = Object.freeze({ ok: 0, red: 1, usage: 2 });
const GENERIC_FAMILIES = Object.freeze(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif',
  'ui-monospace', 'ui-rounded', 'math', 'emoji', 'fangsong', 'inherit', 'initial', 'unset']);
/** Family names that are a system-font alias on one platform only: skipped where absent, never missing. */
const PLATFORM_ALIASES = Object.freeze(['-apple-system', 'blinkmacsystemfont']);

export class UsageError extends Error {}
/** Refuse a pinned or selected runtime dist before its JS or CSS can enter a draw bundle. */
export function preflightDrawGrammarDist(packageRoot) {
  const status = grammarDistStatus(packageRoot);
  if (!status.ok) throw new RedError(grammarDistMessage(status), 'DRAW_GRAMMAR_DIST_STALE');
  return status;
}
/** A red result before any capture (a draw file that does not type-check): exit 1, with its finding code. */
class RedError extends Error { constructor(message, code) { super(message); this.code = code; } }

const VALUE_FLAGS = new Set(['--html', '--out', '--viewports', '--name', '--theme', '--component', '--export', '--props', '--css', '--state', '--base', '--rationale',
  '--product', '--grammar', '--grammar-dist', '--harness-out']);
const BOOL_FLAGS = new Set(['--full-page', '--json', '--trace']);

/** argv -> options; throws UsageError. */
export function parseArgs(argv) {
  const o = { css: [], fullPage: false, json: false, theme: 'light' };
  assignArguments(argv, o);
  normalizeCommonArgs(o);
  normalizeDrawName(o);
  return o;
}

const BOOLEAN_OPTIONS = new Map([['--full-page', 'fullPage'], ['--trace', 'trace']]);

function assignArguments(argv, o) {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (BOOL_FLAGS.has(a)) { o[BOOLEAN_OPTIONS.get(a) ?? 'json'] = true; continue; }
    if (!VALUE_FLAGS.has(a)) throw new UsageError(`unknown argument ${a}`);
    const v = argv[++i];
    if (v == null || v.startsWith('--')) throw new UsageError(`${a} needs a value`);
    if (a === '--css') { o.css.push(path.resolve(v)); }
    else { o[a.slice(2)] = v; }
  }
}

function assertModeArgs(o) {
  const fixture = ['component', 'export', 'props'].filter((k) => o[k]);
  if (o.html && fixture.length) throw new UsageError('--html and --component are exclusive');
  if (!o.html && fixture.length !== 3) throw new UsageError('give --html <file>, or --component <module> --export <XBase> --props <fixture.json>');
  if (o.html && o.css.length) throw new UsageError('--css applies to --component only');
  if (o.html && (o.product || o.grammar || o['grammar-dist'] || o['harness-out'])) throw new UsageError('--product, --grammar, --grammar-dist and --harness-out apply to --component only');
}

function normalizeCommonArgs(o) {
  if (!o.out) throw new UsageError('--out <dir> is required');
  if (!o.viewports) throw new UsageError('--viewports <WxH,...> is required');
  o.viewports = parseViewports(o.viewports);
  if (!THEMES.includes(o.theme)) throw new UsageError(`--theme must be one of ${THEMES.join('|')}`);
  assertModeArgs(o);
  if (o.grammar && !PREFERENCES.includes(o.grammar)) throw new UsageError(`--grammar must be one of ${PREFERENCES.join('|')}`);
  if (o['grammar-dist']) { o.grammarDist = path.resolve(o['grammar-dist']); delete o['grammar-dist']; }
  if (o['harness-out']) { o.harnessOut = path.resolve(o['harness-out']); delete o['harness-out']; }
  if (o.export && !/^[A-Za-z_$][\w$]*$/.test(o.export)) throw new UsageError(`--export ${o.export} is not an identifier`);
  o.mode = o.html ? 'html' : 'component';
  for (const k of ['html', 'component', 'props', 'out', 'rationale', 'product']) {
    if (o[k]) { o[k] = path.resolve(o[k]); }
  }
}

function normalizeDrawName(o) {
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
const isGenericFamily = (family) => GENERIC_FAMILIES.includes(family.toLowerCase());

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
  if (m.ownership?.unownedCount) failures.push('off-grammar-dom');
  return failures;
}

/** Fixture JSON -> props: every "[Function]" becomes a no-op. */
export const fixtureProps = (value) => {
  if (value === FUNCTION_FIXTURE) { return '__DRAW_NOOP__'; }
  if (Array.isArray(value)) { return value.map(fixtureProps); }
  if (value && typeof value === 'object') { return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fixtureProps(v)])); }
  return value;
};

/** Candidate class tokens of a bundle for tailwind's build(): everything between quotes and whitespace. */
export const classCandidates = (text) => [...new Set(String(text).split(/[\s"'`\\]+/).filter((t) => t.length > 0 && t.length <= 200))];

function rationalePathOf(value) {
  if (typeof value === 'string') { return value; }
  return value?.file ?? null;
}

function dataImageDigest(src) {
  const match = /^data:[^,]*;base64,(.*)$/s.exec(src);
  return match ? sha256(Buffer.from(match[1], 'base64')) : null;
}

async function httpImageDigest(src, page) {
  const response = await page.request.get(src);
  return response.ok() ? sha256(await response.body()) : null;
}

/* --------------------------------------------------------------- the page */



/* -------------------------------------------------------------- capture */

/**
 * The sha256 of the bytes each measured <img> shows (file:, data: or http(s): source; null when unreadable), so the
 * palette gate matches the image against the brand's registered artwork masters by content, never by name.
 */
export async function artworkDigests(images, page = null) {
  const cache = new Map();
  const out = [];
  await eachInOrder(Array.isArray(images) ? images : [], async (a) => {
    const src = String(a?.src ?? '');
    if (!cache.has(src)) {
      let digest = null;
      try {
        if (src.startsWith('file:')) digest = sha256(fs.readFileSync(fileURLToPath(src)));
        else if (src.startsWith('data:')) digest = dataImageDigest(src);
        else if (/^https?:/i.test(src) && page?.request) digest = await httpImageDigest(src, page);
      } catch { digest = null; }
      cache.set(src, digest);
    }
    out.push({ ...a, src: src.startsWith('data:') ? 'data:' : src, sha256: cache.get(src) });
  });
  return out;
}

export function loadPlaywright(dirs, { runtime } = {}) {
  const found = playwrightInstall(dirs, runtime === undefined ? {} : { runtime });
  if (!found) throw new UsageError(`${RENDER_TOOL_UNAVAILABLE}: no playwright install resolvable from ${dirs.filter(Boolean).join(', ')} or the runtime`);
  const pw = requirePackage(found);
  if (!pw.chromium) throw new UsageError(`${found.name} at ${found.root} exports no chromium`);
  return { chromium: pw.chromium, name: found.name, version: found.version, root: found.root };
}

async function captureViewport(browser, { url, viewport, theme, fullPage, file, traceFile = null, rationale = null }) {
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
    // A real grammar drawing cannot put data-why on a grammar component (its props are closed): each rationale decision
    // binds by its selector, stamped onto the rendered DOM before it is measured, redlined and snapshotted.
    await page.evaluate(({ entries, whyAttr, markers }) => {
      if (document.documentElement.dataset.drawHarness !== 'component') return;
      // The DNA name of every grammar root, for the html-reading gates, the redline and the snapshot: data-component
      // where the grammar emits it (every root since grammar 0.6.0), else - a 0.5.x install - the root hook of the
      // components that emitted none (PageContainer, SectionHeader, SurfaceCard, MediaFrame, ...).
      for (const el of document.querySelectorAll('[data-component]')) if (!('grammarComponent' in el.dataset)) el.dataset.grammarComponent = el.dataset.component;
      for (const [selector, name] of markers) for (const el of document.querySelectorAll(selector)) if (!('grammarComponent' in el.dataset)) el.dataset.grammarComponent = name;
      for (const e of entries) {
        let els = [];
        try { els = [...document.querySelectorAll(e.selector)]; } catch { els = []; }
        for (const el of els) el.setAttribute(whyAttr, [...new Set([...(el.getAttribute(whyAttr) ?? '').split(/\s+/).filter(Boolean), e.id])].join(' '));
      }
    }, { entries: (rationale?.entries ?? []).filter((e) => typeof e?.selector === 'string' && typeof e?.id === 'string').map((e) => ({ id: e.id, selector: e.selector })), whyAttr: WHY_ATTR, markers: GRAMMAR_ROOT_MARKERS });
    const raw = await measureInPage(page, { generic: GENERIC_FAMILIES, exemptSelector: ACCENT_EXEMPT_SELECTOR, layoutAttr: LAYOUT_ATTR });
    const artwork = await artworkDigests(raw.artwork ?? [], page);
    // The form regions' rendered widths (draw-layer.mjs DRAW_MEASURE_UNCAPPED, MEASURE-4 case-3/case-4), before the
    // full-page unsticking below moves anything.
    let layer = null;
    try { layer = await page.evaluate(measureLayer, LAYER_PROBE); } catch (error) { layer = { error: String(error?.message ?? error).split(/\r?\n/)[0] }; }
    let domFile = null;
    if (raw.dom) { domFile = file.replace(/\.png$/i, '.dom.html'); fs.writeFileSync(domFile, raw.dom); }
    // A full-page image grows the viewport past the fold, so a sticky bar pinned to the bottom edge would be painted
    // over the middle of the page: once measured (above), it is shown in its flow position, at the end of its region.
    if (fullPage) await page.evaluate(() => { for (const el of document.querySelectorAll('body *')) if (getComputedStyle(el).position === 'sticky') el.style.setProperty('position', 'static', 'important'); });
    const png = await page.screenshot({ path: file, fullPage, animations: 'disabled', caret: 'hide' });
    // What the render uses (draw-rationale.mjs, owner ruling 2026-09-27): every distinct gap/padding/inset, radius and
    // type value, the colours, grids, regions and art - measured, never self-reported. Then the redline: the same
    // page annotated (spacing brackets with value and rule id, DNA labels), captured beside the part.
    const tokens = [...new Set((rationale?.entries ?? []).filter((e) => e?.kind === 'colour').flatMap((e) => `${e.decision ?? ''} ${e.value ?? ''}`.match(/--[A-Za-z0-9-]+/g) ?? []))];
    let measure = null;
    try { measure = await page.evaluate(measureRationale, { tokens, whyAttr: WHY_ATTR, redlineAttr: REDLINE_ATTR, schema: MEASURE_SCHEMA }); } catch (error) { measure = { error: String(error?.message ?? error).split('\n')[0] }; }
    let redline = null;
    if (rationale?.entries?.length) {
      const redlineFile = file.replace(/\.png$/i, '.redline.png');
      try {
        await page.evaluate(drawRedlines, { labels: redlineLabelsOf(rationale.entries), whyAttr: WHY_ATTR, redlineAttr: REDLINE_ATTR, leaf: REDLINE_LEAF_COMPONENTS });
        const bytes = await page.screenshot({ path: redlineFile, fullPage, animations: 'disabled', caret: 'hide' });
        redline = { path: redlineFile, sha256: sha256(bytes), rationale: rationale.file ?? null };
      } catch (error) { redline = { error: String(error?.message ?? error).split('\n')[0] }; }
    }
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
        horizontalOverflow: raw.scrollWidth > raw.pageWidth, overflowing: raw.overflowing, accentExempt: raw.accentExempt ?? [], artwork },
      consoleErrors, pageErrors, failedRequests,
      anatomy: raw.anatomy ?? { alerts: [], meters: [] },
      layer,
      ...(raw.ownership ? { ownership: raw.ownership } : {}),
      ...(domFile ? { dom: { path: domFile } } : {}),
      rendered: raw.rendered,
      image: { sha256: sha256(png), bytes: png.length },
      rationale: measure,
      redline,
    };
  } finally {
    if (tracing) { try { await context.tracing.stop({ path: traceFile }); } catch { /* the capture stands without its trace */ } }
    await context.close();
  }
}

/** Capture every viewport of one HTML file; writes the PNGs and records, returns the records. */
export async function captureHtml({ html, out, viewports, theme, fullPage, name, source, playwright, trace = false, rationale = undefined }) {
  fs.mkdirSync(out, { recursive: true });
  // The rationale beside the source (draw-rationale.mjs rationaleFileOf) labels the redline; an explicit one wins.
  const rationaleFile = rationale === undefined ? rationaleFileOf(html) : rationalePathOf(rationale);
  const why = rationaleFile ? { file: rationaleFile, entries: loadRationale(rationaleFile).entries } : null;
  const browser = await playwright.chromium.launch().catch((e) => { throw new UsageError(`${RENDER_TOOL_UNAVAILABLE}: chromium launch failed (${playwright.name} ${playwright.version}): ${e.message.split('\n')[0]}`); });
  const records = [];
  try {
    await eachInOrder(viewports, async (viewport) => {
      const base = captureBase(name, viewport, theme);
      const file = path.join(out, `${base}.png`);
      const traceFile = trace ? path.join(out, `${base}.trace.zip`) : null;
      const m = await captureViewport(browser, { url: pathToFileURL(html).href, viewport, theme, fullPage, file, traceFile, rationale: why });
      const failures = judgeCapture(m);
      const { rendered, image, rationale: measure, redline, ...measured } = m;
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
        ...(measure ? { rationale: measure } : {}),
        ...(redline ? { redline } : {}),
        tool: { playwright: `${playwright.name}@${playwright.version}`, settleMs: SETTLE_MS },
        ...(traceFile && fs.existsSync(traceFile) ? { trace: { path: traceFile } } : {}),
      };
      fs.writeFileSync(path.join(out, `${base}.json`), `${JSON.stringify(record, null, 2)}\n`);
      records.push(record);
    });
  } finally {
    await browser.close();
  }
  return records;
}

/* -------------------------------------------------------- fixture mode */

/** A package's root found by walking node_modules up from `dir` - for a package whose exports hide its package.json (a workspace package such as @acme/ui). */
const packageDirUp = (dir, name) => {
  for (let d = path.resolve(dir); ; d = path.dirname(d)) {
    const root = path.join(d, 'node_modules', ...name.split('/'));
    if (fs.existsSync(path.join(root, 'package.json'))) return { root: fs.realpathSync(root), packageFile: path.join(fs.realpathSync(root), 'package.json') };
    if (path.dirname(d) === d) return null;
  }
};

const cssFileOf = (id, base, aliases = {}) => {
  if (id.startsWith('.') || path.isAbsolute(id)) return path.resolve(base, id);
  const [scope, rest] = id.startsWith('@') ? [id.split('/').slice(0, 2).join('/'), id.split('/').slice(2).join('/')] : [id.split('/')[0], id.split('/').slice(1).join('/')];
  // A draw-time alias (the claude-dist grammar) wins over the product's install, for the CSS exactly as for the JS.
  const found = aliases[scope] ? { root: aliases[scope], packageFile: path.join(aliases[scope], 'package.json') } : (findPackage([base], [scope]) ?? packageDirUp(base, scope));
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

async function compileStylesheet(file, { dirs, esbuild, candidates, workDir, index, aliases = {} }) {
  const text = fs.readFileSync(file, 'utf8');
  if (/@import\s+["']tailwindcss(?:\/[^"']*)?["']|@tailwind\b/.test(text)) {
    const found = findPackage([path.dirname(file), ...dirs], ['tailwindcss']);
    if (!found) throw new UsageError(`${file} imports tailwindcss, which does not resolve from ${path.dirname(file)}`);
    const tw = requirePackage(found);
    const compiler = await tw.compile(text, {
      base: path.dirname(file),
      from: file,
      loadStylesheet: async (id, base) => { const p = cssFileOf(id, base, aliases); return { path: p, base: path.dirname(p), content: fs.readFileSync(p, 'utf8') }; },
      loadModule: async (id) => { throw new UsageError(`${file}: tailwind module ${id} (@plugin/@config) is not supported by draw-render`); },
    });
    return compiler.build(candidates);
  }
  const outfile = path.join(workDir, `global-${index}.css`);
  await esbuild.build({ entryPoints: [file], bundle: true, outfile, logLevel: 'silent', loader: ASSET_LOADERS,
    ...(aliases[GRAMMAR_PACKAGE] ? { alias: { [GRAMMAR_PACKAGE]: aliases[GRAMMAR_PACKAGE] } } : {}) });
  return fs.readFileSync(outfile, 'utf8');
}

const ASSET_LOADERS = Object.freeze({ '.png': 'file', '.jpg': 'file', '.jpeg': 'file', '.gif': 'file', '.webp': 'file', '.svg': 'file',
  '.woff': 'file', '.woff2': 'file', '.ttf': 'file', '.otf': 'file' });

const inside = (file, dir) => { if (!file || !dir) { return false; } const rel = path.relative(dir, file); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)); };

/**
 * The esbuild plugin of a real grammar drawing: @starci/grammar[/<sub>] resolves into `grammarRoot` (the chosen
 * grammar, product install or claude-dist), and every other bare import made from outside the product (the draw file,
 * the harness, the claude-dist grammar) resolves from the product app dir - one React, one HeroUI, the product's own.
 * A .draw.tsx is loaded with its layout elements stamped data-draw-layout (rendered-DOM ownership).
 */
const drawResolvePlugin = ({ productDir, grammarRoot }) => ({
  name: 'starci-draw-resolve',
  setup(build) {
    if (grammarRoot) build.onResolve({ filter: /^@starci\/grammar(?:\/.*)?$/ }, (args) => {
      const target = grammarEntry(grammarRoot, args.path.slice(GRAMMAR_PACKAGE.length).replace(/^\//, ''));
      return fs.existsSync(target) ? { path: target } : { errors: [{ text: `${args.path} does not resolve inside ${grammarRoot}` }] };
    });
    if (productDir) build.onResolve({ filter: /^[^./]/ }, async (args) => {
      if (args.pluginData?.starciDraw || path.isAbsolute(args.path)) return undefined;
      const fromProduct = inside(args.importer, productDir) && !(grammarRoot && inside(args.importer, grammarRoot));
      if (fromProduct) return undefined;
      const r = await build.resolve(args.path, { kind: args.kind, resolveDir: productDir, pluginData: { starciDraw: true } });
      return r.errors.length ? undefined : { path: r.path, external: r.external, sideEffects: r.sideEffects, namespace: r.namespace };
    });
    build.onLoad({ filter: /\.draw\.tsx$/ }, (args) => ({ contents: markLayoutElements(fs.readFileSync(args.path, 'utf8'), { file: args.path }), loader: 'tsx', resolveDir: path.dirname(args.path) }));
  },
});

/** The product app dir of a draw file: the nearest package.json above it that depends on @starci/grammar. */
function productDirOf(file) {
  for (let d = path.dirname(path.resolve(file)); ; d = path.dirname(d)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(d, 'package.json'), 'utf8'));
      if (pkg?.dependencies?.[GRAMMAR_PACKAGE] || pkg?.devDependencies?.[GRAMMAR_PACKAGE]) return d;
    } catch { /* no manifest here */ }
    if (path.dirname(d) === d) return null;
  }
}

/** The render provenance of the grammar a drawing rendered against (owner ruling 2026-09-27). */
function grammarProvenance(grammar) {
  return { grammarSource: grammar.grammarSource, source: grammar.pick?.source ?? null, version: grammar.pick?.version ?? null, root: grammar.pick?.root ?? null,
    productVersion: grammar.productVersion ?? null, productRange: grammar.productRange ?? null, upgradeOwed: grammar.upgradeOwed ?? null,
    typecheck: (grammar.attempts ?? []).map((a) => ({ source: a.source, version: a.version, ok: a.ok, errors: a.errors.length })) };
}

/**
 * Bundle a pure export with fixture props into <workDir>/index.html; returns that path and the source record.
 * `productDir` resolves every bare import (drawResolvePlugin); `grammar` is the draw-grammar.mjs resolution whose
 * pick the bundle and the CSS alias to, recorded as source.grammar.
 */
export async function buildFixtureHarness({ component, exportName, props, css, theme, workDir, cwd = process.cwd(), productDir = null, grammar = null }) {
  for (const f of [component, props, ...css]) if (!fs.existsSync(f)) throw new UsageError(`${f} does not exist`);
  let fixture;
  try { fixture = JSON.parse(fs.readFileSync(props, 'utf8')); } catch (e) { throw new UsageError(`${props}: ${e.message}`); }
  if (!fixture || typeof fixture !== 'object' || Array.isArray(fixture)) throw new UsageError(`${props} must hold the props object`);
  const dirs = [...(productDir ? [productDir] : []), path.dirname(component), cwd];
  const grammarRoot = grammar?.pick?.root ?? null;
  const aliases = grammarRoot && grammar.pick.source !== 'product' ? { [GRAMMAR_PACKAGE]: grammarRoot } : {};
  const found = esbuildInstall(dirs);
  if (!found) throw new UsageError(`${RENDER_TOOL_UNAVAILABLE}: no esbuild resolvable from ${dirs.join(', ')} or the runtime`);
  const esbuild = requirePackage(found);
  const entry = [
    "import * as React from 'react';",
    "import { flushSync } from 'react-dom';",
    "import { createRoot } from 'react-dom/client';",
    `import { ${exportName} as Base } from ${JSON.stringify(component.split(path.sep).join('/'))};`,
    'const noop = () => {};',
    `const revive = (v) => v === '__DRAW_NOOP__' ? noop : Array.isArray(v) ? v.map(revive) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, revive(x)])) : v;`,
    `const props = revive(${JSON.stringify(fixtureProps(fixture))});`,
    `if (typeof Base !== 'function' && !(Base && typeof Base === 'object')) throw new Error(${JSON.stringify(String(exportName) + ' is not a component export')});`,
    "const root = createRoot(document.getElementById('root'));",
    'flushSync(() => root.render(React.createElement(Base, props)));',
  ].join('\n');
  try {
    await esbuild.build({
      stdin: { contents: entry, resolveDir: path.dirname(component), loader: 'tsx', sourcefile: 'draw-harness.tsx' },
      bundle: true, format: 'iife', platform: 'browser', jsx: 'automatic', outdir: workDir, entryNames: 'harness',
      assetNames: 'assets/[name]-[hash]', loader: ASSET_LOADERS, logLevel: 'silent',
      define: { 'process.env.NODE_ENV': '"production"' },
      ...(productDir || grammarRoot || component.endsWith(DRAW_SOURCE_SUFFIX) ? { plugins: [drawResolvePlugin({ productDir, grammarRoot })] } : {}),
    });
  } catch (e) {
    throw new UsageError(`esbuild could not bundle ${exportName} from ${component}: ${(e.errors ?? []).slice(0, 5).map((x) => (x.location?.file ?? '') + ':' + (x.location?.line ?? '') + ' ' + x.text).join('; ') || e.message}`);
  }
  const js = fs.readFileSync(path.join(workDir, 'harness.js'), 'utf8');
  const candidates = classCandidates(js);
  const globals = await mapInOrder(css.entries(), ([index, file]) => compileStylesheet(file, { dirs, esbuild, candidates, workDir, index, aliases }));
  fs.writeFileSync(path.join(workDir, 'global.css'), globals.join('\n'));
  const links = ['global.css', ...(fs.existsSync(path.join(workDir, 'harness.css')) ? ['harness.css'] : [])].map((h) => `<link rel="stylesheet" href="${h}">`).join('');
  const html = path.join(workDir, 'index.html');
  fs.writeFileSync(html, `<!doctype html><html lang="en" class="${theme}" data-theme="${theme}" data-draw-harness="component" style="color-scheme:${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${links}</head><body><div id="root"></div><script src="harness.js"></script></body></html>\n`);
  const digest = (f) => ({ path: f, sha256: sha256(fs.readFileSync(f)) });
  return { html, source: { mode: 'component', component: digest(component), export: exportName, props: digest(props), css: css.map(digest), esbuild: found.version,
    ...(productDir ? { product: productDir } : {}), ...(grammar ? { grammar: grammarProvenance(grammar) } : {}) } };
}

/* ------------------------------------------------------------------ main */

export async function run(argv, { cwd = process.cwd() } = {}) {
  const o = parseArgs(argv);
  if (o.html && !fs.existsSync(o.html)) throw new UsageError(`${o.html} does not exist`);
  const anchor = o.html ? path.dirname(o.html) : path.dirname(o.component);
  // The product app of a drawing that lives outside it (a ui record dir, a temp dir): --product, else the nearest
  // grammar-depending package above the draw file, else above one of its --css stylesheets (the product's own).
  const inferred = o.component ? (o.product ?? productDirOf(o.component) ?? (o.css ?? []).flat().map(productDirOf).find(Boolean) ?? null) : null;
  const playwright = loadPlaywright([anchor, ...(inferred ? [inferred] : []), cwd]);
  if (o.mode === 'html') {
    return captureHtmlPage(o, playwright);
  }
  return captureComponent(o, { cwd, inferred, playwright });
}

function captureHtmlPage(options, playwright) {
  const source = { mode: 'html', html: { path: options.html, sha256: sha256(fs.readFileSync(options.html)) } };
  return captureHtml({ ...options, source, playwright, rationale: options.rationale ?? undefined });
}

async function captureComponent(options, { cwd, inferred, playwright }) {
  // A real grammar drawing: the product app it renders in, and the grammar it type-checks against (draw-grammar.mjs).
  const drawing = options.component.endsWith(DRAW_SOURCE_SUFFIX) || Boolean(options.product || options.grammar || options.grammarDist);
  const productDir = drawing ? inferred : null;
  if (drawing && !productDir) throw new UsageError(`${options.component}: give --product <app dir> (no package.json depending on ${GRAMMAR_PACKAGE} above it or above a --css file)`);
  let grammar = null;
  if (drawing) {
    if (options.grammarDist) preflightDrawGrammarDist(options.grammarDist);
    grammar = resolveDrawGrammar({ file: options.component, productDir, prefer: options.grammar ?? 'auto', grammarDist: options.grammarDist ?? null });
    if (grammar.pick?.source === 'claude-dist') preflightDrawGrammarDist(grammar.pick.root);
    if (!grammar.ok) throw new RedError(typecheckFindings(grammar.attempts.at(-1) ?? { ok: false, errors: [{ message: grammar.error }] }, { label: path.basename(options.component) })[0]?.detail ?? grammar.error, 'DRAW_TYPECHECK_FAILED');
  }
  const workDir = makeTempDir('starci-draw-render-');
  try {
    const { html, source } = await buildFixtureHarness({ component: options.component, exportName: options.export, props: options.props, css: options.css, theme: options.theme, workDir, cwd, productDir, grammar });
    // A drawing's rationale sits beside its draw source (draw-source.mjs rationaleFileFor), never beside the harness.
    const records = await captureHtml({ ...options, html, source, playwright, rationale: options.rationale ?? (drawing ? rationaleFileFor(options.component) : null) });
    if (options.harnessOut) { fs.mkdirSync(options.harnessOut, { recursive: true }); fs.cpSync(workDir, options.harnessOut, { recursive: true }); }
    return records;
  } finally {
    safeRemove(workDir, { hold: artifactHoldReason });
  }
}

function renderErrorMessage(error, usage) {
  if (!(usage || error instanceof RedError)) { return error.stack; }
  if (error.code) { return '[' + error.code + '] ' + error.message; }
  return error.message;
}

function reportRecords(records, json) {
  const ok = records.every((record) => record.ok);
  if (json) { process.stdout.write(`${JSON.stringify({ ok, records }, null, 2)}\n`); }
  else {
    for (const record of records) { process.stdout.write(`${record.ok ? 'ok  ' : 'RED '} ${record.image.path}${record.failures.length ? '  ' + record.failures.join(', ') : ''}\n`); }
  }
  process.exitCode = ok ? EXIT.ok : EXIT.red;
}

function reportError(error, json) {
  const usage = error instanceof UsageError;
  if (json) { process.stdout.write(`${JSON.stringify({ ok: false, error: error.message, ...(error.code ? { code: error.code } : {}) }, null, 2)}\n`); }
  process.stderr.write('draw-render: ' + renderErrorMessage(error, usage) + '\n');
  process.exitCode = usage ? EXIT.usage : EXIT.red;
}

async function main() {
  const argv = process.argv.slice(2);
  const json = argv.includes('--json');
  try {
    reportRecords(await run(argv), json);
  } catch (error) {
    reportError(error, json);
  }
}

if (isMain(import.meta.url)) await main();
