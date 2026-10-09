// render-tools.mjs: where a capture's tools come from. The project's install comes first, the runtime's own install is always the last candidate, a Playwright whose
// browser download is absent yields to one whose browser exists, and a host with neither is one typed fact (RENDER_TOOL_UNAVAILABLE) with what provisions it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { esbuildInstall, playwrightInstall, renderToolFix, renderToolStatus } from '../../scripts/work/render-tools.mjs';
import { toolSearchDirs } from '../../scripts/lib/roots.mjs';

const temp = (t) => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-render-tools-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};

/** A directory whose node_modules holds a fake package `name`; `browser` is where its chromium.executablePath() points (null: no chromium export). */
function install(root, name, { browser = null, version = '1.0.0' } = {}) {
  const dir = path.join(root, 'node_modules', ...name.split('/'));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name, version, main: 'index.js' }));
  fs.writeFileSync(path.join(dir, 'index.js'), browser === null ? 'module.exports = {};' : `module.exports = { chromium: { executablePath: () => ${JSON.stringify(browser)} } };`);
  return root;
}

test('the project\'s install comes first and the runtime\'s is the last candidate', (t) => {
  const base = temp(t);
  const exe = path.join(base, 'chrome.exe');
  fs.writeFileSync(exe, '');
  const project = install(path.join(base, 'project'), 'playwright', { browser: exe, version: '2.0.0' });
  const runtime = install(path.join(base, 'runtime'), 'playwright', { browser: exe, version: '1.0.0' });
  const bare = path.join(base, 'bare');
  fs.mkdirSync(bare);
  assert.equal(playwrightInstall([project], { runtime }).version, '2.0.0');
  assert.equal(playwrightInstall([bare], { runtime }).version, '1.0.0', 'a project with no install is served by the runtime');
  assert.deepEqual(toolSearchDirs([null, bare], runtime), [bare, runtime]);
  assert.equal(playwrightInstall([bare], { runtime: null }), null);
});

test('a project Playwright with no browser yields to the runtime\'s whose browser exists; with none anywhere the first install is returned and the status names the browser', (t) => {
  const base = temp(t);
  const exe = path.join(base, 'chrome.exe');
  fs.writeFileSync(exe, '');
  const project = install(path.join(base, 'project'), 'playwright', { browser: path.join(base, 'absent.exe'), version: '2.0.0' });
  const runtime = install(path.join(base, 'runtime'), 'playwright', { browser: exe, version: '1.0.0' });
  assert.equal(playwrightInstall([project], { runtime }).version, '1.0.0');
  const noBrowser = install(path.join(base, 'runtime-2'), 'playwright', { browser: path.join(base, 'absent.exe'), version: '1.0.0' });
  assert.equal(playwrightInstall([project], { runtime: noBrowser }).version, '2.0.0');
  install(project, 'esbuild');
  const status = renderToolStatus([project], { runtime: noBrowser });
  assert.equal(status.ok, false);
  assert.deepEqual(status.missing.map((item) => item.tool), ['chromium']);
  assert.match(renderToolFix(status.missing), /npx playwright install chromium/);
});

test('esbuild resolves from the project, else the runtime; the status of a host with nothing names playwright and esbuild', (t) => {
  const base = temp(t);
  const project = install(path.join(base, 'project'), 'esbuild', { version: '0.1.0' });
  const runtime = install(path.join(base, 'runtime'), 'esbuild', { version: '0.2.0' });
  const bare = path.join(base, 'bare');
  fs.mkdirSync(bare);
  assert.equal(esbuildInstall([project], { runtime }).version, '0.1.0');
  assert.equal(esbuildInstall([bare], { runtime }).version, '0.2.0');
  const empty = renderToolStatus([bare], { runtime: null });
  assert.deepEqual(empty.missing.map((item) => item.tool), ['playwright', 'esbuild']);
  assert.match(renderToolFix(empty.missing), /npm install/);
});

test('this runtime holds what a capture needs: its own Playwright and esbuild resolve for a directory that has none', (t) => {
  const bare = temp(t);
  const status = renderToolStatus([bare]);
  assert.equal(status.playwright?.root.includes('node_modules'), true, 'the runtime pins playwright');
  assert.equal(status.esbuild?.root.includes('node_modules'), true, 'the runtime pins esbuild');
  assert.deepEqual(status.missing.filter((item) => item.tool !== 'chromium'), [], 'only a browser download can be absent on a host that installed the runtime');
});
