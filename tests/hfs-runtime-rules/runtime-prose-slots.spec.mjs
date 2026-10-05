// runtime-prose-slots.spec.mjs - RT_PROSE_PATH_NO_SLOT (scripts/hfs/runtime-rules/prose-path.mjs) and RT_PROSE_RESTATES_SLOTS
// (scripts/hfs/runtime-rules/prose-restates.mjs): prose names only paths a slot owns, and never restates the slots.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathTokens, prosePathFindings } from '../../scripts/hfs/runtime-rules/prose-path.mjs';
import { proseRestateFindings, slotFileNames } from '../../scripts/hfs/runtime-rules/prose-restates.mjs';
import { loadSlotManifest } from '../../scripts/hfs/slots.mjs';

const EXAMPLE = 'examples/ecommerce-app/hfs.json';
const exampleText = fs.readFileSync(EXAMPLE, 'utf8');
/** A ctx whose prose is `texts` and whose example declaration is the real one. */
const ctxOf = (texts) => ({ root: process.cwd(), files: [EXAMPLE, ...Object.keys(texts)], params: { generated: [{ root: 'packages/x/runtime' }] }, read: (file) => (file === EXAMPLE ? exampleText : texts[file] ?? null) });
const lines = (found) => found.map((f) => [f.code, f.path, f.line]);

test('RT_PROSE_PATH_NO_SLOT: a path a slot owns, a folder above a slot, a placeholder app and a declared example app are clean', () => {
  const text = [
    'Features live in `be/src/features/api/<feature>/index.ts`.',
    'The back end is `be/src/` and `be/apps/<app>/src/main.ts`; a front-end route is `fe/apps/<app>/src/app/page.tsx`.',
    'The example has `be/apps/identity/src/main.ts` and `fe/apps/landing/next.config.ts`.',
    'A glob `be/src/**/*.service.ts` and a topic `be/folder.yaml` are not paths.',
  ].join('\n');
  assert.deepEqual(prosePathFindings(ctxOf({ 'knowledge/x.md': text })), []);
});

test('RT_PROSE_PATH_NO_SLOT: a path no slot owns, a role-named app and a place a slot lost are refused, with their line', () => {
  const found = prosePathFindings(ctxOf({ 'docs/a.md': 'ok\nThe api is `be/apps/api/src/main.ts`.\nSee `fe/apps/web/package.json` and `be/src/helpers/x.ts`.\n' }));
  assert.deepEqual(lines(found), [['RT_PROSE_PATH_NO_SLOT', 'docs/a.md', 2], ['RT_PROSE_PATH_NO_SLOT', 'docs/a.md', 3], ['RT_PROSE_PATH_NO_SLOT', 'docs/a.md', 3]]);
  assert.match(found[0].message, /be\/apps\/api\/src\/main\.ts is owned by no slot/);
});

test('RT_PROSE_PATH_NO_SLOT: generated copies and the slot sources are not read; a repo without example apps is not judged', () => {
  const bad = 'See `be/apps/api/src/main.ts`.\n';
  assert.deepEqual(prosePathFindings(ctxOf({ 'packages/x/runtime/docs/a.md': bad, 'knowledge/hfs/slots.yaml': bad, 'knowledge/grammars/a.yaml': bad })), []);
  assert.deepEqual(prosePathFindings({ root: process.cwd(), files: ['docs/a.md'], params: {}, read: () => bad }), []);
  assert.deepEqual(pathTokens('see be/apps/<app>/{src/main.ts,Dockerfile}.')[0].paths, ['be/apps/identity/src/main.ts', 'be/apps/identity/Dockerfile']);
});

test('RT_PROSE_RESTATES_SLOTS: a line with three slot paths, a fenced tree and a sentence of root file names are refused', () => {
  const tree = ['# t', '```text', 'be/apps/<app>/src/main.ts', 'be/src/features/api/<feature>/index.ts', 'be/src/modules/platform/<capability>/index.ts', '```', ''].join('\n');
  const list = 'The files are `be/apps/<app>/src/main.ts`, `be/src/features/api/<feature>/index.ts` and `be/src/modules/platform/<capability>/index.ts`.\n';
  const names = 'The root holds `package.json`, `hfs.json` and `package-lock.json`.\n';
  const found = proseRestateFindings(ctxOf({ 'docs/tree.md': tree, 'docs/list.md': list, 'docs/names.md': names }));
  assert.deepEqual(lines(found), [['RT_PROSE_RESTATES_SLOTS', 'docs/tree.md', 2], ['RT_PROSE_RESTATES_SLOTS', 'docs/list.md', 1], ['RT_PROSE_RESTATES_SLOTS', 'docs/names.md', 1]]);
});

test('RT_PROSE_RESTATES_SLOTS: slot ids, two paths, a generated block, the catalogs and the example READMEs are clean', () => {
  const clean = [
    'Slots `app.format-config` and `app.hooks` hold them; see `be/src/features/api/<feature>/` and `be/apps/<app>/src/main.ts`.',
    'The root holds `package.json` and `hfs.json`.',
    '<!-- hfs:generated app-map -->',
    '| `package.json` | `hfs.json` | `package-lock.json` | `be/apps/<app>/src/main.ts` `be/src/features/api/<feature>/index.ts` `be/src/modules/platform/<c>/index.ts` |',
    '<!-- hfs:generated-end app-map -->',
  ].join('\n');
  const restating = 'The root holds `package.json`, `hfs.json` and `package-lock.json`.\n';
  assert.deepEqual(proseRestateFindings(ctxOf({ 'docs/clean.md': clean, 'knowledge/hfs/rules.yaml': restating, 'examples/ecommerce-app/README.md': restating, 'packages/hfs/templates/app/skeleton/README.md': restating })), []);
  assert.ok(slotFileNames(loadSlotManifest()).has('package.json'));
});
