import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkRepository } from '../../scripts/hfs/check.mjs';
import { byCodeUnit } from '../../scripts/lib/list.mjs';
import { APP, cleanup, gitAdd, installTypeScript, writeCleanRepo } from '../helpers/hfs-cli-fixture.mjs';

// Every front-end file is owned by a slot and named by it: a file no slot owns is HFS_SLOT_UNDECLARED (`starci app check`), a file its
// slot does not name is FE_SLOT_FILE_ROLE (the machine), a name a slot forbids is HFS_FORBIDDEN_PRESENT. All are errors. The app is checked
// at its root, so every path is app-relative (fe/...).
const made = [];
const repoOf = (mutate) => {
  const dir = writeCleanRepo(APP);
  made.push(dir);
  mutate?.(dir);
  return installTypeScript(gitAdd(dir));
};
test.after(() => cleanup(made));
const put = (dir, relative, text = 'export {};\n') => {
  const target = path.join(dir, ...relative.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
};
const errorsOf = (result, code) => result.findings.filter((f) => f.code === code && f.level === 'error').map((f) => f.path);
const ownershipCodes = new Set([
  'HFS_SLOT_UNDECLARED', 'HFS_SLOT_NOT_ENABLED', 'HFS_SLOT_REQUIRED_MISSING', 'HFS_FORBIDDEN_PRESENT',
  'FE_SLOT_FILE_ROLE', 'FE_OWNER_REACHABLE', 'HFS_UNUSED_FILE', 'HFS_UNUSED_EXPORT', 'HFS_UNUSED_SYMBOL',
]);

test('a declaration-only ambient owner has valid ownership and needs no unused runtime entry', () => {
  const result = checkRepository({ repoRoot: repoOf((dir) => put(dir, 'fe/apps/web/src/modules/types/ambient/styles.d.ts', 'declare module "*.css" {}\n')) });
  assert.deepEqual(result.findings.filter((finding) => ownershipCodes.has(finding.code) || finding.code.startsWith('ARCH_')), []);
});

test('a file directly in src/ is a HFS_SLOT_UNDECLARED error, and a test file anywhere is FE_NO_TESTS and not an undeclared slot', () => {
  const result = checkRepository({ repoRoot: repoOf((dir) => { put(dir, 'fe/e2e/course/play.spec.ts'); put(dir, 'fe/apps/web/src/x.json'); }) });
  assert.equal(result.ok, false);
  assert.deepEqual(errorsOf(result, 'HFS_SLOT_UNDECLARED').sort(byCodeUnit), ['fe/apps/web/src/x.json']);
  assert.deepEqual(errorsOf(result, 'FE_NO_TESTS').sort(byCodeUnit), ['fe/e2e/course/play.spec.ts']);
});

test('fe/apps/web/src/modules/hooks/x.ts is owned by fe.modules (a capability may carry any name) and is judged as a module, not as a hook', () => {
  const result = checkRepository({ repoRoot: repoOf((dir) => put(dir, 'fe/apps/web/src/modules/hooks/x.ts')) });
  assert.deepEqual(errorsOf(result, 'HFS_SLOT_UNDECLARED'), []);
  assert.deepEqual(errorsOf(result, 'FE_SLOT_FILE_ROLE'), []);
});

test('wrong route and hook roles and runtime code in the ambient owner are FE_SLOT_FILE_ROLE errors', () => {
  const result = checkRepository({ repoRoot: repoOf((dir) => { put(dir, 'fe/apps/web/src/app/[lang]/page.tsx'); put(dir, 'fe/apps/web/src/hooks/orders/page.tsx'); put(dir, 'fe/apps/web/src/modules/types/ambient/runtime.ts'); }) });
  assert.deepEqual(errorsOf(result, 'FE_SLOT_FILE_ROLE').sort(byCodeUnit), ['fe/apps/web/src/app/[lang]/page.tsx', 'fe/apps/web/src/hooks/orders/page.tsx', 'fe/apps/web/src/modules/types/ambient/runtime.ts']);
});

test('middleware.ts is refused on Next >= 16 (a forbidden slot), naming proxy.ts as the place', () => {
  const result = checkRepository({ repoRoot: repoOf((dir) => put(dir, 'fe/apps/web/src/middleware.ts')) });
  assert.deepEqual(errorsOf(result, 'HFS_FORBIDDEN_PRESENT'), ['fe/apps/web/src/middleware.ts']);
});
