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

test('former contract entries are live while real history, the registry, check files and manifest refusals remain exempt', () => {
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
    assert.deepEqual(report.dead.map((d) => [d.file, d.token, d.line]).sort(), [
      ['modules/kernel/contract-changes/x.yaml', 'scripts/old/', 1],
      ['modules/kernel/contract-changes/x.yaml', 'scripts/old/dead.mjs', 1],
    ], 'only the former contract entry uses dead names; tombstones, forbids values and real history remain refusals or history');
    const scanned = retiredNameScan(root);
    assert.ok(scanned.includes('docs/live.md') && scanned.includes('modules/kernel/contract-changes/x.yaml'));
    assert.equal(scanned.includes(RETIRED_PATHS_FILE), false);
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


test('dependency bin paths are relative to their canonical package owner in v2 and v3 npm locks', () => {
  const registry = REGISTRY.replace('retiredNames:', '  - {from: bin/tool.mjs, to: packages/tool/bin/tool.mjs, movedIn: x, quiesced: false}\nretiredNames:');
  for (const lockfileVersion of [2, 3]) for (const nested of [false, true]) {
    const key = `${nested ? 'node_modules/parent/' : ''}node_modules/@fixture/tool`;
    const root = fixtureTree({
      'packages/tool/package.json': JSON.stringify({ name: '@fixture/tool', bin: { tool: './bin/tool.mjs' } }),
      'examples/app/package-lock.json': JSON.stringify({ lockfileVersion, packages: { [key]: { version: '1.0.0', bin: { tool: nested ? './bin/tool.mjs' : 'bin/tool.mjs' } } } }, null, nested ? 2 : undefined),
    }, registry);
    try { assert.deepEqual(checkRetiredNames(root).dead, []); } finally { fs.rmSync(root, { recursive: true, force: true }); }
  }
});

test('metadata ownership never exempts authored uses, other fields, retired names or retired paths', () => {
  const registry = REGISTRY.replace('retiredNames:', '  - {from: bin/tool.mjs, to: packages/tool/bin/tool.mjs, movedIn: x, quiesced: false}\nretiredNames:');
  const root = fixtureTree({
    'packages/tool/package.json': JSON.stringify({ name: '@fixture/tool', bin: { tool: './bin/tool.mjs' } }),
    'docs/stale.md': 'Run bin/tool.mjs.\n',
    'scripts/stale.mjs': 'const command = "bin/tool.mjs";\n',
    'examples/app/package-lock.json': JSON.stringify({ lockfileVersion: 3, packages: {
      '': { bin: { tool: 'bin/tool.mjs' } },
      'node_modules/@fixture/tool': { version: '1.0.0', bin: { tool: 'bin/tool.mjs' }, note: 'bin/tool.mjs', scripts: { start: 'node bin/tool.mjs' }, retired: 'scripts/old/dead.mjs', nameNote: 'gone-app', nested: { bin: { tool: 'bin/tool.mjs' } } },
    } }, null, 2),
  }, registry);
  try {
    const dead = checkRetiredNames(root).dead;
    assert.equal(dead.filter((d) => d.file === 'examples/app/package-lock.json' && d.token === 'bin/tool.mjs').length, 4);
    assert.ok(dead.some((d) => d.token === 'scripts/old/dead.mjs'));
    assert.ok(dead.some((d) => d.token === 'gone-app'));
    assert.deepEqual(dead.filter((d) => ['docs/stale.md', 'scripts/stale.mjs'].includes(d.file)).map((d) => [d.file, d.line]), [['docs/stale.md', 1], ['scripts/stale.mjs', 1]]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('only valid lock dependency identity, declared command and exact safe package bin receive metadata interpretation', () => {
  const registry = REGISTRY.replace('retiredNames:', '  - {from: bin/tool.mjs, to: packages/tool/bin/tool.mjs, movedIn: x, quiesced: false}\nretiredNames:');
  const canonical = { name: '@fixture/tool', bin: { tool: './bin/tool.mjs' } };
  const entry = { version: '1.0.0', bin: { tool: 'bin/tool.mjs' } };
  const lock = (value = entry, key = 'node_modules/@fixture/tool', version = 3) => JSON.stringify({ lockfileVersion: version, packages: { [key]: value } });
  const cases = [
    ['other dependency', lock(entry, 'node_modules/other')],
    ['root package', lock(entry, '')],
    ['non-npm prefix', lock(entry, 'vendor/node_modules/@fixture/tool')],
    ['alias identity', lock({ ...entry, name: '@fixture/other' })],
    ['link record', lock({ ...entry, link: true })],
    ['missing version', lock({ bin: entry.bin })],
    ['v1 lock', lock(entry, 'node_modules/@fixture/tool', 1)],
    ['wrong command', lock({ ...entry, bin: { another: 'bin/tool.mjs' } })],
    ['prefix path', lock({ ...entry, bin: { tool: 'prefix/bin/tool.mjs' } })],
    ['dot traversal', lock({ ...entry, bin: { tool: './other/../bin/tool.mjs' } })],
    ['absolute path', lock({ ...entry, bin: { tool: '/bin/tool.mjs' } })],
    ['Windows drive path', lock({ ...entry, bin: { tool: 'C:/bin/tool.mjs' } })],
    ['backslash path', lock({ ...entry, bin: { tool: 'other\\bin/tool.mjs' } })],
    ['control character', lock({ ...entry, bin: { tool: '\u0001bin/tool.mjs' } })],
    ['not a lock file', lock(entry), canonical, 'examples/app/metadata.json'],
    ['missing package owner', lock(entry), null],
    ['different package owner', lock(entry), { ...canonical, name: '@fixture/other' }],
    ['different declared bin', lock(entry), { ...canonical, bin: { tool: './another.mjs' } }],
    ['retired name in bin metadata', lock({ ...entry, bin: { tool: 'gone-app/bin/tool.mjs' } })],
    ['retired path in bin metadata', lock({ ...entry, bin: { tool: 'scripts/old/dead.mjs bin/tool.mjs' } })],
    ['double slash path', lock({ ...entry, bin: { tool: './/bin/tool.mjs' } })],
    ['invalid JSON', '{"lockfileVersion":3,"packages":{"node_modules/@fixture/tool":{"version":"1","bin":{"tool":"bin/tool.mjs"}}}'],
    ['duplicate bin key', '{"lockfileVersion":3,"packages":{"node_modules/@fixture/tool":{"version":"1","bin":{"tool":"bin/tool.mjs","tool":"bin/tool.mjs"}}}}'],
    ['duplicate package key', '{"lockfileVersion":3,"packages":{"node_modules/@fixture/tool":{"version":"1","bin":{"tool":"bin/tool.mjs"}},"node_modules/@fixture/tool":{"version":"1","bin":{"tool":"bin/tool.mjs"}}}}'],
  ];
  for (const [label, text, manifest = canonical, file = 'examples/app/package-lock.json'] of cases) {
    const files = { [file]: text };
    if (manifest) files['packages/tool/package.json'] = JSON.stringify(manifest);
    const root = fixtureTree(files, registry);
    try {
      const dead = checkRetiredNames(root).dead;
      assert.ok(dead.some((d) => d.file === file && d.token === 'bin/tool.mjs'), label);
      if (label === 'retired name in bin metadata') assert.ok(dead.some((d) => d.file === file && d.token === 'gone-app'));
      if (label === 'retired path in bin metadata') assert.ok(dead.some((d) => d.file === file && d.token === 'scripts/old/dead.mjs'));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  }
});

test('dependency bin metadata is not a substring waiver for a different moved destination', () => {
  const registry = REGISTRY.replace('retiredNames:', '  - {from: bin/tool.mjs, to: packages/tool/bin/tool.mjs.map, movedIn: x, quiesced: false}\nretiredNames:');
  const root = fixtureTree({
    'packages/tool/package.json': JSON.stringify({ name: '@fixture/tool', bin: { tool: './bin/tool.mjs.map' } }),
    'examples/app/package-lock.json': JSON.stringify({ lockfileVersion: 3, packages: { 'node_modules/@fixture/tool': { version: '1.0.0', bin: { tool: 'bin/tool.mjs.map' } } } }),
  }, registry);
  try { assert.ok(checkRetiredNames(root).dead.some((d) => d.file === 'examples/app/package-lock.json' && d.token === 'bin/tool.mjs')); } finally { fs.rmSync(root, { recursive: true, force: true }); }
});


test('ambiguous canonical name, bin or command keys cannot authorize dependency bin metadata', () => {
  const registry = REGISTRY.replace('retiredNames:', '  - {from: bin/tool.mjs, to: packages/tool/bin/tool.mjs, movedIn: x, quiesced: false}\nretiredNames:');
  const lockFile = 'examples/app/package-lock.json';
  const lockText = JSON.stringify({ lockfileVersion: 3, packages: { 'node_modules/@fixture/tool': { version: '1.0.0', bin: { tool: 'bin/tool.mjs' } } } }, null, 2);
  const binLine = lockText.split('\n').findIndex((line) => line.includes('"tool": "bin/tool.mjs"')) + 1;
  const cases = [
    ['unique owner', '{"name":"@fixture/tool","bin":{"tool":"./bin/tool.mjs"}}', 0],
    ['duplicate name', '{"name":"@fixture/other","name":"@fixture/tool","bin":{"tool":"./bin/tool.mjs"}}', 1],
    ['escaped duplicate name', '{"name":"@fixture/other","n\\u0061me":"@fixture/tool","bin":{"tool":"./bin/tool.mjs"}}', 1],
    ['duplicate bin', '{"name":"@fixture/tool","bin":{"tool":"./different.mjs"},"bin":{"tool":"./bin/tool.mjs"}}', 1],
    ['escaped duplicate bin', '{"name":"@fixture/tool","bin":{"tool":"./different.mjs"},"b\\u0069n":{"tool":"./bin/tool.mjs"}}', 1],
    ['duplicate command', '{"name":"@fixture/tool","bin":{"tool":"./different.mjs","tool":"./bin/tool.mjs"}}', 1],
    ['escaped duplicate command', '{"name":"@fixture/tool","bin":{"tool":"./different.mjs","\\u0074ool":"./bin/tool.mjs"}}', 1],
  ];
  for (const [label, ownerText, expected] of cases) {
    const root = fixtureTree({ 'packages/tool/package.json': ownerText, [lockFile]: lockText }, registry);
    try {
      const binFindings = checkRetiredNames(root).dead.filter((d) => d.file === lockFile && d.line === binLine && d.token === 'bin/tool.mjs');
      assert.equal(binFindings.length, expected, label);
      assert.ok(binFindings.every((d) => d.kind === 'moved path'), label);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  }
});

test('dependency bin exemption belongs to its exact moved row, preserving same-text kinds and destinations', () => {
  const registry = REGISTRY
    .replace('retired:', 'retired:\n  - {path: bin/tool.mjs, retiredAt: 2026-01-01, removedIn: x, replacedBy: scripts/live.mjs}')
    .replace('retiredNames:', '  - {from: bin/tool.mjs, to: packages/tool/bin/tool.mjs, movedIn: x, quiesced: false}\n  - {from: bin/tool.mjs, to: packages/other/bin/tool.mjs, movedIn: x, quiesced: false}\nretiredNames:\n  - {name: bin/tool.mjs, note: independently retired naming}');
  const lockFile = 'examples/app/package-lock.json';
  const lockText = JSON.stringify({ lockfileVersion: 3, packages: { 'node_modules/@fixture/tool': { version: '1.0.0', bin: { tool: 'bin/tool.mjs' }, note: 'bin/tool.mjs' } } }, null, 2);
  const binLine = lockText.split('\n').findIndex((line) => line.includes('"tool": "bin/tool.mjs"')) + 1;
  const noteLine = lockText.split('\n').findIndex((line) => line.includes('"note": "bin/tool.mjs"')) + 1;
  const root = fixtureTree({
    'packages/tool/package.json': '{"name":"@fixture/tool","bin":{"tool":"./bin/tool.mjs"}}',
    'packages/other/package.json': '{"name":"@fixture/other","bin":{"tool":"./bin/tool.mjs"}}',
    'docs/stale.md': 'Run bin/tool.mjs.\n',
    [lockFile]: lockText,
  }, registry);
  try {
    const tokens = retiredNameTokens(root).filter((t) => t.token === 'bin/tool.mjs');
    const qualifying = tokens.find((t) => t.to === 'packages/tool/bin/tool.mjs');
    const mismatching = tokens.find((t) => t.to === 'packages/other/bin/tool.mjs');
    const retiredPath = tokens.find((t) => t.kind === 'retired path');
    const retiredName = tokens.find((t) => t.kind === 'retired name');
    assert.ok(qualifying && mismatching && retiredPath && retiredName);
    const cases = [
      ['qualifying alone', [qualifying], []],
      ['mismatching alone', [mismatching], [mismatching]],
      ['qualifying first', [qualifying, mismatching], [mismatching]],
      ['mismatching first', [mismatching, qualifying], [mismatching]],
      ['same-text retired kinds', [qualifying, retiredPath, retiredName], [retiredPath, retiredName]],
      ['all registry rows', tokens, [mismatching, retiredPath, retiredName]],
    ];
    const identity = (row) => `${row.kind}: ${row.why}`;
    for (const [label, selection, expected] of cases) {
      const report = label === 'all registry rows' ? checkRetiredNames(root) : checkRetiredNames(root, selection);
      const selected = report.dead.filter((d) => d.token === 'bin/tool.mjs');
      assert.deepEqual(selected.filter((d) => d.file === lockFile && d.line === binLine).map(identity).sort(), expected.map(identity).sort(), label);
      assert.equal(selected.filter((d) => d.file === lockFile && d.line === noteLine).length, selection.length, `${label}: non-bin metadata remains live`);
      assert.equal(selected.filter((d) => d.file === 'docs/stale.md' && d.line === 1).length, selection.length, `${label}: authored use remains live`);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
