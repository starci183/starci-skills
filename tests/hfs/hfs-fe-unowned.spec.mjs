import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkRepository } from '../../scripts/hfs/check.mjs';
import { APP, cleanup, gitAdd, installTypeScript, writeCleanRepo } from '../helpers/hfs-cli-fixture.mjs';

// Every front-end file is owned by a slot and named by it: a file no slot owns is HFS_SLOT_UNDECLARED (`starci app check`), a file its
// slot does not name is FE_SLOT_FILE_ROLE (the machine), a retired name is HFS_FORBIDDEN_PRESENT. All are errors. The app is checked
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

test('a clean app (its fe side) has no unowned, unnamed or retired file', () => {
  const result = checkRepository({ repoRoot: repoOf() });
  assert.deepEqual(result.findings, []);
});

test('a file directly in src/ is a HFS_SLOT_UNDECLARED error, and a test file anywhere is FE_NO_TESTS and not an undeclared slot', () => {
  const result = checkRepository({ repoRoot: repoOf((dir) => { put(dir, 'fe/e2e/course/play.spec.ts'); put(dir, 'fe/apps/web/src/x.json'); }) });
  assert.equal(result.ok, false);
  assert.deepEqual(errorsOf(result, 'HFS_SLOT_UNDECLARED').sort(), ['fe/apps/web/src/x.json']);
  assert.deepEqual(errorsOf(result, 'FE_NO_TESTS').sort(), ['fe/e2e/course/play.spec.ts']);
});

test('fe/apps/web/src/modules/hooks/x.ts is owned by fe.modules (a capability may carry any name) and is judged as a module, not as a hook', () => {
  const result = checkRepository({ repoRoot: repoOf((dir) => put(dir, 'fe/apps/web/src/modules/hooks/x.ts')) });
  assert.deepEqual(errorsOf(result, 'HFS_SLOT_UNDECLARED'), []);
  assert.deepEqual(errorsOf(result, 'FE_SLOT_FILE_ROLE'), []);
});

test('a [lang] segment and a page.tsx outside the route slot are FE_SLOT_FILE_ROLE errors', () => {
  const result = checkRepository({ repoRoot: repoOf((dir) => { put(dir, 'fe/apps/web/src/app/[lang]/page.tsx'); put(dir, 'fe/apps/web/src/hooks/orders/page.tsx'); }) });
  assert.deepEqual(errorsOf(result, 'FE_SLOT_FILE_ROLE').sort(), ['fe/apps/web/src/app/[lang]/page.tsx', 'fe/apps/web/src/hooks/orders/page.tsx']);
});

test('middleware.ts is refused on Next >= 16 (a forbidden slot), naming proxy.ts as the place', () => {
  const result = checkRepository({ repoRoot: repoOf((dir) => put(dir, 'fe/apps/web/src/middleware.ts')) });
  assert.deepEqual(errorsOf(result, 'HFS_FORBIDDEN_PRESENT'), ['fe/apps/web/src/middleware.ts']);
});
