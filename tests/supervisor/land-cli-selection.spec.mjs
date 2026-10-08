import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { changedVerbs, cliVerbLimit, specsExercisingChangedVerbs } from '../../scripts/supervisor/land-cli-specs.mjs';
import { specsDirect } from '../../scripts/supervisor/land-specs.mjs';

// 2026-10-07: a change to a shared verb helper passed the land gate and broke 13 specs that each spawned the CLI and ran a verb the change
// reached; they import nothing the change touched, so neither the name rule nor the import rule of `direct` selected them.
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const write = (root, rel, text) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), text);
};

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-land-cli-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, 'scripts/kernel/cli.mjs', "import './verbs/report.mjs';\nimport './verbs/status.mjs';\n");
  write(root, 'scripts/kernel/verbs/report.mjs', "import './shared/evidence.mjs';\n");
  write(root, 'scripts/kernel/verbs/status.mjs', "import './shared/rows.mjs';\n");
  write(root, 'scripts/kernel/verbs/shared/evidence.mjs', 'export const e = 1;\n');
  write(root, 'scripts/kernel/verbs/shared/rows.mjs', 'export const r = 1;\n');
  write(root, 'scripts/other/boot.mjs', "import './deep.mjs';\n");
  write(root, 'scripts/other/deep.mjs', 'export const d = 1;\n');
  const spawn = (verb) => `import { spawnSync } from 'node:child_process';\nspawnSync(process.execPath, ['scripts/kernel/cli.mjs', '${verb}', '--json']);\n`;
  write(root, 'tests/kernel/reports.spec.mjs', spawn('report'));
  write(root, 'tests/kernel/statuses.spec.mjs', spawn('status'));
  write(root, 'tests/kernel/unrelated.spec.mjs', "import test from 'node:test';\n");
  write(root, 'tests/kernel/via-bin.spec.mjs', "spawnSync(process.execPath, [path.join(ROOT, 'packages', 'cli', 'bin', 'starci.mjs'), 'kernel', 'report']);\n");
  const verbs = [
    { group: 'kernel', verb: 'report', dispatcher: 'scripts/kernel/cli.mjs' },
    { group: 'kernel', verb: 'status', dispatcher: 'scripts/kernel/cli.mjs' },
    { group: 'other', verb: 'boot', dispatcher: 'scripts/other/boot.mjs' },
  ];
  const specs = ['reports', 'statuses', 'unrelated', 'via-bin'].map((name) => {
    const file = `tests/kernel/${name}.spec.mjs`;
    return { file, code: fs.readFileSync(path.join(root, file), 'utf8') };
  });
  return { root, verbs, specs };
}

test('a spec that spawns the CLI and runs a verb whose handler reaches the changed helper is selected; one running another verb is not', (t) => {
  const { root, verbs, specs } = fixture(t);
  const changed = ['scripts/kernel/verbs/shared/evidence.mjs'];
  assert.deepEqual(changedVerbs({ root, changed, verbs }).map((v) => [v.verb, v.distance]), [['report', 1]]);
  assert.deepEqual(specsExercisingChangedVerbs({ root, changed, specs, verbs }).sort(), ['tests/kernel/reports.spec.mjs', 'tests/kernel/via-bin.spec.mjs']);
});

test('a verb whose own module changed, or whose dispatcher changed, is exercised; a script verb is reached through its imports', (t) => {
  const { root, verbs, specs } = fixture(t);
  assert.deepEqual(specsExercisingChangedVerbs({ root, changed: ['scripts/kernel/verbs/status.mjs'], specs, verbs }), ['tests/kernel/statuses.spec.mjs']);
  assert.deepEqual(specsExercisingChangedVerbs({ root, changed: ['scripts/kernel/cli.mjs'], specs, verbs }).sort(),
    ['tests/kernel/reports.spec.mjs', 'tests/kernel/statuses.spec.mjs', 'tests/kernel/via-bin.spec.mjs']);
  assert.deepEqual(changedVerbs({ root, changed: ['scripts/other/deep.mjs'], verbs }).map((v) => [v.verb, v.distance]), [['boot', 1]]);
});

test('past the verbs that import a changed file themselves, deeper verbs are followed only up to the declared limit', (t) => {
  const { root } = fixture(t);
  write(root, 'scripts/deep/a.mjs', "import './b.mjs';\n");
  write(root, 'scripts/deep/b.mjs', "import './c.mjs';\n");
  write(root, 'scripts/deep/c.mjs', 'export const c = 1;\n');
  write(root, 'scripts/near/n.mjs', "import '../deep/c.mjs';\n");
  const verbs = [{ group: 'g', verb: 'far', dispatcher: 'scripts/deep/a.mjs' }, { group: 'g', verb: 'near', dispatcher: 'scripts/near/n.mjs' }];
  const changed = ['scripts/deep/c.mjs'];
  assert.deepEqual(changedVerbs({ root, changed, verbs, limit: 1 }).map((v) => [v.verb, v.distance]), [['near', 1]], 'the verb importing the file is always kept');
  assert.deepEqual(changedVerbs({ root, changed, verbs, limit: 2 }).map((v) => [v.verb, v.distance]), [['near', 1], ['far', 2]]);
  assert.ok(cliVerbLimit() >= 1);
});

test('on the real tree the direct selection of a shared verb helper adds the specs that spawn the CLI and run a verb it reaches', () => {
  const pool = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules') walk(full);
      else if (entry.name.endsWith('.spec.mjs')) pool.push({ file: path.relative(ROOT, full).split(path.sep).join('/'), text: fs.readFileSync(full, 'utf8') });
    }
  };
  walk(path.join(ROOT, 'tests'));
  const changed = ['scripts/kernel/verbs/shared/check-evidence.mjs'];
  const before = specsDirect(changed, { specs: pool }).files;
  const after = specsDirect(changed, { specs: pool, root: ROOT }).files;
  const added = after.filter((file) => !before.includes(file));
  assert.ok(before.every((file) => after.includes(file)), 'the rule only adds');
  assert.ok(added.length > 0, 'a spec that runs a verb behind the helper is selected');
  assert.ok(added.length <= cliVerbLimit() * 12, `${added.length} specs added`);
});
