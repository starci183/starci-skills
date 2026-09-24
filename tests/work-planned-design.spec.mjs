import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stringifyYaml } from '../engine/yaml.mjs';
import { checkWorkTree, plannedDesignPointers } from '../scripts/checks/check-example-work.mjs';

// mia inc-fc946155a081: brand.decide plans each visible layout of a product with no frontend and names, with
// `layout-tree.mjs plan --design`, the surface-layout ui record interface.draw draws first. The validator
// refused that pointer as a dangling ref because the record does not exist until interface.draw runs, so the
// Kernel had the pointer moved into blockers[] prose. One contract now: brand.decide names the record
// (ui.<feature>.<layout>-layout), interface.draw creates exactly that id, and until then the pointer on a
// planned, unsettled layout is a DESIGN_PLANNED suspect.
const DESIGN = 'ui.learning.app-layout';
const tree = ({ origin = 'planned', state = 'todo' } = {}) => ({
  schema: 'work/layout-tree@1', id: 'shell', kind: 'shell', state: 'todo', rev: 1, origin: 'planned',
  app: { root: '.', appDir: 'src/app', framework: 'next-app-router' },
  productLocale: { default: 'vi', fallback: 'vi', locales: ['vi', 'en'] },
  breakpoints: [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }],
  themes: ['light'],
  nodes: [
    { id: '/', parent: null, segment: '/', segmentKind: 'root', url: '/', origin: 'planned' },
    { id: '/(app)', parent: '/', segment: '(app)', segmentKind: 'group', url: '/', origin, files: { layout: { path: 'src/app/(app)/layout.tsx' } },
      layout: { chrome: 'visible', state, rev: 1, design: DESIGN } },
  ],
});
const layoutUi = `schema: work/ui-screen@1\nid: ${DESIGN}\ntitle: The student app layout\nstate: todo\nroute: /(app)\nsurface: layout\n`;

const run = (t, shell, extra = {}) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-planned-design-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const work = path.join(base, '.starciwork');
  const put = (rel, body) => { const file = path.join(work, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body); };
  put('index.yaml', 'schema: work/catalog@1\nid: fixture\nfeatures: []\n');
  put('shell/index.yaml', stringifyYaml(shell));
  for (const [rel, body] of Object.entries(extra)) put(rel, body);
  const refused = []; const suspect = [];
  checkWorkTree(work, refused, suspect);
  const about = (list) => list.filter((line) => line.includes(DESIGN));
  return { refused: about(refused), suspect: about(suspect) };
};

test('a planned, unsettled layout may point at the surface-layout record interface.draw has not drawn yet', (t) => {
  const { refused, suspect } = run(t, tree());
  assert.deepEqual(refused, []);
  assert.equal(suspect.length, 1);
  assert.match(suspect[0], /nodes\.layout\.design names ui\.learning\.app-layout/);
  assert.match(suspect[0], /features\/learning\/ui\/app-layout\/index\.yaml with surface: layout/);
  assert.match(suspect[0], /\[DESIGN_PLANNED\]$/);
});

test('once interface.draw creates the record under that id the pointer resolves with no finding', (t) => {
  const { refused, suspect } = run(t, tree(), { 'features/learning/ui/app-layout/index.yaml': layoutUi });
  assert.deepEqual([...refused, ...suspect].filter((l) => /DESIGN_PLANNED|no record owns/.test(l)), []);
});

test('a settled layout or a scanned node still refuses a design pointer nothing owns', (t) => {
  assert.equal(run(t, tree({ state: 'done' })).refused.filter((l) => l.includes('which no record owns')).length, 1);
  assert.equal(run(t, tree({ origin: 'repository' })).refused.filter((l) => l.includes('which no record owns')).length, 1);
});

test('plannedDesignPointers reads only planned, unsettled layout nodes of a layout tree', () => {
  assert.deepEqual(plannedDesignPointers(tree()), [DESIGN]);
  assert.deepEqual(plannedDesignPointers(tree({ state: 'done' })), []);
  assert.deepEqual(plannedDesignPointers({ ...tree(), schema: 'work/app-shell@1' }), []);
});
