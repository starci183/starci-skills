// RT_ROOT_ADHOC: a runtime file that spells process.cwd() or the Work directory literal more often than when the check landed is refused; the root module, scanners, comments and specs are not.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rootAdhocFindings, checkRootAdhoc, CODE } from '../../scripts/checks/check-root-adhoc.mjs';

const files = {
  'scripts/kernel/a.mjs': "const dir = path.join(process.cwd(), 'x');",
  'scripts/kernel/b.mjs': "const work = path.join(repo, '.starciwork', 'brand');",
  'scripts/kernel/c.mjs': "// process.cwd() in a comment\n/* '.starciwork' */\n * process.cwd()\nconst ok = invocationDir();",
  'scripts/checks/scan.mjs': "const SKIP = new Set(['.starciwork']);",
  'scripts/lib/roots.mjs': "export const WORK_DIR_NAME = '.starciwork'; const d = process.cwd();",
  'tests/kernel/x.spec.mjs': "process.cwd() '.starciwork'",
};

test('RT_ROOT_ADHOC: a new file that spells process.cwd() or the Work directory name is refused (violating); comments, scanners, the root module and specs are not', () => {
  const found = rootAdhocFindings(files, {});
  assert.deepEqual(found.map((f) => f.path).sort(), ['scripts/kernel/a.mjs', 'scripts/kernel/b.mjs']);
  assert.ok(found.every((f) => f.code === CODE));
});

test('RT_ROOT_ADHOC: a file keeps what it held when the check landed, may not spell more, and a converted file passes (passing)', () => {
  assert.deepEqual(rootAdhocFindings(files, { 'scripts/kernel/a.mjs': 'process.cwd()', 'scripts/kernel/b.mjs': "'.starciwork'" }), []);
  const grown = rootAdhocFindings({ 'scripts/kernel/a.mjs': 'process.cwd(); process.cwd();' }, { 'scripts/kernel/a.mjs': 'process.cwd()' });
  assert.equal(grown.length, 1);
  assert.match(grown[0].message, /2 now, 1 when the check landed/);
  assert.deepEqual(rootAdhocFindings({ 'scripts/kernel/a.mjs': 'invocationDir()' }, { 'scripts/kernel/a.mjs': 'process.cwd()' }), []);
  assert.equal(rootAdhocFindings({ 'scripts/kernel/a.mjs': "process.cwd(); '.starciwork'" }, { 'scripts/kernel/a.mjs': 'process.cwd()' }).length, 1, 'a new kind in a file that held another is refused');
});

test('RT_ROOT_ADHOC: the runtime tree spells no root input beyond what the tree held when the check landed (passing)', () => {
  assert.deepEqual(checkRootAdhoc(), []);
});
