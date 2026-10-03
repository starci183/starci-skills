import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  RETIRED_NAME_LIVE,
  checkRetiredNames, checkRetiredNamesMain, retiredNameFindings, retiredNameScan, retiredNameTokens,
} from '../../scripts/checks/check-retired-names.mjs';
import { RETIRED_PATHS_FILE } from '../../scripts/lib/check-scan.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const CHECK = path.join(repoRoot, 'scripts/checks/check-retired-names.mjs');

const REGISTRY = [
  'schema: starci/retired-paths@2',
  'retired:',
  '  - {path: scripts/old/dead.mjs, retiredAt: 2026-01-01, removedIn: x, replacedBy: scripts/live.mjs}',
  '  - {path: scripts/old/, retiredAt: 2026-01-01, removedIn: x, replacedBy: scripts/live/}',
  'moved:',
  '  - {from: scripts/went/there.mjs, to: scripts/here/there.mjs, movedIn: x, quiesced: false}',
  'retiredNames:',
  '  - {name: gone-app, note: the deleted example app}',
  'retiredSymbols: []',
  '',
].join('\n');

const fixtureTree = (files, registry = REGISTRY) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-retired-names-'));
  for (const [rel, body] of Object.entries({ [RETIRED_PATHS_FILE]: registry, ...files })) {
    const target = path.join(root, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
  }
  return root;
};

test('the real tree carries no retired name outside history', () => {
  const tokens = retiredNameTokens(repoRoot);
  assert.ok(tokens.length > 50, 'the registry is a real token list');
  for (const name of ['todo-app', 'transport/cli', 'platform/cli', 'kernel/api.mjs', 'orch-', 'migrate app', 'fleet']) {
    assert.ok(tokens.some((t) => t.token === name && t.kind === 'retired name'), `retiredNames names ${name}`);
  }
  const report = checkRetiredNames(repoRoot);
  assert.deepEqual(report.dead.map((d) => `${d.file}:${d.line}`), [], JSON.stringify(report.dead.slice(0, 10)));
  const run = spawnSync(process.execPath, [CHECK], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
});

test('RT_RETIRED_NAME_LIVE: a retired path, a moved-from path and a retired name are live occurrences in prose, a comment, a literal and a file path', () => {
  const root = fixtureTree({
    'docs/guide.md': 'Run `scripts/old/dead.mjs` once.\nThe dir scripts/old/ held it.\n',
    'scripts/run.mjs': '// calls scripts/went/there.mjs from before\nconst body = "gone-app ran here";\n',
    'knowledge/x.yaml': 'note: gone-app was the example\n',
    'examples/gone-app/index.yaml': 'a: 1\n',
  });
  try {
    const report = checkRetiredNames(root);
    assert.deepEqual(
      report.dead.map((d) => [d.file, d.token, d.line]).sort(),
      [
        ['docs/guide.md', 'scripts/old/', 1],
        ['docs/guide.md', 'scripts/old/', 2],
        ['docs/guide.md', 'scripts/old/dead.mjs', 1],
        ['examples/gone-app/index.yaml', 'gone-app', 0],
        ['knowledge/x.yaml', 'gone-app', 1],
        ['scripts/run.mjs', 'gone-app', 2],
        ['scripts/run.mjs', 'scripts/went/there.mjs', 1],
      ],
      'a doc cite, a moved path in a comment, a name in a string and in yaml, and a file path that names it are all refused',
    );
    assert.ok(retiredNameFindings(root).every((f) => f.code === RETIRED_NAME_LIVE));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('history, the registry itself, the check files and a manifest refusal are not scanned', () => {
  const root = fixtureTree({
    'modules/kernel/contract-changes/x.yaml': 'summary: "`scripts/old/dead.mjs` did it once"\n',
    'CHANGELOG.md': '# old\n\ngone-app shipped then.\n',
    'benchmark/note.md': 'found scripts/went/there.mjs slow\n',
    '.starciwork/runs/x/index.yaml': 'ran scripts/old/dead.mjs\n',
    'scripts/checks/check-retired-names.mjs': '// gone-app\n',
    'tests/checks/retired-names.spec.mjs': '// scripts/old/dead.mjs\n',
    'knowledge/hfs/slots.yaml': [
      'slots:',
      '  - id: be.old-retired',
      '    path: "scripts/old/"',
      '    presence: forbidden',
      '    goesTo: "scripts/live/"',
      '  - id: be.live',
      '    path: "scripts/live/"',
      '    forbids: [dead.mjs, gone-app]',
    ].join('\n'),
    'docs/live.md': 'scripts/live.mjs and scripts/here/there.mjs run now.\n',
  });
  try {
    const report = checkRetiredNames(root);
    assert.deepEqual(report.dead, [], 'a forbidden tombstone path, a forbids value and history name the dead names legitimately');
    assert.ok(retiredNameScan(root).includes('docs/live.md') && !retiredNameScan(root).includes(RETIRED_PATHS_FILE));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a live slot path that names a retired path is refused; only the forbidden tombstone is a refusal', () => {
  const root = fixtureTree({
    'knowledge/hfs/slots.yaml': [
      'slots:',
      '  - id: be.still-live',
      '    path: "scripts/old/"',
      '    presence: required',
    ].join('\n'),
  });
  try {
    const report = checkRetiredNames(root);
    assert.deepEqual(report.dead.map((d) => [d.file, d.token]), [['knowledge/hfs/slots.yaml', 'scripts/old/']]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('CLI: a clean tree exits 0, a dirty tree 1 with file:line, --json reports, a bad argument is 2', () => {
  const clean = fixtureTree({ 'docs/a.md': 'nothing dead here\n' });
  const dirty = fixtureTree({ 'docs/a.md': 'gone-app again\n' });
  try {
    assert.equal(checkRetiredNamesMain(['--root', clean]).exitCode, 0);
    const red = checkRetiredNamesMain(['--root', dirty]);
    assert.equal(red.exitCode, 1);
    assert.ok(red.text.includes('docs/a.md:1') && red.text.includes('gone-app'), red.text);
    const json = JSON.parse(checkRetiredNamesMain(['--root', dirty, '--json']).text);
    assert.equal(json.schema, 'starci/retired-names@1');
    assert.equal(json.ok, false);
    assert.equal(checkRetiredNamesMain(['--bogus']).exitCode, 2);
    assert.equal(checkRetiredNamesMain(['--root']).exitCode, 2);
    assert.equal(checkRetiredNamesMain(['--help']).exitCode, 0);
  } finally {
    fs.rmSync(clean, { recursive: true, force: true });
    fs.rmSync(dirty, { recursive: true, force: true });
  }
});

test('a moved path that is the tail of its own destination is not a use of the old path', () => {
  const registry = REGISTRY.replace('retiredNames:', '  - {from: bin/tool.mjs, to: packages/pkg/bin/tool.mjs, movedIn: x, quiesced: false}\nretiredNames:');
  const root = fixtureTree({
    'docs/live.md': 'Run packages/pkg/bin/tool.mjs for it.\n',
    'packages/pkg/package.json': '{"bin":{"tool":"./bin/tool.mjs"}}\n',
    'docs/stale.md': 'Run node bin/tool.mjs for it.\n',
  }, registry);
  try {
    const dead = checkRetiredNames(root).dead.filter((d) => d.token === 'bin/tool.mjs');
    assert.deepEqual(dead.map((d) => d.file), ['docs/stale.md']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
