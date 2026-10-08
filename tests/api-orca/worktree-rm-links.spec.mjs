// The Orca removal call refuses before it asks Orca: a tree that still holds a link (Orca deletes through a junction, measured by
// orca-worktree-rm-live.spec.mjs) or a selector that names no directory. The measurement entry runs only over a throwaway fixture
// whose every link leads into the temp root. No Orca is reachable here: a refusal that reached it would carry another error code.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { worktreeRm, measureWorktreeRm, LINKS_PRESENT } from '../../scripts/api/orca/worktree-rm.mjs';

const LINK = process.platform === 'win32' ? 'junction' : 'dir';
const ROOT = path.resolve(import.meta.dirname, '..', '..');

function fixture(t) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-rm-links-')));
  const saved = process.env.STARCI_ORCA_COMMAND;
  process.env.STARCI_ORCA_COMMAND = path.join(base, 'no-such-orca');
  t.after(() => {
    if (saved === undefined) delete process.env.STARCI_ORCA_COMMAND;
    else process.env.STARCI_ORCA_COMMAND = saved;
    fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
  });
  const main = path.join(base, 'main', 'node_modules', 'dep');
  fs.mkdirSync(main, { recursive: true });
  fs.writeFileSync(path.join(main, 'index.js'), 'module.exports = 1;\n');
  const tree = path.join(base, 'tree');
  fs.mkdirSync(path.join(tree, 'packages'), { recursive: true });
  return { base, tree, target: path.join(base, 'main', 'node_modules'), file: path.join(main, 'index.js') };
}

test('a tree that holds a link is refused with worktree-links-present, Orca is never asked, the link target keeps its files', (t) => {
  const { base, tree, target, file } = fixture(t);
  fs.symlinkSync(target, path.join(tree, 'packages', 'node_modules'), LINK);
  for (const worktree of [`id:repo-x::${tree}`, `path:${tree}`, `repo-x::${tree}`]) {
    const r = worktreeRm({ worktree, force: true });
    assert.deepEqual([r.ok, r.removed, r.errorCode, r.hostUnavailable], [false, false, LINKS_PRESENT, false], worktree);
    assert.match(r.error, /still holds 1 link/);
  }
  assert.ok(fs.existsSync(file), 'the target is intact');
  assert.ok(fs.existsSync(path.join(base, 'tree')));
});

test('a selector that names no directory is refused the same way', (t) => {
  fixture(t);
  for (const worktree of ['id:repo-x', 'branch:main', '', undefined]) assert.equal(worktreeRm({ worktree, force: true }).errorCode, LINKS_PRESENT, String(worktree));
});

test('a tree without links is handed to Orca (here unreachable, so the refusal is not ours)', (t) => {
  const { tree } = fixture(t);
  const r = worktreeRm({ worktree: `id:repo-x::${tree}`, force: true });
  assert.equal(r.ok, false);
  assert.notEqual(r.errorCode, LINKS_PRESENT);
});

test('the measurement refuses a tree without a link and a link that leads outside the temp root', (t) => {
  const { tree } = fixture(t);
  const none = measureWorktreeRm({ worktree: `id:repo-x::${tree}`, force: true });
  assert.deepEqual([none.ok, none.errorCode], [false, 'worktree-measure-refused']);
  assert.match(none.error, /nothing to measure/);
  fs.symlinkSync(ROOT, path.join(tree, 'outside'), LINK);
  const out = measureWorktreeRm({ worktree: `path:${tree}`, force: true });
  assert.deepEqual([out.ok, out.errorCode], [false, 'worktree-measure-refused']);
  assert.match(out.error, /leads outside the temp root/);
  assert.ok(fs.existsSync(path.join(ROOT, 'package.json')));
});

test('the measurement hands a throwaway link tree to Orca (unreachable here)', (t) => {
  const { tree, target } = fixture(t);
  fs.symlinkSync(target, path.join(tree, 'node_modules'), LINK);
  const r = measureWorktreeRm({ worktree: `path:${tree}`, force: true });
  assert.equal(r.ok, false);
  assert.notEqual(r.errorCode, 'worktree-measure-refused');
});
