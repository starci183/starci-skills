import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { findPackage } from '../scripts/lib/package-at.mjs';
import { allocationSettings } from '../engine/config.mjs';
import {
  SETTLE_MS, UsageError, captureBase, classCandidates, fixtureProps, judgeCapture, parseArgs, parseViewports, resolveFontStacks, splitFontStack,
} from '../scripts/work/draw-render.mjs';

// scripts/work/draw-render.mjs is the capture interface.draw uses for code-native regions. The pure pieces run
// everywhere; the browser captures need a project-local Playwright with Chromium: they run from
// STARCI_PLAYWRIGHT_DIR (a directory whose node_modules holds playwright) and are skipped where there is none.
// The fixture capture also needs examples/shape-slot's installed node_modules (or STARCI_SHAPE_SLOT_DIR).
const ROOT = path.resolve(import.meta.dirname, '..');
const CLI = path.join(ROOT, 'scripts', 'work', 'draw-render.mjs');
const PW_DIR = [process.env.STARCI_PLAYWRIGHT_DIR, ROOT].find((d) => d && findPackage([d], ['playwright', '@playwright/test']));
const SHAPE_SLOT = [process.env.STARCI_SHAPE_SLOT_DIR, path.join(ROOT, 'examples', 'shape-slot')]
  .find((d) => d && fs.existsSync(path.join(d, 'node_modules', 'react-dom')) && fs.existsSync(path.join(d, 'node_modules', 'esbuild')));
const NO_BROWSER = PW_DIR ? false : 'no project-local playwright (set STARCI_PLAYWRIGHT_DIR)';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'starci-draw-render-spec-'));
const cli = (args, cwd) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', timeout: 180_000 });
const withTmp = async (fn) => { const dir = tmp(); try { await fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); } };

test('parseArgs: html mode, defaults and exact file naming', () => {
  const o = parseArgs(['--html', 'a/sign-in.html', '--out', 'o', '--viewports', '390x844,1440x900']);
  assert.equal(o.mode, 'html');
  assert.equal(o.name, 'sign-in');
  assert.equal(o.theme, 'light');
  assert.equal(o.fullPage, false);
  assert.deepEqual(o.viewports, [{ width: 390, height: 844 }, { width: 1440, height: 900 }]);
  assert.equal(path.isAbsolute(o.html) && path.isAbsolute(o.out), true);
  assert.equal(captureBase(o.name, o.viewports[0], 'dark'), 'sign-in--390x844--dark');
  const f = parseArgs(['--component', 'c.tsx', '--export', 'HandoffBlockBase', '--props', 'p.json', '--css', 'g.css', '--out', 'o',
    '--viewports', '390x844', '--full-page', '--theme', 'dark', '--json', '--name', 'handoff']);
  assert.equal(f.mode, 'component');
  assert.equal(f.name, 'handoff');
  assert.equal(f.fullPage && f.json, true);
  assert.equal(f.css.length, 1);
  assert.equal(parseArgs(['--component', 'c.tsx', '--export', 'XBase', '--props', 'p.json', '--out', 'o', '--viewports', '390x844']).name, 'XBase');
});

test('parseArgs refuses what it cannot capture', () => {
  const bad = [
    [],
    ['--html', 'a.html', '--viewports', '390x844'],
    ['--html', 'a.html', '--out', 'o'],
    ['--html', 'a.html', '--out', 'o', '--viewports', '390'],
    ['--html', 'a.html', '--out', 'o', '--viewports', '390x844,390x844'],
    ['--html', 'a.html', '--out', 'o', '--viewports', ','],
    ['--html', 'a.html', '--out', 'o', '--viewports', '390x844', '--theme', 'sepia'],
    ['--html', 'a.html', '--out', 'o', '--viewports', '390x844', '--bogus'],
    ['--html', 'a.html', '--out', 'o', '--viewports', '390x844', '--name', 'a b'],
    ['--html', 'a.html', '--out', 'o', '--viewports', '390x844', '--css', 'g.css'],
    ['--html', 'a.html', '--component', 'c.tsx', '--export', 'X', '--props', 'p.json', '--out', 'o', '--viewports', '390x844'],
    ['--component', 'c.tsx', '--export', 'X', '--out', 'o', '--viewports', '390x844'],
    ['--component', 'c.tsx', '--export', 'X-Base', '--props', 'p.json', '--out', 'o', '--viewports', '390x844'],
    ['--html', '--out', 'o', '--viewports', '390x844'],
  ];
  for (const argv of bad) assert.throws(() => parseArgs(argv), UsageError, argv.join(' '));
  assert.throws(() => parseViewports('1440X900'), UsageError);
});

test('font stacks: a named family that neither loaded nor is installed is missing, even behind a fallback', () => {
  const local = (f) => f === 'Segoe UI';
  const r = resolveFontStacks([
    '"Drawn Sans", sans-serif',
    'NoSuch, "Segoe UI", sans-serif',
    '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'ui-sans-serif, system-ui, "Apple Color Emoji"',
    'Ghost',
  ], { loaded: ['Drawn Sans'], local });
  assert.deepEqual(r.used.map((u) => [u.family, u.source]), [
    ['Drawn Sans', 'webfont'], ['Segoe UI', 'local'], ['Segoe UI', 'local'], ['ui-sans-serif', 'generic'], [null, 'browser-default'],
  ]);
  assert.deepEqual(r.missing.sort(), ['Ghost', 'NoSuch']);
  assert.deepEqual(splitFontStack(`'A B', "C", d`), ['A B', 'C', 'd']);
});

test('judgeCapture fails closed on each defect', () => {
  const green = { fonts: { missing: [] }, layout: { horizontalOverflow: false }, pageErrors: [], failedRequests: [], rendered: null, consoleErrors: ['noise'] };
  assert.deepEqual(judgeCapture(green), []);
  assert.deepEqual(judgeCapture({ ...green, fonts: { missing: ['X'] } }), ['font-missing']);
  assert.deepEqual(judgeCapture({ ...green, layout: { horizontalOverflow: true } }), ['horizontal-overflow']);
  assert.deepEqual(judgeCapture({ ...green, pageErrors: ['TypeError'] }), ['page-error']);
  assert.deepEqual(judgeCapture({ ...green, failedRequests: ['x.png'] }), ['request-failed']);
  assert.deepEqual(judgeCapture({ ...green, rendered: false }), ['empty-render']);
});

test('fixture props: "[Function]" marks a no-op action; class candidates come from the bundle text', () => {
  assert.deepEqual(fixtureProps({ on: { send: '[Function]' }, list: ['[Function]', 1], label: 'Send' }),
    { on: { send: '__DRAW_NOOP__' }, list: ['__DRAW_NOOP__', 1], label: 'Send' });
  const c = classCandidates('className:"flex gap-2 w-[calc(100%-1rem)]",x=`md:grid`');
  for (const t of ['flex', 'gap-2', 'w-[calc(100%-1rem)]', 'md:grid']) assert.ok(c.includes(t), t);
});

test('CLI: usage errors and a missing Playwright exit 2, never 0', async () => {
  await withTmp(async (dir) => {
    assert.equal(cli(['--out', dir], dir).status, 2);
    const html = path.join(dir, 'x.html');
    fs.writeFileSync(html, '<p>x</p>');
    assert.equal(cli(['--html', path.join(dir, 'absent.html'), '--out', dir, '--viewports', '390x844'], dir).status, 2);
    const r = cli(['--html', html, '--out', path.join(dir, 'out'), '--viewports', '390x844', '--json'], dir);
    assert.equal(r.status, 2, r.stderr);
    assert.match(JSON.parse(r.stdout).error, /no playwright/);
  });
});

const GOOD = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{margin:0}body{font-family:ui-sans-serif,sans-serif}input,button{font:inherit}main{padding:16px}</style></head>
<body><main><h1>Sign in</h1><p>The drawing is the code.</p></main></body></html>`;
const BAD = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{margin:0;font-family:"StarciNoSuchFont",sans-serif}</style></head>
<body><div style="width:1600px">wide</div><script>console.error('drawn with an error')</script></body></html>`;

test('HTML capture: one png and one record per viewport, green', { skip: NO_BROWSER }, async () => {
  await withTmp(async (dir) => {
    const html = path.join(dir, 'sign-in.html');
    fs.writeFileSync(html, GOOD);
    const out = path.join(dir, 'out');
    const r = cli(['--html', html, '--out', out, '--viewports', '390x844,1440x900', '--theme', 'dark', '--json'], PW_DIR);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const { ok, records } = JSON.parse(r.stdout);
    assert.equal(ok, true);
    assert.deepEqual(fs.readdirSync(out).sort(), [
      'sign-in--1440x900--dark.json', 'sign-in--1440x900--dark.png', 'sign-in--390x844--dark.json', 'sign-in--390x844--dark.png']);
    for (const rec of records) {
      const png = fs.readFileSync(rec.image.path);
      assert.equal(rec.image.sha256, (await import('node:crypto')).createHash('sha256').update(png).digest('hex'));
      assert.equal(png.readUInt32BE(16), rec.viewport.width * 2, 'deviceScaleFactor 2');
      assert.equal(rec.layout.pageWidth, rec.viewport.width);
      assert.equal(rec.layout.horizontalOverflow, false);
      assert.deepEqual(rec.fonts.missing, []);
      assert.ok(Array.isArray(rec.fonts.loaded) && Array.isArray(rec.consoleErrors));
      assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out, `sign-in--${rec.viewport.width}x${rec.viewport.height}--dark.json`), 'utf8')), rec);
    }
  });
});

test('HTML capture: a missing font or horizontal overflow exits 1 and says so in the record', { skip: NO_BROWSER }, async () => {
  await withTmp(async (dir) => {
    const html = path.join(dir, 'bad.html');
    fs.writeFileSync(html, BAD);
    const out = path.join(dir, 'out');
    const r = cli(['--html', html, '--out', out, '--viewports', '390x844', '--full-page'], PW_DIR);
    assert.equal(r.status, 1, r.stderr + r.stdout);
    const rec = JSON.parse(fs.readFileSync(path.join(out, 'bad--390x844--light.json'), 'utf8'));
    assert.equal(rec.ok, false);
    assert.deepEqual(rec.failures, ['font-missing', 'horizontal-overflow']);
    assert.deepEqual(rec.fonts.missing, ['StarciNoSuchFont']);
    assert.equal(rec.layout.scrollWidth, 1600);
    assert.deepEqual(rec.consoleErrors, ['drawn with an error']);
    assert.ok(fs.existsSync(rec.image.path));
  });
});

const HANDOFF_FIXTURE = {
  state: 'prepared',
  props: {
    order: { items: { code: 'SO-2026-091', customer: 'Northstar Retail', amount: 480000000, lines: [{ sku: 'A', qty: 2 }] } },
    handoff: { items: { status: 'prepared', fingerprint: 'fp-ho-91', revision: 2, receiptId: 'RC-1', reason: 'Missing VAT' } },
    labels: {
      title: 'Handoff', prepared: 'Prepared', sent: 'Sent', returned: 'Returned', send: 'Send', resend: 'Resend', fingerprint: 'Fingerprint',
      revision: 'Revision', receipt: 'Receipt', reason: 'Reason', customer: 'Customer', amount: 'Amount', lines: 'lines',
      orderSlot: { empty: 'empty', forbidden: 'forbidden', error: 'error', retry: 'retry' },
      handoffSlot: { empty: 'empty', forbidden: 'forbidden', error: 'error', retry: 'retry' },
    },
  },
  on: { requestSend: '[Function]', retryOrder: '[Function]', retryHandoff: '[Function]' },
};
const NO_FIXTURE = NO_BROWSER || (SHAPE_SLOT ? false : 'examples/shape-slot has no installed node_modules (set STARCI_SHAPE_SLOT_DIR)');

test('fixture capture: the real pure HandoffBlockBase renders with fixture props and the product CSS', { skip: NO_FIXTURE }, async () => {
  await withTmp(async (dir) => {
    const props = path.join(dir, 'handoff.prepared.json');
    fs.writeFileSync(props, JSON.stringify(HANDOFF_FIXTURE));
    const component = path.join(SHAPE_SLOT, 'apps', 'shape-slot', 'src', 'components', 'blocks', 'HandoffBlock', 'component.tsx');
    const out = path.join(dir, 'out');
    const r = cli(['--component', component, '--export', 'HandoffBlockBase', '--props', props, '--css', path.join(SHAPE_SLOT, 'apps', 'shape-slot', 'src', 'app', 'globals.css'),
      '--out', out, '--viewports', '390x844', '--json'], PW_DIR);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const [rec] = JSON.parse(r.stdout).records;
    assert.equal(rec.rendered, true);
    assert.equal(rec.source.mode, 'component');
    assert.equal(rec.source.export, 'HandoffBlockBase');
    assert.match(rec.source.component.sha256, /^[0-9a-f]{64}$/);
    assert.deepEqual(rec.pageErrors, []);
    assert.ok(fs.existsSync(path.join(out, 'HandoffBlockBase--390x844--light.png')));

    const missing = cli(['--component', component, '--export', 'NoSuchBase', '--props', props, '--out', out, '--viewports', '390x844'], PW_DIR);
    assert.equal(missing.status, 2, missing.stderr);
    assert.match(missing.stderr, /NoSuchBase/);

    fs.writeFileSync(props, JSON.stringify({ ...HANDOFF_FIXTURE, on: undefined }));
    const thrown = cli(['--component', component, '--export', 'HandoffBlockBase', '--props', props, '--out', out, '--viewports', '390x844', '--name', 'thrown'], PW_DIR);
    assert.equal(thrown.status, 1, thrown.stderr + thrown.stdout);
    const red = JSON.parse(fs.readFileSync(path.join(out, 'thrown--390x844--light.json'), 'utf8'));
    assert.deepEqual(red.failures, ['page-error', 'empty-render']);
  });
});

test('the settle delay is runtimes.yaml allocation.drawRender.settleMs, one number in one place', () => {
  assert.equal(SETTLE_MS, allocationSettings().drawRender.settleMs);
  assert.doesNotMatch(fs.readFileSync(path.join(import.meta.dirname, '..', 'scripts', 'work', 'draw-render.mjs'), 'utf8'), /SETTLE_MS = \d/);
});
