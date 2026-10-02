// The browser journey of a product (slot app.browser at the app root, declared by `browser: true` in hfs.json): present and clean when
// declared, refused when its files exist without the declaration, rendered as the managed script test:browser only when declared, and never
// a way around FE_NO_TESTS (a test or test tooling inside fe/ stays refused).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkRepo } from '../../scripts/hfs/check.mjs';
import { appScripts, validateHfs } from '../../packages/hfs/sync/index.mjs';
import { loadSlotManifest, resolveRepoDeclaration } from '../../scripts/hfs/slots.mjs';
import { APP, cleanup, gitAdd, installTypeScript, writeCleanRepo } from '../helpers/hfs-cli-fixture.mjs';

const made = [];
test.after(() => cleanup(made));
const WITH_BROWSER = { ...APP, browser: true };
const put = (dir, relative, text) => {
  const target = path.join(dir, ...relative.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
};
const repoOf = (declaration, mutate) => {
  const dir = installTypeScript(writeCleanRepo(declaration));
  made.push(dir);
  if (mutate) mutate(dir);
  return gitAdd(dir);
};
const JOURNEY = (dir) => {
  put(dir, 'browser/playwright.config.ts', 'export default {};\n');
  put(dir, 'browser/journeys/shop.ts', 'export {};\n');
  put(dir, 'browser/stack.mjs', 'export {};\n');
};
const codesAt = (result, prefix) => result.findings.filter((f) => String(f.path).startsWith(prefix)).map((f) => f.code);

test('a declared browser journey is owned by app.browser and clean: config, journeys and the stack script', () => {
  const result = checkRepo({ repoRoot: repoOf(WITH_BROWSER, JOURNEY) });
  assert.deepEqual(codesAt(result, 'browser/'), []);
  assert.ok(!result.findings.some((f) => f.code === 'HFS_SLOT_REQUIRED_MISSING' && String(f.path).startsWith('browser')));
});

test('a declared journey missing its config or its journeys is refused', () => {
  const result = checkRepo({ repoRoot: repoOf(WITH_BROWSER, (dir) => put(dir, 'browser/stack.mjs', 'export {};\n')) });
  const missing = result.findings.filter((f) => f.code === 'HFS_SLOT_REQUIRED_MISSING').map((f) => f.path);
  assert.ok(missing.includes('browser/playwright.config.ts'), JSON.stringify(missing));
  assert.ok(missing.some((p) => p.startsWith('browser/journeys')), JSON.stringify(missing));
});

test('browser files without the declaration are refused: the slot is opt-in', () => {
  const result = checkRepo({ repoRoot: repoOf(APP, JOURNEY) });
  assert.ok(result.findings.some((f) => f.code === 'HFS_SLOT_NOT_ENABLED' && String(f.path).startsWith('browser/')), JSON.stringify(result.findings.map((f) => [f.code, f.path])));
});

test('the browser declaration is `true` or absent, never false or another value', () => {
  const manifest = loadSlotManifest();
  assert.doesNotThrow(() => resolveRepoDeclaration(manifest, WITH_BROWSER));
  assert.throws(() => resolveRepoDeclaration(manifest, { ...APP, browser: false }), /browser/);
  assert.throws(() => resolveRepoDeclaration(manifest, { ...APP, browser: 'yes' }), /browser/);
});

test('test:browser is a managed script only when the journey is declared', () => {
  assert.match(appScripts(validateHfs(WITH_BROWSER)), /"test:browser": "playwright test -c browser\/playwright\.config\.ts",/);
  assert.doesNotMatch(appScripts(validateHfs(APP)), /test:browser/);
});

test('a journey never moves into the front end: a test or test tooling inside fe/ is still refused', () => {
  const result = checkRepo({
    repoRoot: repoOf(WITH_BROWSER, (dir) => {
      JOURNEY(dir);
      put(dir, 'fe/apps/web/e2e/shop.e2e-spec.ts', 'export {};\n');
      put(dir, 'fe/apps/web/playwright.config.ts', 'export default {};\n');
    }),
  });
  const refused = result.findings.filter((f) => f.code === 'FE_NO_TESTS').map((f) => f.path).sort();
  assert.deepEqual(refused, ['fe/apps/web/e2e/shop.e2e-spec.ts', 'fe/apps/web/playwright.config.ts']);
});
