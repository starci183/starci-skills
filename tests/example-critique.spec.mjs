import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {computeCritique, runCritique} from '../scripts/example-critique.mjs';

/**
 * One fixture tree per section this lane was asked to compute, plus its freshness gate. Fixtures live on
 * the same drive as the repo for the same reason tests/example-derive.spec.mjs's own fixtures do: a
 * different-drive os.tmpdir() breaks the relative-path handling scripts/checks/check-example-work.mjs relies on.
 *
 * Each fixture's own `.starciwork` sits directly under a throwaway repo directory (`root`), mirroring the
 * real example's shape (`examples/todo-app-backend/.starciwork`) closely enough for path resolution (a
 * fixture record's `owners`/`module` path is resolved against `root` unless a test needs a second
 * repository, in which case it declares one in workspace.yaml exactly like the real tree does).
 */
const TMP_ROOT = path.join(path.parse(process.cwd()).root, 'starci-tmp');

let counter = 0;
function freshRoot() {
  counter += 1;
  const dir = path.join(TMP_ROOT, `critique-fixture-${process.pid}-${counter}`);
  fs.rmSync(dir, {recursive: true, force: true});
  fs.mkdirSync(dir, {recursive: true});
  return dir;
}

function write(root, rel, content) {
  const file = path.join(root, ...rel.split('/'));
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, content, 'utf8');
  return file;
}

/** A minimal `.starciwork` tree with a declared backend repository named after `root`'s own basename, so
 * work/implementation and work/business-rule anchor-path checks resolve against real files under `root`. */
function tree(root, extra) {
  const workRoot = path.join(root, '.starciwork');
  const repoName = path.basename(root);
  write(workRoot, 'workspace.yaml', `schema: work/workspace\nid: fixture\nrepositories:\n  - {role: be, name: ${repoName}}\n`);
  for (const [rel, content] of Object.entries(extra)) write(workRoot, rel, content);
  return workRoot;
}

function findingsOf(critique, kind) { return critique.findings.filter(f => f.kind === kind); }

test('section 1: blast radius counts the transitive usedBy set over the blast-kind edges, not blockedBy', () => {
  const root = freshRoot();
  const workRoot = tree(root, {
    'features/f/br/a/index.yaml': 'schema: work/business-rule\nid: br.f.a\ntitle: A\nstate: todo\nmodule: src/a\n',
    'features/f/fr/b/index.yaml': 'schema: work/functional-requirement\nid: fr.f.b\ntitle: B\nstate: todo\ncomposes:\n  - {rule: br.f.a, module: src/a}\n',
    'features/f/sds/c/index.yaml': 'schema: work/sds-component\nid: sds.f.c\ntitle: C\nstate: todo\nrefs: [fr.f.b]\n',
    // A blockedBy edge at d must NOT extend the blast radius - it is an impediment, not a usedBy dependency.
    'features/f/gap/g/index.yaml': 'schema: work/gap\nid: gap.f.g\ntitle: G\nstate: todo\nstatement: s\n',
    'features/f/br/d/index.yaml': 'schema: work/business-rule\nid: br.f.d\ntitle: D\nstate: todo\nblockedBy:\n  - {record: br.f.a, because: "unrelated impediment"}\n',
  });
  const critique = computeCritique(workRoot);
  const finding = findingsOf(critique, 'blast-radius').find(f => f.id === 'blast-radius:br.f.a');
  assert.ok(finding, JSON.stringify(critique.findings.map(f => f.id)));
  assert.deepEqual(finding.records.slice(1).sort(), ['fr.f.b', 'sds.f.c']);
  assert.ok(!finding.records.includes('br.f.d'), 'a blockedBy-only reference must not enter the blast radius');
});

test('section 1: blast radius follows the proves edge (implementation -> rule), which usedBy does not classify', () => {
  const root = freshRoot();
  const workRoot = tree(root, {
    'features/f/br/a/index.yaml': 'schema: work/business-rule\nid: br.f.a\ntitle: A\nstate: done\nverificationSource: authored-claim\nbecause: c\n',
    'features/f/impl/x/index.yaml': 'schema: work/implementation\nid: impl.f.x\ntitle: X\nstate: done\nverificationSource: authored-claim\nbecause: c\nproves: [br.f.a]\n',
  });
  const critique = computeCritique(workRoot);
  const finding = findingsOf(critique, 'blast-radius').find(f => f.id === 'blast-radius:br.f.a');
  assert.deepEqual(finding.records, ['br.f.a', 'impl.f.x']);
});

test('section 2: fan-in hotspot is the top decile of usedBy totals, with a cross-feature dependent count', () => {
  const root = freshRoot();
  const extra = {
    'features/hub/data/shared/index.yaml': 'schema: work/data\nid: data.hub.shared\ntitle: Shared\nstate: done\n',
  };
  // Nine referrers spread over two other features, so data.hub.shared is easily the highest fan-in record.
  for (let i = 0; i < 9; i += 1) {
    const feature = i < 5 ? 'a' : 'b';
    extra[`features/${feature}/fr/r${i}/index.yaml`] = `schema: work/functional-requirement\nid: fr.${feature}.r${i}\ntitle: R\nstate: todo\nrefs: [data.hub.shared]\n`;
  }
  const workRoot = tree(root, extra);
  const critique = computeCritique(workRoot);
  const finding = findingsOf(critique, 'fan-in-hotspot').find(f => f.records[0] === 'data.hub.shared');
  assert.ok(finding, JSON.stringify(critique.findings.map(f => f.id)));
  assert.match(finding.because, /used 9 time/);
  assert.match(finding.because, /2 other feature/);
});

test('section 3: a two-record blockedBy cycle is reported as one ordered ring, not two separate findings', () => {
  const root = freshRoot();
  const workRoot = tree(root, {
    'features/f/br/a/index.yaml': 'schema: work/business-rule\nid: br.f.a\ntitle: A\nstate: todo\nblockedBy:\n  - {record: br.f.b, because: "waiting on b"}\n',
    'features/f/br/b/index.yaml': 'schema: work/business-rule\nid: br.f.b\ntitle: B\nstate: todo\nblockedBy:\n  - {record: br.f.a, because: "waiting on a"}\n',
  });
  const critique = computeCritique(workRoot);
  const cycles = findingsOf(critique, 'blocker-cycle');
  assert.equal(cycles.length, 1);
  assert.deepEqual(cycles[0].records.sort(), ['br.f.a', 'br.f.b']);
  assert.match(cycles[0].because, /br\.f\.a.*→.*br\.f\.b.*→.*br\.f\.a|br\.f\.b.*→.*br\.f\.a.*→.*br\.f\.b/);
});

test('section 3: candidate anchors already in the tree name a same-feature gap or open decision outside the ring', () => {
  const root = freshRoot();
  const workRoot = tree(root, {
    'features/f/br/a/index.yaml': 'schema: work/business-rule\nid: br.f.a\ntitle: A\nstate: todo\nblockedBy:\n  - {record: br.f.b, because: "b"}\n',
    'features/f/br/b/index.yaml': 'schema: work/business-rule\nid: br.f.b\ntitle: B\nstate: todo\nblockedBy:\n  - {record: br.f.a, because: "a"}\n',
    'features/f/gap/g/index.yaml': 'schema: work/gap\nid: gap.f.g\ntitle: G\nstate: todo\nstatement: nothing built yet\n',
  });
  const critique = computeCritique(workRoot);
  const cycle = findingsOf(critique, 'blocker-cycle')[0];
  assert.match(cycle.because, /gap\.f\.g/);
});

test('section 4: a done implementation record whose owners path does not exist on disk is flagged', () => {
  const root = freshRoot();
  const workRoot = tree(root, {
    'features/f/impl/x/index.yaml': `schema: work/implementation\nid: impl.f.x\ntitle: X\nstate: done\nrepository: ${path.basename(root)}\nowners:\n  - {role: module, path: src/does-not-exist.ts}\nrevision: deadbeef\nverificationSource: kernel-observed\nverification: [ok]\n`,
  });
  const critique = computeCritique(workRoot);
  const finding = findingsOf(critique, 'done-without-anchor').find(f => f.records[0] === 'impl.f.x');
  assert.ok(finding);
  assert.match(finding.because, /src\/does-not-exist\.ts/);
});

test('section 4: a done implementation record whose owners path DOES exist on disk is not flagged', () => {
  const root = freshRoot();
  write(root, 'src/real.ts', '// real file\n');
  const workRoot = tree(root, {
    'features/f/impl/x/index.yaml': `schema: work/implementation\nid: impl.f.x\ntitle: X\nstate: done\nrepository: ${path.basename(root)}\nowners:\n  - {role: module, path: src/real.ts}\nrevision: deadbeef\nverificationSource: kernel-observed\nverification: [ok]\n`,
  });
  const critique = computeCritique(workRoot);
  assert.equal(findingsOf(critique, 'done-without-anchor').filter(f => f.records[0] === 'impl.f.x').length, 0);
});

test('section 4: a done implementation record proving a target that is not itself done is flagged', () => {
  const root = freshRoot();
  write(root, 'src/real.ts', '// real file\n');
  const workRoot = tree(root, {
    'features/f/br/a/index.yaml': 'schema: work/business-rule\nid: br.f.a\ntitle: A\nstate: todo\n',
    'features/f/impl/x/index.yaml': `schema: work/implementation\nid: impl.f.x\ntitle: X\nstate: done\nrepository: ${path.basename(root)}\nowners:\n  - {role: module, path: src/real.ts}\nrevision: deadbeef\nverificationSource: kernel-observed\nverification: [ok]\nproves: [br.f.a]\n`,
  });
  const critique = computeCritique(workRoot);
  const finding = findingsOf(critique, 'done-proves-not-done').find(f => f.records[0] === 'impl.f.x');
  assert.ok(finding);
  assert.deepEqual(finding.records, ['impl.f.x', 'br.f.a']);
});

test('section 5: an sds-component with no owners is unbound', () => {
  const root = freshRoot();
  const workRoot = tree(root, {
    'features/f/sds/c/index.yaml': 'schema: work/sds-component\nid: sds.f.c\ntitle: C\nstate: todo\nresponsibility: r\n',
  });
  const critique = computeCritique(workRoot);
  const finding = findingsOf(critique, 'unbound-sds').find(f => f.records[0] === 'sds.f.c');
  assert.ok(finding);
  assert.match(finding.because, /no owners entry/);
});

test('section 5: an sds-component whose owners resolve to a real module directory is not flagged', () => {
  const root = freshRoot();
  fs.mkdirSync(path.join(root, 'src', 'mod'), {recursive: true});
  const workRoot = tree(root, {
    'features/f/sds/c/index.yaml': `schema: work/sds-component\nid: sds.f.c\ntitle: C\nstate: todo\nresponsibility: r\nrepository: ${path.basename(root)}\nowners:\n  - {role: module, path: src/mod}\n`,
  });
  const critique = computeCritique(workRoot);
  assert.equal(findingsOf(critique, 'unbound-sds').filter(f => f.records[0] === 'sds.f.c').length, 0);
});

test('section 6: a contract whose surface is prose only, with no typed field list, is flagged', () => {
  const root = freshRoot();
  const workRoot = tree(root, {
    'features/f/contract/z/index.yaml': 'schema: work/contract\nid: contract.f.z\ntitle: Z\nstate: todo\nbetween: {provider: f, consumer: g}\nowner: f\nsurface: "f gives g whatever it needs, informally"\n',
  });
  const critique = computeCritique(workRoot);
  const finding = findingsOf(critique, 'untyped-contract').find(f => f.records[0] === 'contract.f.z');
  assert.ok(finding);
});

test('section 6: a contract whose surface is a {name, shape} field list is not flagged', () => {
  const root = freshRoot();
  const workRoot = tree(root, {
    'features/f/contract/z/index.yaml': 'schema: work/contract\nid: contract.f.z\ntitle: Z\nstate: todo\nbetween: {provider: f, consumer: g}\nowner: f\nsurface:\n  - {name: doIt, shape: "(x) -> y"}\n',
  });
  const critique = computeCritique(workRoot);
  assert.equal(findingsOf(critique, 'untyped-contract').filter(f => f.records[0] === 'contract.f.z').length, 0);
});

test('section 7: an open policy-decision reports what it blocks, from both blocks and blockedBy citers', () => {
  const root = freshRoot();
  const workRoot = tree(root, {
    'features/f/decision/d/index.yaml': 'schema: work/policy-decision\nid: decision.f.d\ntitle: D\nstate: todo\noutcome: open\noptions: [{id: x, consequence: c}]\nblocks: [br.f.a]\n',
    'features/f/br/a/index.yaml': 'schema: work/business-rule\nid: br.f.a\ntitle: A\nstate: todo\n',
    'features/f/sds/c/index.yaml': 'schema: work/sds-component\nid: sds.f.c\ntitle: C\nstate: todo\nresponsibility: r\nblockedBy:\n  - {record: decision.f.d, because: "waiting on the decision"}\n',
  });
  const critique = computeCritique(workRoot);
  const finding = findingsOf(critique, 'open-decision').find(f => f.records[0] === 'decision.f.d');
  assert.deepEqual(finding.records.slice(1).sort(), ['br.f.a', 'sds.f.c']);
});

test('section 8: a todo blocked on an *.unbuilt-module gap is leftover; one blocked on an open decision is designed', () => {
  const root = freshRoot();
  const workRoot = tree(root, {
    'features/f/gap/unbuilt-module/index.yaml': 'schema: work/gap\nid: gap.f.unbuilt-module\ntitle: G\nstate: todo\nstatement: no module exists\n',
    'features/f/br/a/index.yaml': 'schema: work/business-rule\nid: br.f.a\ntitle: A\nstate: todo\nblockedBy:\n  - {record: gap.f.unbuilt-module, because: "not built"}\n',
    'features/f/decision/d/index.yaml': 'schema: work/policy-decision\nid: decision.f.d\ntitle: D\nstate: todo\noutcome: open\noptions: [{id: x, consequence: c}]\n',
    'features/f/br/b/index.yaml': 'schema: work/business-rule\nid: br.f.b\ntitle: B\nstate: todo\nblockedBy:\n  - {record: decision.f.d, because: "waiting on the decision"}\n',
  });
  const critique = computeCritique(workRoot);
  assert.ok(findingsOf(critique, 'leftover-todo').some(f => f.records[0] === 'br.f.a'));
  assert.ok(findingsOf(critique, 'designed-todo').some(f => f.records[0] === 'br.f.b'));
  assert.equal(findingsOf(critique, 'designed-todo').filter(f => f.records[0] === 'br.f.a').length, 0);
  assert.equal(findingsOf(critique, 'leftover-todo').filter(f => f.records[0] === 'br.f.b').length, 0);
});

test('section 9: stale evidence with staleSince naming a different record is designed; a bare digest mismatch is bulk-edit', () => {
  const root = freshRoot();
  const workRoot = tree(root, {
    'features/f/br/a/index.yaml': 'schema: work/business-rule\nid: br.f.a\ntitle: A\nstate: done\nverificationSource: authored-claim\nbecause: c\nchange: {rev: 2, kind: breaking, at: 2026-09-18T00:00:00.000Z}\n',
    'features/f/br/a/evidence.yaml': 'schema: work/evidence\nrecord: br.f.a\nrecordDigest: "deadbeef"\nstale: true\nstaleSince: {record: br.f.a}\noutcome: pass\n',
    'features/f/sds/c/index.yaml': 'schema: work/sds-component\nid: sds.f.c\ntitle: C\nstate: done\nresponsibility: r\nverificationSource: authored-claim\nbecause: c\n',
    'features/f/sds/c/evidence.yaml': 'schema: work/evidence\nrecord: sds.f.c\nrecordDigest: "deadbeef"\nstale: true\nstaleSince: {record: br.f.a, rev: 2}\noutcome: pass\n',
  });
  const critique = computeCritique(workRoot);
  assert.ok(findingsOf(critique, 'stale-evidence-bulk-edit').some(f => f.records[0] === 'br.f.a'));
  assert.equal(findingsOf(critique, 'stale-evidence-designed').filter(f => f.records[0] === 'br.f.a').length, 0);
  const designed = findingsOf(critique, 'stale-evidence-designed').find(f => f.records[0] === 'sds.f.c');
  assert.ok(designed);
  assert.deepEqual(designed.records, ['sds.f.c', 'br.f.a']);
});

test('gate: computeCritique is a pure, deterministic function of the tree (two runs agree byte-for-byte)', () => {
  const root = freshRoot();
  const workRoot = tree(root, {
    'features/f/br/a/index.yaml': 'schema: work/business-rule\nid: br.f.a\ntitle: A\nstate: todo\n',
  });
  const first = JSON.stringify(computeCritique(workRoot).findings);
  const second = JSON.stringify(computeCritique(workRoot).findings);
  assert.equal(first, second);
});

test('gate: a stale (or missing) critique output is refused, exactly like the derived index', () => {
  const root = freshRoot();
  const workRoot = tree(root, {
    'features/f/br/a/index.yaml': 'schema: work/business-rule\nid: br.f.a\ntitle: A\nstate: todo\n',
  });
  const missing = runCritique(workRoot, {write: false});
  assert.equal(missing.ok, false);

  runCritique(workRoot, {write: true});
  const fresh = runCritique(workRoot, {write: false});
  assert.equal(fresh.ok, true);

  write(workRoot, 'features/f/br/b/index.yaml', 'schema: work/business-rule\nid: br.f.b\ntitle: B\nstate: todo\n');
  const stale = runCritique(workRoot, {write: false});
  assert.equal(stale.ok, false);
});
