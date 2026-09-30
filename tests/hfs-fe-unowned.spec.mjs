import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkRepository } from '../scripts/lib/hfs-check.mjs';
import { FE, cleanup, gitAdd, installTypeScript, writeCleanRepo } from './_hfs-cli-fixture.mjs';

// Every front-end file is owned by a slot and named by it: a file no slot owns is HFS_SLOT_UNDECLARED (`hfs check`), a file its
// slot does not name is FE_SLOT_FILE_ROLE (the machine), a retired name is HFS_FORBIDDEN_PRESENT. All are errors.
const made = [];
const repoOf = (mutate) => {
  const dir = writeCleanRepo(FE);
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

test('a clean front-end tree has no unowned, unnamed or retired file', () => {
  const result = checkRepository({ repoRoot: repoOf() });
  assert.deepEqual(result.findings, []);
});

test('a file directly in src/ is a HFS_SLOT_UNDECLARED error, and a test file anywhere is FE_NO_TESTS and not an undeclared slot', () => {
  const result = checkRepository({ repoRoot: repoOf((dir) => { put(dir, 'e2e/course/play.spec.ts'); put(dir, 'apps/web/src/x.json'); }) });
  assert.equal(result.ok, false);
  assert.deepEqual(errorsOf(result, 'HFS_SLOT_UNDECLARED').sort(), ['apps/web/src/x.json']);
  assert.deepEqual(errorsOf(result, 'FE_NO_TESTS').sort(), ['e2e/course/play.spec.ts']);
});

test('apps/web/src/modules/hooks/x.ts is owned by fe.modules (a capability may carry any name) and is judged as a module, not as a hook', () => {
  const result = checkRepository({ repoRoot: repoOf((dir) => put(dir, 'apps/web/src/modules/hooks/x.ts')) });
  assert.deepEqual(errorsOf(result, 'HFS_SLOT_UNDECLARED'), []);
  assert.deepEqual(errorsOf(result, 'FE_SLOT_FILE_ROLE'), []);
});

test('a [lang] segment and a page.tsx outside the route slot are FE_SLOT_FILE_ROLE errors', () => {
  const result = checkRepository({ repoRoot: repoOf((dir) => { put(dir, 'apps/web/src/app/[lang]/page.tsx'); put(dir, 'apps/web/src/hooks/orders/page.tsx'); }) });
  assert.deepEqual(errorsOf(result, 'FE_SLOT_FILE_ROLE').sort(), ['apps/web/src/app/[lang]/page.tsx', 'apps/web/src/hooks/orders/page.tsx']);
});

test('middleware.ts is refused on Next >= 16 (a forbidden slot), naming proxy.ts as the place', () => {
  const result = checkRepository({ repoRoot: repoOf((dir) => put(dir, 'apps/web/src/middleware.ts')) });
  assert.deepEqual(errorsOf(result, 'HFS_FORBIDDEN_PRESENT'), ['apps/web/src/middleware.ts']);
});
