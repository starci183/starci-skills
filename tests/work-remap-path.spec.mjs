import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {scanTree, applyScan, findTargetRoot, searchRoots} from '../scripts/work-remap-path.mjs';

/**
 * Fixture specs for scripts/work-remap-path.mjs - the rename-survival tool v6-4's FM3 asked for.
 * Each test builds a throwaway .starciwork tree on the same drive as the repo (never os.tmpdir(),
 * which can be a different drive on this host) plus the real directories --to must resolve to.
 */
const TMP_ROOT = path.join(path.parse(process.cwd()).root, 'starci-tmp');

let counter = 0;
function freshDir() {
  counter += 1;
  const dir = path.join(TMP_ROOT, `remap-fixture-${process.pid}-${counter}`);
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

/** Minimal tree: workRoot + a code dir so the --to existence check can resolve. */
function tree(extra) {
  const root = freshDir();
  const workRoot = path.join(root, '.starciwork');
  write(workRoot, 'index.yaml', 'schema: work/catalog\nid: fixture\nfeatures: []\n');
  for (const [rel, content] of Object.entries(extra)) write(workRoot, rel, content);
  return {root, workRoot};
}

const IMPL = 'schema: work/implementation\n' +
  'id: impl.f.x\n' +
  'title: t\n' +
  'state: done\n' +
  'owners:\n' +
  '  - {role: module, path: src/old/mod}   # inline comment survives\n' +
  '  - {role: feature, path: src/old/feat}\n' +
  'proves: [br.f.a]\n' +
  'verificationSource: authored-claim\n' +
  'because: c\n';

test('scan finds every path-bearing shape and reports embedded mentions without rewriting them', () => {
  const {workRoot} = tree({
    'features/f/impl/x/index.yaml': IMPL,
    'features/f/br/a/index.yaml':
      'schema: work/business-rule\nid: br.f.a\ntitle: t\nstate: todo\nmodule: [src/old/mod, src/other]\nnotes: moved to src/old last sprint\n',
    'features/f/fr/b/index.yaml':
      'schema: work/functional-requirement\nid: fr.f.b\ntitle: t\nstate: todo\ncomposes:\n  - rule: br.f.a\n    module: src/old/mod\n',
  });
  const scan = scanTree(workRoot, 'src/old', 'src/new');
  const impl = [...scan.files.values()].find(r => r.rel.includes('impl'));
  assert.deepEqual(impl.rewrites.map(r => r.trail), ['owners[0].path', 'owners[1].path']);
  const br = [...scan.files.values()].find(r => r.rel.includes('br/a'));
  assert.deepEqual(br.rewrites.map(r => r.trail), ['module[0]']);
  assert.ok(br.embedded.some(e => e.trail === 'notes'), 'prose mention must be reported, not rewritten');
  const fr = [...scan.files.values()].find(r => r.rel.includes('fr/b'));
  assert.deepEqual(fr.rewrites.map(r => r.trail), ['composes[0].module']);
});

test('apply splices whole scalars only - comments, quoting and prose survive byte-identical', () => {
  const {workRoot} = tree({
    'features/f/impl/x/index.yaml': '# header comment\n' + IMPL + 'globs: "src/old/mod/**"\n',
    'features/f/br/a/index.yaml':
      'schema: work/business-rule\nid: br.f.a\ntitle: t\nstate: todo\nmodule: src/old\nnotes: moved to src/old\nlist:\n  - src/old/deep\n',
  });
  applyScan(workRoot, scanTree(workRoot, 'src/old', 'src/new'), {from: 'src/old', to: 'src/new', withEvidence: false});
  const impl = fs.readFileSync(path.join(workRoot, 'features/f/impl/x/index.yaml'), 'utf8');
  assert.ok(impl.startsWith('# header comment\n'), 'header comment must survive');
  assert.ok(impl.includes('path: src/new/mod}   # inline comment survives'), 'flow-map value rewritten, comment kept');
  assert.ok(impl.includes('path: src/new/feat}'));
  assert.ok(impl.includes('globs: "src/new/mod/**"'), 'quoted scalar rewritten inside its quotes');
  const br = fs.readFileSync(path.join(workRoot, 'features/f/br/a/index.yaml'), 'utf8');
  assert.ok(br.includes('module: src/new\n'));
  assert.ok(br.includes('notes: moved to src/old\n'), 'trailing prose mention must NOT be rewritten');
  assert.ok(br.includes('  - src/new/deep\n'), 'block-seq item rewritten');
  // the rewritten file still parses; a rescan finds nothing left to rewrite and 'notes' reported embedded
  const rescan = scanTree(workRoot, 'src/old', 'src/new');
  assert.equal([...rescan.files.values()].flatMap(r => r.rewrites).length, 0);
  const brScan = [...rescan.files.values()].find(r => r.rel.includes('br/a'));
  assert.ok(brScan.embedded.some(e => e.trail === 'notes'));
});

test('--with-evidence marks affected evidence stale; an already-stale file is left alone', () => {
  const {workRoot} = tree({
    'features/f/impl/x/index.yaml': IMPL,
    'features/f/impl/x/evidence.yaml':
      '# provenance header\nschema: work/evidence\nrecord: impl.f.x\noutcome: pass\n' +
      'codeDigest:\n  algorithm: sha256\n  files:\n    - {path: src/old/mod/a.ts, sha256: abcd}\n  digest: beef\n',
    'features/f/impl/y/index.yaml':
      'schema: work/implementation\nid: impl.f.y\ntitle: t\nstate: done\nowners: [{role: module, path: src/old/y}]\nverificationSource: authored-claim\nbecause: c\n',
    'features/f/impl/y/evidence.yaml':
      'schema: work/evidence\nrecord: impl.f.y\noutcome: pass\nstale: true\nstaleReason: "earlier edit"\n',
  });
  const scan = scanTree(workRoot, 'src/old', 'src/new');
  const res = applyScan(workRoot, scan, {from: 'src/old', to: 'src/new', withEvidence: true});
  assert.equal(res.markedStale.length, 1, 'only the not-yet-stale evidence is marked');
  assert.equal(res.alreadyStale.length, 1);
  const ev = fs.readFileSync(path.join(workRoot, 'features/f/impl/x/evidence.yaml'), 'utf8');
  assert.ok(ev.startsWith('# provenance header\n'));
  assert.ok(ev.includes('path: src/new/mod/a.ts'), 'codeDigest files[].path is a path field - rewritten');
  assert.ok(/^stale: true$/m.test(ev));
  assert.ok(ev.includes('staleReason: "path remap src/old -> src/new"'));
  const evY = fs.readFileSync(path.join(workRoot, 'features/f/impl/y/evidence.yaml'), 'utf8');
  assert.ok(evY.includes('staleReason: "earlier edit"'), 'existing staleReason is not overwritten');
});

test('evidence with no paths of its own is still marked when the record beside it moved', () => {
  const {workRoot} = tree({
    'features/f/impl/x/index.yaml': IMPL,
    'features/f/impl/x/evidence.yaml': 'schema: work/evidence\nrecord: impl.f.x\noutcome: pass\n',
  });
  const scan = scanTree(workRoot, 'src/old', 'src/new');
  const evFile = path.join(workRoot, 'features/f/impl/x/evidence.yaml');
  assert.ok(scan.staleTargets.has(evFile), 'recordDigest stales when the record file moves');
  applyScan(workRoot, scan, {from: 'src/old', to: 'src/new', withEvidence: true});
  assert.ok(/^stale: true$/m.test(fs.readFileSync(evFile, 'utf8')));
});

test('--to must exist under a bound root; a fictional target resolves to nothing', () => {
  const {root, workRoot} = tree({
    'workspace.yaml': 'schema: work/workspace\nid: fixture\nrepositories: [{role: be, name: app}, {role: fe, name: app-frontend}]\n',
  });
  fs.mkdirSync(path.join(root, 'src/new'), {recursive: true});
  assert.equal(findTargetRoot(workRoot, 'src/new', null), root);
  assert.equal(findTargetRoot(workRoot, 'src/ghost', null), null);
  // the bound frontend repo resolves beside the backend root
  assert.ok(searchRoots(workRoot, {repositories: [{role: 'fe', name: 'app-frontend'}]})
    .includes(path.join(path.dirname(root), 'app-frontend')));
});
