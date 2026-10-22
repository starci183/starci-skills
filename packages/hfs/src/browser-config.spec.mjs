// An app with a browser journey (`browser: true`) gets the managed browser/tsconfig.json of app.browser-config, the program that
// type-checks the journeys Playwright only transpiles; an app without one gets no such file. The file is the slot's own template.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderTargets } from '../sync/index.mjs';
import { createSlotResolver, loadSlotManifest, resolveRepoDeclaration } from '../runtime/scripts/hfs/slots.mjs';

const templateText = fs.readFileSync(new URL('../templates/app/browser-config/browser/tsconfig.json', import.meta.url), 'utf8');

const appOf = (extra = {}) => ({
  hfs: 3, kind: 'app', project: 'browser-config-proof', ...extra, sides: {
    be: { apps: [{ name: 'api', kind: 'api' }], connections: [{ name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'api', isolation: 'database' }] },
    fe: { apps: [{ name: 'web', kind: 'next' }], reads: ['be/contracts/'] },
  },
});

const browserTarget = (hfs) => renderTargets(hfs, {}, { source: { files: [], read: () => '' } }).find((target) => target.path === 'browser/tsconfig.json');

test('an app that declares its browser journey renders browser/tsconfig.json from the browser-config template', () => {
  const target = browserTarget(appOf({ browser: true }));
  assert.ok(target, 'the managed browser tsconfig is rendered');
  assert.equal(target.content, templateText);
});

test('an app without a browser journey renders no browser tsconfig', () => {
  assert.equal(browserTarget(appOf()), undefined);
});

test('the browser tsconfig is owned by app.browser-config, enabled with app.browser by browser: true', () => {
  const manifest = loadSlotManifest();
  const withBrowser = resolveRepoDeclaration(manifest, appOf({ browser: true }));
  assert.deepEqual(withBrowser.optionalSlots, ['app.browser', 'app.browser-config']);
  const resolver = createSlotResolver(manifest, withBrowser);
  assert.equal(resolver.classifyPath('browser/tsconfig.json').slot, 'app.browser-config');
  assert.equal(resolver.classifyPath('browser/tsconfig.json').status, 'owned');
  assert.equal(resolver.classifyPath('browser/journeys/shop.ts').slot, 'app.browser');
});

test('without browser: true a browser tsconfig is in an opt-in slot the app did not enable', () => {
  const manifest = loadSlotManifest();
  const plain = resolveRepoDeclaration(manifest, appOf());
  assert.deepEqual(plain.optionalSlots, []);
  assert.equal(createSlotResolver(manifest, plain).classifyPath('browser/tsconfig.json').status, 'not-enabled');
});
