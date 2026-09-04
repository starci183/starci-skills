// @tools/browsercontrol, mode playwright — the runner of a declarative walk (templates/kinds/uat-walk.schema.json).
//
//   node scripts/browser-walk.mjs <walk.json> <response dir> [--host-root <dir>]
//
// The agent writes the walk; this script executes it and writes what a receipt can be checked against.
// Playwright and Chromium are installed once at the host, outside the tree, where resources/tools.json
// → browsercontrol.install says (the parent of the runtime, scripts/validate-request.mjs#hostRootOf);
// a missing install exits with the wording environment.preflight reports for host.playwright, and
// nothing is installed here. Chromium runs headless in one fresh context per run — the walk's own
// storage, viewport, deviceScaleFactor, colorScheme, reducedMotion and locale, never a person's profile.
// Steps run in order; every locator is getByRole over the walk's target and nothing else; the first
// failed step ends the run — nothing is retried and no locator is guessed. A credential is resolved by
// name from the sealed reference the walk's account declares, at the fill and nowhere else: it reaches
// the form field, is masked in every screenshot, and is refused from every file this runner writes.
// Under <response dir> it writes data/walks/<id>/{walk.json, walk-result.json, capture.json, trace.zip},
// artifacts/<name>.{png,ax.txt,dom.json,measurements.json} per capture, and for a UAT walk
// data/captures/<case>.json in the uat-capture shape with every control copied from the walk.
//
// A capture is not a measurement: a screenshot, an accessibility snapshot and a DOM record carry no
// computed value, and the agent may run no browser code. So this runner — tree code, not agent code —
// evaluates one self-contained function in the page at every capture and writes the
// capture-measurements record (templates/kinds/capture-measurements.schema.json): boxes, computed
// styles, effective backgrounds and WCAG contrast for the accessibility tree's elements and every
// element carrying an id, a data-contract or a data-testid. Every number a measurable proof lane
// judges under this mode is read from that record and cited by ref.
//
// The ledger labels each step with the control the step itself named (validate-walk#stepOwnControl):
// its own target, the entry route for the goto, null for a capture, a wait or a url-only expectation —
// never the previous step's target, so a failed targetless step is not read as a failure of a button.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { hostRootOf } from './validate-request.mjs';
import { walkErrors, sweepWalkText, sweepFindingErrors, walkFingerprint, originOf, isCredential, walkFiles, stepControl, stepOwnControl, controlString, controlOfStep, loadMeasurementsSchema } from './validate-walk.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CHECK_ID = 'host.playwright';
const DEFAULT_TIMEOUT = 10000;

// Where the host keeps its one Playwright: read from the tool registry, never spelled here.
export function playwrightInstallOf(hostRoot, root = ROOT) {
  const tools = JSON.parse(readFileSync(path.join(root, 'resources', 'tools.json'), 'utf8'));
  const install = tools.tools?.browsercontrol?.install ?? {};
  const dir = path.resolve(hostRoot, install.path ?? '.tools/playwright');
  return { root: dir, browsers: path.resolve(hostRoot, install.browsersPath ?? '.tools/playwright/browsers'), module: path.join(dir, 'node_modules', 'playwright', 'package.json'), command: install.command ?? 'npm init -y && npm i playwright && npx playwright install chromium' };
}
// Present when the package resolves under the install and a Chromium sits under its browsers path.
export function playwrightInstallStatus(hostRoot, root = ROOT) {
  const install = playwrightInstallOf(hostRoot, root);
  const modulePresent = existsSync(install.module);
  let chromium = false;
  try { chromium = readdirSync(install.browsers).some((name) => /^chromium/.test(name)); } catch { chromium = false; }
  return { ...install, modulePresent, chromium, present: modulePresent && chromium };
}
// The one wording of the wall, shared by the preflight report and this runner's exit.
export function missingInstallMessage(hostRoot, root = ROOT) {
  const install = playwrightInstallOf(hostRoot, root);
  return `${CHECK_ID}: no Playwright install at ${install.root}; install once at the host, outside the tree: mkdir -p ${install.root} && cd ${install.root} && PLAYWRIGHT_BROWSERS_PATH=${install.browsers} ${install.command}`;
}
export function loadPlaywright(hostRoot, root = ROOT) {
  const status = playwrightInstallStatus(hostRoot, root);
  if (!status.present) throw Object.assign(new Error(missingInstallMessage(hostRoot, root)), { code: 'PLAYWRIGHT_MISSING' });
  process.env.PLAYWRIGHT_BROWSERS_PATH = status.browsers;
  const require = createRequire(path.join(status.root, 'package.json'));
  return { playwright: require('playwright'), version: JSON.parse(readFileSync(status.module, 'utf8')).version };
}

// The sealed shared password, resolved the way the identity runner resolves it: SOPS with the host's
// master identity, at the moment of the fill. The value is returned to the caller and to nothing else.
export function resolveCredential(hostRoot, credentialRef) {
  if (!/^\.stacks\/[a-z0-9][a-z0-9-]*\/secrets\/uat\.enc$/.test(credentialRef)) throw new Error('credential reference is not a sealed UAT file');
  const deviceState = JSON.parse(readFileSync(path.join(hostRoot, '.workspaces', 'device-state.json'), 'utf8'));
  const masterRef = deviceState.encryption?.masterIdentity;
  if (typeof masterRef !== 'string') throw new Error('device-state declares no master identity');
  const masterFile = masterRef.startsWith('~/') ? path.join(os.homedir(), masterRef.slice(2)) : path.resolve(hostRoot, masterRef);
  const value = execFileSync('sops', ['--decrypt', '--input-type', 'binary', '--output-type', 'binary', path.resolve(hostRoot, credentialRef)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, SOPS_AGE_KEY_FILE: masterFile } }).trim();
  if (!value) throw new Error('the sealed credential resolved to nothing');
  return value;
}

const now = () => new Date().toISOString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function poll(fn, timeout, label) {
  const until = Date.now() + timeout;
  let last = null;
  for (;;) {
    try { const r = await fn(); if (r.ok) return r; last = r.detail; } catch (e) { last = e.message; }
    if (Date.now() >= until) throw new Error(`${label} not observed within ${timeout}ms${last ? ` (last: ${String(last).slice(0, 120)})` : ''}`);
    await sleep(100);
  }
}
const describeExpect = (expect) => Object.entries(expect).map(([k, v]) => (v === true ? k : `${k} ${JSON.stringify(v)}`)).join(', ');
// An error message that names no resolved value and fits a result: first line, redacted, bounded.
function scrub(message, secrets) {
  let text = String(message ?? 'failed').split(/\r?\n/)[0];
  for (const s of secrets) if (s && text.includes(s)) text = text.split(s).join('[redacted]');
  return text.slice(0, 380) || 'failed';
}
function refuseLeak(text, secrets, what) {
  for (const s of secrets) if (s && s.length >= 4 && String(text).includes(s)) throw Object.assign(new Error(`OUTPUT_SECRET_DETECTED in ${what}; nothing was written`), { code: 'OUTPUT_SECRET_DETECTED' });
  return text;
}
const locatorOf = (page, target) => { let l = page.getByRole(target.role, { name: target.name, exact: target.exact ?? false }); if (target.nth !== undefined) l = l.nth(target.nth); return l; };

// Runs inside the page, once per capture, serialized by Playwright: it may reference nothing from this
// module and loads no library. It returns the `elements` of a capture-measurements record — one entry
// per element the accessibility tree exposes (an explicit role, or the implicit role of its tag, and
// rendered) plus every element carrying an id, a data-contract or a data-testid, in document order,
// capped at `cap` with the tagged, interactive, heading, landmark, image, dialog and status elements
// kept first. `ref` spells role and accessible name the way a walk target does, with ` nth=<n>` when
// the pair repeats, else a stable CSS path from body. `computed.backgroundColor` is the effective
// background — the nearest opaque one up the tree, composited through translucent layers, the canvas
// counting as white — and `contrast` is the WCAG ratio of the colour over it, null when either does
// not resolve to sRGB.
function measurePage({ cap }) {
  const IMPLICIT = { area: 'link', button: 'button', h1: 'heading', h2: 'heading', h3: 'heading', h4: 'heading', h5: 'heading', h6: 'heading', img: 'img', select: 'combobox', textarea: 'textbox', nav: 'navigation', main: 'main', header: 'banner', footer: 'contentinfo', aside: 'complementary', form: 'form', table: 'table', thead: 'rowgroup', tbody: 'rowgroup', tfoot: 'rowgroup', tr: 'row', th: 'columnheader', td: 'cell', ul: 'list', ol: 'list', menu: 'list', li: 'listitem', p: 'paragraph', dialog: 'dialog', article: 'article', hr: 'separator', progress: 'progressbar', meter: 'meter', option: 'option', optgroup: 'group', datalist: 'listbox', summary: 'button', details: 'group', fieldset: 'group', figure: 'figure', blockquote: 'blockquote', code: 'code', em: 'emphasis', strong: 'strong', time: 'time', output: 'status', search: 'search', sub: 'subscript', sup: 'superscript', del: 'deletion', ins: 'insertion', math: 'math' };
  const INPUT = { button: 'button', submit: 'button', reset: 'button', image: 'button', checkbox: 'checkbox', radio: 'radio', range: 'slider', number: 'spinbutton', search: 'searchbox', hidden: null };
  const NAME_FROM_CONTENT = new Set(['button', 'link', 'heading', 'cell', 'columnheader', 'rowheader', 'option', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'checkbox', 'radio', 'switch', 'tooltip', 'treeitem']);
  const KEPT_FIRST = new Set(['button', 'link', 'heading', 'textbox', 'searchbox', 'combobox', 'checkbox', 'radio', 'switch', 'slider', 'spinbutton', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'treeitem', 'navigation', 'main', 'banner', 'contentinfo', 'complementary', 'region', 'form', 'search', 'img', 'dialog', 'alertdialog', 'alert', 'status', 'progressbar', 'meter']);
  const collapse = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const textOf = (el) => collapse(typeof el.innerText === 'string' ? el.innerText : el.textContent);
  const roleOf = (el) => {
    const explicit = el.getAttribute('role');
    if (explicit && collapse(explicit)) return collapse(explicit).split(' ')[0];
    const tag = el.tagName.toLowerCase();
    if (tag === 'input') { const type = (el.getAttribute('type') || 'text').toLowerCase(); if (Object.hasOwn(INPUT, type)) return INPUT[type]; return el.hasAttribute('list') ? 'combobox' : 'textbox'; }
    if (tag === 'a' || tag === 'area') return el.hasAttribute('href') ? 'link' : null;
    if (tag === 'section') return el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby') ? 'region' : null;
    if (tag === 'header' || tag === 'footer') return el.parentElement && el.parentElement.closest('article, aside, main, nav, section') ? null : IMPLICIT[tag];
    return Object.hasOwn(IMPLICIT, tag) ? IMPLICIT[tag] : null;
  };
  const nameOf = (el, role) => {
    const label = el.getAttribute('aria-label');
    if (label && collapse(label)) return collapse(label);
    const by = el.getAttribute('aria-labelledby');
    if (by) { const t = collapse(by.split(/\s+/).map((id) => { const n = document.getElementById(id); return n ? n.textContent : ''; }).join(' ')); if (t) return t; }
    const tag = el.tagName.toLowerCase();
    if (tag === 'img' || tag === 'area') { const alt = el.getAttribute('alt'); if (alt !== null && collapse(alt)) return collapse(alt); }
    if (tag === 'input' && role === 'button') { const v = el.getAttribute('value'); if (v && collapse(v)) return collapse(v); }
    if (el.labels && el.labels.length) { const t = collapse(Array.from(el.labels).map((l) => l.textContent).join(' ')); if (t) return t; }
    if (NAME_FROM_CONTENT.has(role)) { const t = textOf(el); if (t) return t; }
    const title = el.getAttribute('title');
    if (title && collapse(title)) return collapse(title);
    const placeholder = el.getAttribute('placeholder');
    if (placeholder && collapse(placeholder)) return collapse(placeholder);
    return '';
  };
  const pathOf = (el) => {
    const parts = [];
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const tag = n.tagName.toLowerCase();
      if (tag !== 'body' && n.id && /^[A-Za-z_][\w-]*$/.test(n.id)) { parts.unshift(`${tag}#${n.id}`); break; }
      const same = n.parentElement ? Array.from(n.parentElement.children).filter((c) => c.tagName === n.tagName) : [n];
      parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(n) + 1})` : tag);
      if (tag === 'body') break;
    }
    return parts.join('>');
  };
  const alphaOf = (s) => (s === undefined ? 1 : s.endsWith('%') ? parseFloat(s) / 100 : parseFloat(s));
  const parseColor = (s) => {
    const text = String(s || '').trim();
    const m = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/.exec(text);
    if (m) return { r: +m[1], g: +m[2], b: +m[3], a: alphaOf(m[4]) };
    const c = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+%?)\s*)?\)$/.exec(text);
    if (c) return { r: +c[1] * 255, g: +c[2] * 255, b: +c[3] * 255, a: alphaOf(c[4]) };
    return null;
  };
  const blend = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  const WHITE = { r: 255, g: 255, b: 255, a: 1 };
  const bgCache = new Map();
  const effectiveBg = (el) => {
    if (!el) return WHITE;
    if (bgCache.has(el)) return bgCache.get(el);
    const own = parseColor(getComputedStyle(el).backgroundColor);
    let out;
    if (!own) out = null;
    else if (own.a >= 1) out = own;
    else { const under = effectiveBg(el.parentElement); out = under === null ? null : own.a <= 0 ? under : blend(own, under); }
    bgCache.set(el, out);
    return out;
  };
  const channel = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const luminance = ({ r, g, b }) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  const rgbString = (c) => `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;
  const round2 = (n) => Math.round(n * 100) / 100;
  const picked = [];
  const all = document.body ? Array.from(document.body.querySelectorAll('*')) : [];
  for (const el of all) {
    const tagged = Boolean(el.id) || el.hasAttribute('data-contract') || el.hasAttribute('data-testid');
    const role = roleOf(el);
    const rendered = el.getClientRects().length > 0 && !el.closest('[aria-hidden="true"]') && getComputedStyle(el).visibility !== 'hidden';
    if (!tagged && !(role && rendered)) continue;
    picked.push({ el, role, tagged, order: picked.length });
  }
  let chosen = picked;
  if (picked.length > cap) {
    const first = picked.filter((p) => p.tagged || KEPT_FIRST.has(p.role));
    const rest = picked.filter((p) => !(p.tagged || KEPT_FIRST.has(p.role)));
    chosen = [...first.slice(0, cap), ...rest.slice(0, Math.max(0, cap - first.length))].sort((a, b) => a.order - b.order);
  }
  const keyed = chosen.map((p) => { const name = p.role ? nameOf(p.el, p.role) : ''; return { ...p, key: p.role && name ? `${p.role} ${JSON.stringify(name)}` : null }; });
  const counts = new Map();
  for (const p of keyed) if (p.key) counts.set(p.key, (counts.get(p.key) || 0) + 1);
  const seen = new Map();
  return keyed.map((p) => {
    const { el } = p;
    let ref = pathOf(el);
    if (p.key) { const n = seen.get(p.key) || 0; seen.set(p.key, n + 1); ref = counts.get(p.key) > 1 ? `${p.key} nth=${n}` : p.key; }
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const fg = parseColor(style.color);
    const bg = effectiveBg(el);
    let contrast = null;
    if (fg && bg) { const over = fg.a < 1 ? blend(fg, bg) : fg; const l1 = luminance(over); const l2 = luminance(bg); contrast = round2((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)); }
    const entry = {
      ref, tag: el.tagName.toLowerCase(),
      bbox: { x: round2(rect.x), y: round2(rect.y), width: round2(rect.width), height: round2(rect.height) },
      computed: {
        fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight, color: style.color,
        backgroundColor: bg ? rgbString(bg) : style.backgroundColor, minHeight: style.minHeight,
        padding: { top: style.paddingTop, right: style.paddingRight, bottom: style.paddingBottom, left: style.paddingLeft },
        margin: { top: style.marginTop, right: style.marginRight, bottom: style.marginBottom, left: style.marginLeft },
        gap: { row: style.rowGap, column: style.columnGap },
        borderRadius: style.borderRadius,
        border: { top: style.borderTop, right: style.borderRight, bottom: style.borderBottom, left: style.borderLeft },
        overflow: { x: style.overflowX, y: style.overflowY },
        display: style.display, visibility: style.visibility,
      },
      contrast,
      text: textOf(el).slice(0, 80),
    };
    const contract = el.getAttribute('data-contract');
    if (contract !== null) entry.dataContract = collapse(contract).split(' ').filter(Boolean);
    return entry;
  });
}

export async function runWalk(walkFile, responseDir, { hostRoot = hostRootOf(ROOT), root = ROOT, log = () => {} } = {}) {
  const bytes = readFileSync(walkFile);
  const text = bytes.toString('utf8');
  let walk; try { walk = JSON.parse(text); } catch (e) { return { code: 2, errors: [`${walkFile}: ${e.message}`] }; }
  const errors = [...walkErrors(walk, { root, at: path.basename(walkFile) }), ...sweepFindingErrors(sweepWalkText(text, originOf(walk?.entry?.route), { file: path.basename(walkFile) }))];
  if (errors.length) return { code: 2, errors };
  const files = walkFiles(walk.id);
  // Every ref the receipt carries is branch-relative (response/…); <response dir> is that folder.
  const under = (ref) => path.join(responseDir, ref.replace(/^response\//, ''));
  const walkDir = path.join(responseDir, 'data', 'walks', walk.id);
  if (existsSync(under(files.result))) return { code: 2, errors: [`${files.result}: a result already exists; a walk is run once, and a second attempt is a new walk id`] };
  let loaded; try { loaded = loadPlaywright(hostRoot, root); } catch (e) { return { code: 3, errors: [e.message] }; }
  const { playwright, version } = loaded;
  const measureCap = loadMeasurementsSchema(root).properties.elements.maxItems;

  mkdirSync(walkDir, { recursive: true });
  mkdirSync(path.join(responseDir, 'artifacts'), { recursive: true });
  mkdirSync(path.join(responseDir, 'data', 'captures'), { recursive: true });
  writeFileSync(under(files.walk), bytes);

  const timeout = walk.entry.stepTimeoutMs ?? DEFAULT_TIMEOUT;
  const secrets = [];
  const maskTargets = [];
  const ledger = [];
  const captures = [];
  const startedAt = now();
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: walk.entry.viewport.width, height: walk.entry.viewport.height },
    deviceScaleFactor: walk.entry.viewport.deviceScaleFactor,
    colorScheme: walk.entry.colorScheme,
    reducedMotion: walk.entry.reducedMotion,
    locale: walk.entry.locale,
  });
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();
  let firstFailure = null;

  const capture = async (name, step, { fullPage = false } = {}) => {
    const shot = path.join(responseDir, 'artifacts', `${name}.png`);
    await page.screenshot({ path: shot, fullPage, mask: maskTargets.map((t) => locatorOf(page, t)) });
    let ax;
    try { ax = await page.locator('body').ariaSnapshot(); } catch { ax = JSON.stringify(await page.accessibility.snapshot(), null, 2); }
    const dom = JSON.stringify({ url: page.url(), title: await page.title(), html: await page.content() }, null, 2);
    // The measurement, in one evaluation of the page-side function above; the cap is the kind's own.
    const elements = await page.evaluate(measurePage, { cap: measureCap });
    const measurements = JSON.stringify({ schemaVersion: 9, capture: name, viewport: [walk.entry.viewport.width, walk.entry.viewport.height], deviceScaleFactor: walk.entry.viewport.deviceScaleFactor, colorScheme: walk.entry.colorScheme, elements }, null, 2);
    writeFileSync(path.join(responseDir, 'artifacts', `${name}.ax.txt`), refuseLeak(ax, secrets, `${name}.ax.txt`));
    writeFileSync(path.join(responseDir, 'artifacts', `${name}.dom.json`), refuseLeak(dom, secrets, `${name}.dom.json`));
    writeFileSync(path.join(responseDir, 'artifacts', `${name}.measurements.json`), refuseLeak(measurements, secrets, `${name}.measurements.json`));
    const record = { name, stepId: step.id, screenshotRef: `response/artifacts/${name}.png`, axRef: `response/artifacts/${name}.ax.txt`, domRef: `response/artifacts/${name}.dom.json`, measurementsRef: `response/artifacts/${name}.measurements.json` };
    captures.push(record);
    return record;
  };

  const run = async (step) => {
    const target = step.target ? locatorOf(page, step.target) : null;
    switch (step.action) {
      case 'goto': await page.goto(walk.entry.route, { waitUntil: 'load', timeout }); return 'navigated to the entry route';
      case 'click': await target.click({ timeout }); return 'clicked';
      case 'fill': {
        let value = step.value;
        if (isCredential(value)) {
          let resolved; try { resolved = resolveCredential(hostRoot, walk.account.credentialRef); } catch (e) { throw new Error(`credential ${value.credential} could not be resolved by name from ${walk.account.credentialRef}: ${scrub(e.message, secrets)}`); }
          secrets.push(resolved); maskTargets.push(step.target); value = resolved;
          await target.fill(value, { timeout });
          return `filled credential ${step.value.credential} by name`;
        }
        await target.fill(value, { timeout }); return 'filled';
      }
      case 'press': if (target) await target.press(step.value, { timeout }); else await page.keyboard.press(step.value); return `pressed ${step.value}`;
      case 'select': await target.selectOption(step.value, { timeout }); return `selected ${JSON.stringify(step.value)}`;
      case 'check': if (step.value === false) await target.uncheck({ timeout }); else await target.check({ timeout }); return step.value === false ? 'unchecked' : 'checked';
      case 'wait': if (target) await target.waitFor({ state: 'visible', timeout }); else await sleep(step.value); return target ? 'visible' : `waited ${step.value}ms`;
      case 'capture': await capture(step.capture.name, step, { fullPage: step.capture.fullPage ?? false }); return `captured ${step.capture.name}`;
      case 'expect': {
        const e = step.expect;
        if (e.visible) await target.waitFor({ state: 'visible', timeout });
        if (e.hidden) await target.waitFor({ state: 'hidden', timeout });
        if (e.url !== undefined) await poll(async () => { const p = new URL(page.url()).pathname; return { ok: p === e.url, detail: p }; }, timeout, `url ${e.url}`);
        if (e.text !== undefined) await poll(async () => { const t = (await target.textContent()) ?? ''; return { ok: t.includes(e.text), detail: t.trim().slice(0, 80) }; }, timeout, `text ${JSON.stringify(e.text)}`);
        if (e.count !== undefined) await poll(async () => { const c = await target.count(); return { ok: c === e.count, detail: c }; }, timeout, `count ${e.count}`);
        if (e.attribute) await poll(async () => { const v = await target.getAttribute(e.attribute.name); return { ok: v === e.attribute.value, detail: v }; }, timeout, `attribute ${e.attribute.name}`);
        if (e.checked !== undefined) await poll(async () => { const c = await target.isChecked(); return { ok: c === e.checked, detail: c }; }, timeout, `checked ${e.checked}`);
        if (e.value !== undefined) await poll(async () => { const v = await target.inputValue(); return { ok: v === e.value, detail: v.length }; }, timeout, `value`);
        return `observed ${describeExpect(e)}`;
      }
      default: throw new Error(`unknown action ${step.action}`);
    }
  };

  try {
    for (const step of walk.steps) {
      const control = stepOwnControl(walk, step.id);
      if (firstFailure) { ledger.push({ id: step.id, action: step.action, control, outcome: 'skipped', url: null, startedAt: null, ms: 0 }); continue; }
      const t0 = Date.now();
      const stepStart = now();
      let outcome = 'pass'; let observed;
      try { observed = await run(step); }
      catch (e) {
        outcome = 'fail';
        observed = scrub(e.message, secrets);
        firstFailure = { stepId: step.id, message: observed };
        // Evidence of the failure: the frame at the moment the walk stopped, for the case it stood in.
        const caseId = step.assertion?.caseId;
        if (caseId && !captures.some((c) => c.name === caseId)) { try { await capture(caseId, step); } catch { /* the frame is the evidence that was lost */ } }
      }
      const url = page.isClosed() ? null : page.url();
      ledger.push({ id: step.id, action: step.action, control, outcome, url, startedAt: stepStart, ms: Date.now() - t0, observed });
      log(`${outcome === 'pass' ? 'ok  ' : 'FAIL'} ${step.id} ${step.action} ${control ?? ''} — ${observed}`);
    }
  } finally {
    try { await context.tracing.stop({ path: under(files.trace) }); } catch { /* the trace is a convenience */ }
    await context.close();
    await browser.close();
  }
  const finishedAt = now();

  // What the receipt is checked against. The ledger carries every step with its control; the result
  // carries pass or fail per step and the first failure; a UAT walk also yields one uat-capture per
  // frozen case, every control copied from the walk step that produced the assertion.
  const ledgerDoc = { schemaVersion: 9, walkRef: files.walk, steps: ledger };
  writeFileSync(under(files.ledger), refuseLeak(`${JSON.stringify(ledgerDoc, null, 2)}\n`, secrets, 'capture.json'));
  const result = {
    schemaVersion: 9, mode: 'playwright', walkRef: files.walk, walkFingerprint: walkFingerprint(bytes), route: walk.entry.route,
    outcome: firstFailure ? 'fail' : 'pass', startedAt, finishedAt,
    driver: { playwright: version, browser: 'chromium', browserVersion: browser.version(), headless: true, context: { fresh: true, viewport: [walk.entry.viewport.width, walk.entry.viewport.height], deviceScaleFactor: walk.entry.viewport.deviceScaleFactor, colorScheme: walk.entry.colorScheme, reducedMotion: walk.entry.reducedMotion, locale: walk.entry.locale } },
    steps: ledger.map(({ id, action, control, outcome, url, ms }) => ({ id, action, control, outcome, url, ms })),
    firstFailure, captures, traceRef: files.trace, ledgerRef: files.ledger,
  };
  writeFileSync(under(files.result), refuseLeak(`${JSON.stringify(result, null, 2)}\n`, secrets, 'walk-result.json'));
  const uatCaptures = [];
  for (const c of walk.run?.cases ?? []) {
    const steps = walk.steps.filter((s) => s.assertion?.caseId === c.caseId);
    const entries = steps.map((s) => ({ step: s, row: ledger.find((l) => l.id === s.id) }));
    if (entries.every(({ row }) => row.outcome === 'skipped')) continue;
    const shot = captures.find((x) => x.name === c.caseId);
    if (!shot) continue;
    const assertions = entries.filter(({ row }) => row.outcome !== 'skipped').map(({ step, row }) => ({
      assertionId: step.assertion.assertionId, lane: step.assertion.lane,
      observed: `${controlString(controlOfStep(walk, step.id))}: ${row.observed}`,
      control: stepControl(walk, step.id), evidenceRef: shot.screenshotRef, outcome: row.outcome, stepId: step.id,
    }));
    if (!assertions.length) continue;
    const doc = {
      caseId: c.caseId, runId: walk.run.runId, order: c.order, executedAt: entries.find(({ row }) => row.startedAt)?.row.startedAt ?? startedAt,
      screenshotRef: shot.screenshotRef, loginFieldMasked: true, captureStartedAfterRedirect: true,
      outcome: assertions.every((a) => a.outcome === 'pass') && entries.length === assertions.length ? 'pass' : 'fail',
      driver: { mode: 'playwright', walkRef: files.walk, resultRef: files.result, measurementsRef: shot.measurementsRef },
      assertions,
    };
    const file = `response/data/captures/${c.caseId}.json`;
    writeFileSync(path.join(responseDir, 'data', 'captures', `${c.caseId}.json`), refuseLeak(`${JSON.stringify(doc, null, 2)}\n`, secrets, file));
    uatCaptures.push(file);
  }
  return { code: firstFailure ? 1 : 0, errors: [], result, files: { ...files, captures: uatCaptures } };
}

function parseArgs(argv) {
  const out = { walk: null, out: null, hostRoot: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--host-root') out.hostRoot = path.resolve(argv[++i]);
    else if (!out.walk) out.walk = path.resolve(a);
    else if (!out.out) out.out = path.resolve(a);
    else throw new Error(`unknown argument ${a}`);
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.walk || !opts.out) { process.stderr.write('usage: node scripts/browser-walk.mjs <walk.json> <response dir> [--host-root <dir>]\n'); process.exit(2); }
  const { code, errors, result } = await runWalk(opts.walk, opts.out, { hostRoot: opts.hostRoot ?? hostRootOf(ROOT), log: (line) => process.stdout.write(`${line}\n`) });
  if (errors.length) process.stderr.write(`${errors.join('\n')}\n`);
  else process.stdout.write(`${result.outcome}: ${result.steps.filter((s) => s.outcome === 'pass').length}/${result.steps.length} steps, ${result.captures.length} capture(s), ${result.walkRef}\n`);
  process.exitCode = code;
}
