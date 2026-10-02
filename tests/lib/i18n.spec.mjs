import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { catalogFindings } from '../../scripts/checks/check-i18n-catalog.mjs';
import { fill, loadCatalog, placeholdersOf, resetCatalogCache, translate, translator } from '../../scripts/lib/i18n.mjs';

// Vietnamese in this file is written as \u escapes so the spec stays ASCII.
const OPEN = 'M\u1edf';
const NEEDS = 'Quy\u1ebft \u0111\u1ecbnh {id} c\u1ea7n b\u1ea1n';

const root = (t, files) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-i18n-'));
  t.after(() => { resetCatalogCache(); fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }); });
  for (const [rel, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); }
  return dir;
};
const catalog = (messages) => `schema: starci/i18n-catalog@1\nmessages:\n${messages.map(([en, vi]) => `  - {en: "${en}", vi: "${vi}"}`).join('\n')}\n`;

test('vi translates through the catalog, any other language and a missing entry return the English source', (t) => {
  const dir = root(t, { 'modules/i18n/messages/a.yaml': catalog([['Open', OPEN], ['Workflow {id} needs you', NEEDS]]) });
  assert.equal(translate('Open', {}, { language: 'vi', root: dir }), OPEN);
  assert.equal(translate('Open', {}, { language: 'en', root: dir }), 'Open');
  assert.equal(translate('Never listed', {}, { language: 'vi', root: dir }), 'Never listed');
  assert.equal(translator('vi', { root: dir })('Workflow {id} needs you', { id: 'wf-1' }), NEEDS.replace('{id}', 'wf-1'));
  assert.equal(translator('en', { root: dir })('Workflow {id} needs you', { id: 'wf-1' }), 'Workflow wf-1 needs you');
  assert.equal(loadCatalog(dir).size, 2);
});

test('fill replaces known placeholders only, and placeholdersOf lists them', () => {
  assert.equal(fill('a {x} b {y}', { x: 1 }), 'a 1 b {y}');
  assert.deepEqual(placeholdersOf('{b} and {a} and {b}'), ['a', 'b', 'b']);
});

test('a well formed catalog is clean; a bad schema, entry, placeholder or duplicate source is refused', (t) => {
  assert.deepEqual(catalogFindings(root(t, { 'modules/i18n/messages/a.yaml': catalog([['Open', OPEN]]) })), []);
  const codes = (files) => catalogFindings(root(t, files)).map((f) => f.code);
  assert.deepEqual(codes({ 'modules/i18n/messages/a.yaml': 'schema: other\nmessages:\n  - {en: "x", vi: "y"}\n' }), ['RT_I18N_SCHEMA']);
  assert.deepEqual(codes({ 'modules/i18n/messages/a.yaml': 'schema: starci/i18n-catalog@1\nmessages: []\n' }), ['RT_I18N_EMPTY']);
  assert.deepEqual(codes({ 'modules/i18n/messages/a.yaml': catalog([['Hello {name}', OPEN]]) }), ['RT_I18N_PLACEHOLDERS']);
  assert.deepEqual(codes({ 'modules/i18n/messages/a.yaml': catalog([[OPEN, OPEN]]) }), ['RT_I18N_EN_NOT_ENGLISH']);
  assert.deepEqual(codes({ 'modules/i18n/messages/a.yaml': catalog([['Open', OPEN]]), 'modules/i18n/messages/b.yaml': catalog([['Open', OPEN]]) }), ['RT_I18N_DUPLICATE']);
});

test('the runtime catalog is well formed', () => {
  assert.deepEqual(catalogFindings(), []);
});
