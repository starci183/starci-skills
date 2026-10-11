import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { findPackage, requirePackage } from '../../scripts/lib/package-at.mjs';
import { layoutTreeMain, readShellRecord, nodeById, treeOf } from '../../scripts/work/layout-tree.mjs';
import { layoutRenderMain, requestOf, routeOf } from '../../scripts/work/layout-render.mjs';
import { decodePng } from '../../scripts/work/ui/render.mjs';
import { APP_FILES, buildProduct } from '../fixtures/layout-tree.mjs';
import { chromiumGap } from '../helpers/chromium-gap.mjs';

// `starci work layout-render` serves the product app itself and captures a layout. The app here is a stand-in `next`: a node
// script that takes `dev --port <n>` like the real bin and answers the way the product's i18n proxy makes the real one answer: a
// request whose Host is not `localhost:<port>` is rewritten to localhost, an "external" rewrite that loops 307 for ever. Its
// mode file picks the other behaviours (a permanent redirect loop, a logged render error).
const FAKE_NEXT = `
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const appRoot = process.cwd();
const port = Number(process.argv[process.argv.indexOf('--port') + 1]);
const mode = fs.readFileSync(path.join(appRoot, 'fake-next-mode'), 'utf8').trim();
fs.writeFileSync(path.join(appRoot, 'fake-next-run.json'), JSON.stringify({ argv: process.argv.slice(2), pid: process.pid, siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? null }));
if (mode === 'error' || process.env.NEXT_PUBLIC_SITE_URL !== 'http://localhost:' + port) console.log('⨯ Error: NEXT_PUBLIC_SITE_URL is not set');
const PAGE = '<!doctype html><html><body style="margin:0"><header style="height:40px;background:#ddd">brand</header><main style="padding:8px"><p>page body</p></main></body></html>';
http.createServer((request, response) => {
  if (mode === 'loop' || request.headers.host !== 'localhost:' + port) { response.writeHead(307, { location: '/' }); response.end(); return; }
  response.writeHead(200, { 'content-type': 'text/html' });
  response.end(PAGE);
}).listen(port);
`;

const PW = findPackage([skillRoot], ['playwright']);
const NO_BROWSER = PW ? chromiumGap(requirePackage(PW).chromium) : 'the runtime has no Playwright';

const product = (t, { mode = 'ok', installed = true } = {}) => {
  const p = buildProduct(t, { files: APP_FILES, apps: ['app'] });
  const scan = layoutTreeMain(['scan', '--work', p.work, '--write']);
  assert.equal(scan.exitCode, 0, scan.text);
  const appRoot = path.join(p.fe, 'apps', 'app');
  p.put('app/fe/apps/app/fake-next-mode', mode);
  if (installed) {
    p.put('app/fe/apps/app/node_modules/next/package.json', JSON.stringify({ name: 'next', version: '16.1.6' }));
    p.put('app/fe/apps/app/node_modules/next/dist/bin/next', FAKE_NEXT);
  }
  return { ...p, appRoot, run: () => JSON.parse(fs.readFileSync(path.join(appRoot, 'fake-next-run.json'), 'utf8')) };
};

const render = (p, extra = []) => layoutRenderMain(['--work', p.work, '--node', '/[locale]', '--breakpoint', 'desktop', '--theme', 'light', '--out', path.join(p.base, 'out'), '--json', ...extra]);
const listening = (port) => new Promise((resolve) => {
  const socket = net.connect(port, '127.0.0.1');
  socket.once('connect', () => { socket.destroy(); resolve(true); });
  socket.once('error', () => resolve(false));
});

test('the route of a layout node fills the locale with the product default and refuses another dynamic segment', () => {
  const tree = { productLocale: { default: 'vi' } };
  assert.equal(routeOf({ node: { id: '/[locale]', url: '/[locale]' }, tree }), '/vi');
  assert.equal(routeOf({ node: { id: '/[locale]', url: '/[locale]' }, tree, locale: 'en' }), '/en');
  assert.equal(routeOf({ node: { id: 'x', url: '/[locale]/photos/[id]' }, tree, route: 'custom' }), '/custom');
  assert.throws(() => routeOf({ node: { id: 'x', url: '/[locale]/photos/[id]' }, tree }), /dynamic segment/);
});

test('a request names the work root, the node, the breakpoint and the theme', () => {
  assert.throws(() => requestOf(['--work', 'w']), /--node, --breakpoint, --theme/);
  assert.equal(requestOf(['--work', 'w', '--node', 'n', '--breakpoint', 'b', '--theme', 't']).slot, 'main');
});

test('a bad request exits 2 and prints the usage', async () => {
  const result = await layoutRenderMain(['--work', 'w']);
  assert.equal(result.exitCode, 2);
  assert.match(result.text, /Usage: starci work layout-render/);
});

test('an app whose install is missing is refused with the typed cause the environment route reads', async (t) => {
  const p = product(t, { installed: false });
  const result = await render(p);
  assert.equal(result.exitCode, 1);
  const refusal = JSON.parse(result.text);
  assert.deepEqual([refusal.ok, refusal.code, refusal.cause, refusal.blocker], [false, 'SHELL_RENDER_UNAVAILABLE', 'app-not-installed', 'environment']);
});

test('the runtime serves the app on localhost with no host pin, keys the slot, records the capture and stops the server', { skip: NO_BROWSER }, async (t) => {
  const p = product(t);
  const result = await render(p, ['--write']);
  assert.equal(result.exitCode, 0, result.text);
  const done = JSON.parse(result.text);
  const served = p.run();
  assert.equal(served.argv.includes('--hostname'), false, `the dev server is started with no --hostname: ${served.argv.join(' ')}`);
  assert.deepEqual(served.argv.slice(0, 1), ['dev']);
  assert.match(done.url, /^http:\/\/localhost:\d+\/vi$/);
  assert.equal(served.siteUrl, new URL(done.url).origin, 'the scaffold public origin is the render origin');
  const image = decodePng(fs.readFileSync(done.file));
  assert.deepEqual([image.width, image.height], [1440, 900]);
  const recorded = nodeById(treeOf(readShellRecord(p.work).record, 'app'), '/[locale]').layout.captures[0];
  assert.deepEqual([recorded.breakpoint, recorded.theme, recorded.kind, recorded.url], ['desktop', 'light', 'render', done.url]);
  assert.ok(recorded.slot.width > 0 && recorded.slot.height > 0, 'the keyed slot rectangle was measured');
  assert.equal(await listening(Number(new URL(done.url).port)), false, 'the server the verb started is stopped');
  assert.throws(() => process.kill(served.pid, 0), 'its process is gone');
});

test('a layout that redirects for ever is refused with the failing URL and the chain it followed', { skip: NO_BROWSER }, async (t) => {
  const p = product(t, { mode: 'loop' });
  const refusal = JSON.parse((await render(p)).text);
  assert.deepEqual([refusal.code, refusal.cause], ['SHELL_RENDER_UNAVAILABLE', 'redirect-loop']);
  assert.match(refusal.url, /^http:\/\/localhost:\d+\/vi$/);
  assert.ok(refusal.redirects.length > 1 && refusal.redirects.every((hop) => hop.status === 307), JSON.stringify(refusal.redirects));
});

test('an app that logs an error while rendering is not a render of the layout', { skip: NO_BROWSER }, async (t) => {
  const p = product(t, { mode: 'error' });
  const refusal = JSON.parse((await render(p)).text);
  assert.equal(refusal.cause, 'app-error');
  assert.match(refusal.errors[0], /NEXT_PUBLIC_SITE_URL is not set/);
});

test('a slot selector that matches nothing is refused naming the selector', { skip: NO_BROWSER }, async (t) => {
  const p = product(t);
  const refusal = JSON.parse((await render(p, ['--slot', 'main.absent'])).text);
  assert.deepEqual([refusal.cause, refusal.slot, refusal.matched], ['slot-not-found', 'main.absent', 0]);
});
