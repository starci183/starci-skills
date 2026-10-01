import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkDrawGeometry } from '../scripts/checks/shell-conformance.mjs';
import { TREE_SCHEMA } from '../scripts/work/layout-tree.mjs';
import { appDeclarationText } from './fixtures/layout-tree.mjs';

// shell-conformance runs grammar-geometry.mjs --check on every html direction a ui record declares, at the
// breakpoint the asset names (or every breakpoint of the tree), against the app's fe side's own CSS.
function product(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-drawgeo-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const work = path.join(root, '.starciwork');
  const uiDir = path.join(work, 'features', 'sales', 'ui', 'handoff');
  fs.mkdirSync(path.join(uiDir, 'assets'), { recursive: true });
  fs.mkdirSync(path.join(root, 'fe'), { recursive: true });
  fs.writeFileSync(path.join(root, 'hfs.json'), appDeclarationText(['web']));
  fs.writeFileSync(path.join(uiDir, 'assets', 'draw.html'), '<!doctype html><button>Send</button>');
  const tree = { schema: TREE_SCHEMA, app: { name: 'web' }, breakpoints: [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }] };
  return { root, work, uiFile: path.join(uiDir, 'index.yaml'), shell: { record: tree, file: path.join(work, 'shell', 'index.yaml'), dir: path.join(work, 'shell') } };
}

test('an html direction is measured at the breakpoint it names; each off-grammar element is refused', (t) => {
  const p = product(t);
  const calls = [];
  const run = (exe, args) => {
    calls.push(args);
    return { status: 1, stdout: JSON.stringify({ ok: false, findings: [{ element: 'button', at: 'button "Send"', property: 'border-radius', got: '8px', expected: 'a pill: 24px' }] }) };
  };
  const record = { assets: [{ path: 'assets/draw.html', composite: { breakpoint: 'mobile' } }] };
  const out = checkDrawGeometry(p.work, p.uiFile, record, p.shell, { run });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].slice(1, 7), ['--check', path.join(path.dirname(p.uiFile), 'assets/draw.html'), '--repo', path.join(p.root, 'fe'), '--viewport', '390x844']);
  assert.deepEqual(out.map((f) => [f.level, f.code]), [['refuse', 'GEOMETRY_OFF_GRAMMAR']]);
  assert.match(out[0].message, /assets\/draw\.html at 390px: button button "Send" border-radius is 8px, the product grammar renders a pill: 24px/);
});

test('an html naming no breakpoint is measured at every breakpoint; a check that cannot run fails closed', (t) => {
  const p = product(t);
  const views = [];
  const run = (exe, args) => { views.push(args[6]); return args[6] === '1440x900' ? { status: 0, stdout: JSON.stringify({ ok: true, findings: [] }) } : { status: 2, stdout: JSON.stringify({ ok: false, error: 'Playwright is not installed' }) }; };
  const out = checkDrawGeometry(p.work, p.uiFile, { assets: [{ path: 'assets/draw.html' }] }, p.shell, { run });
  assert.deepEqual(views, ['1440x900', '390x844']);
  assert.deepEqual(out.map((f) => [f.level, f.code]), [['refuse', 'GEOMETRY_CHECK_FAILED']]);
  assert.match(out[0].message, /Playwright is not installed/);
});

test('no html direction, or an app without a readable declaration, never refuses', (t) => {
  const p = product(t);
  assert.deepEqual(checkDrawGeometry(p.work, p.uiFile, { assets: [{ path: 'assets/a.png' }] }, p.shell), []);
  fs.rmSync(path.join(p.root, 'hfs.json'));
  const out = checkDrawGeometry(p.work, p.uiFile, { assets: [{ path: 'assets/draw.html' }] }, { ...p.shell, record: { ...p.shell.record, app: {} } }, { run: () => assert.fail('no repository, no run') });
  assert.deepEqual(out.map((f) => [f.level, f.code]), [['info', 'GEOMETRY_UNCHECKED']]);
});
