// proves: RT_PROSE_PATH_NO_SLOT@lite
// proves: RT_PROSE_PATH_NO_SLOT@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prosePathFindings } from '../../scripts/hfs/runtime-rules/prose-path.mjs';

function context(edition, text) {
  const app = edition === 'lite' ? 'lite-app' : 'ecommerce-app';
  const example = `examples/${app}/hfs.json`;
  const sources = { [example]: fs.readFileSync(example, 'utf8'), 'docs/evidence.md': text };
  return { root: process.cwd(), files: Object.keys(sources), params: {}, read: (file) => sources[file] ?? null };
}

for (const edition of ['lite', 'full']) {
  test(`${edition} accepts valid app placeholders and declared app paths`, () => {
    assert.deepEqual(prosePathFindings(context(edition,
      'See `be/apps/<app>/src/main.ts` and `fe/apps/<app>/src/app/page.tsx`.\n')), []);
    const app = edition === 'lite' ? 'api' : 'identity';
    assert.deepEqual(prosePathFindings(context(edition, `See be/apps/${app}/src/main.ts.\n`)), []);
  });

  test(`${edition} rejects invalid paths even with an app placeholder`, () => {
    assert.deepEqual(prosePathFindings(context(edition,
      'See `be/apps/<app>/invented/x.ts`.\n')).map((finding) => finding.code), ['RT_PROSE_PATH_NO_SLOT']);
    assert.deepEqual(prosePathFindings(context(edition,
      'See `be/apps/undeclared/src/main.ts`.\n')).map((finding) => finding.code), ['RT_PROSE_PATH_NO_SLOT']);
  });

  test(`${edition} accepts placeholders with renamed declared apps`, () => {
    const ctx = context(edition, 'See `be/apps/<name>/src/main.ts` and `fe/apps/*/src/app/page.tsx`.\n');
    const read = ctx.read;
    ctx.read = (file) => {
      if (!file.endsWith('/hfs.json')) return read(file);
      const declaration = JSON.parse(read(file));
      for (const side of ['be', 'fe']) {
        const names = new Map(declaration.sides[side].apps.map((app, index) => [app.name, `${side}-sample-${index}`]));
        declaration.sides[side].apps.forEach((app) => { app.name = names.get(app.name); });
        for (const connection of declaration.sides[side].connections ?? []) connection.owner = names.get(connection.owner);
      }
      return JSON.stringify(declaration);
    };
    assert.deepEqual(prosePathFindings(ctx), []);
  });
}

test('shipped example READMEs pass with the shipped declarations', () => {
  const files = ['lite-app', 'ecommerce-app', 'shape-slot'].flatMap((app) => [
    `examples/${app}/hfs.json`, `examples/${app}/README.md`,
  ]);
  assert.deepEqual(prosePathFindings({ root: process.cwd(), files, params: {}, read: (file) => fs.readFileSync(file, 'utf8') }), []);
});
