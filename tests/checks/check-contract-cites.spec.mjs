import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { CITED_PATH_MISSING, checkContractCites, checkContractCitesMain, citedPathFindings, citesIn, isUnverifiable, runtimeCiteScan } from '../../scripts/checks/check-contract-cites.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

const fixtureTree = (files) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-cites-'));
  // The default scan covers modules/{kernel,goal,ops}: a fixture keeps the three
  // roots present so `nothing to scan` stays a real misconfiguration error.
  for (const dir of ['modules/kernel', 'modules/goal', 'modules/ops']) fs.mkdirSync(path.join(root, dir), { recursive: true });
  for (const [rel, body] of Object.entries(files)) {
    const target = path.join(root, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
  }
  return root;
};

test('every cite under modules/kernel, modules/goal and modules/ops resolves in the real tree', () => {
  const report = checkContractCites(repoRoot);
  assert.deepEqual(report.dead, [], 'dead cites in the default scan');
  assert.ok(report.citesChecked > 100, `expected a real scan, checked ${report.citesChecked}`);
  const run = spawnSync(process.execPath, [path.join(repoRoot, 'scripts/checks/check-contract-cites.mjs')], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
});

test('a missing file, a missing symbol and a bare filename are each a dead cite', () => {
  const root = fixtureTree({
    'engine/real.mjs': 'export const liveSymbol = 1;\n',
    'modules/kernel/fixture.yaml': [
      'a:',
      '  citation: "engine/real.mjs is here; engine/ghost.mjs is not"',
      '  enforcedBy: "kinds.yaml routes"',
      'b:',
      '  note: "`engine/real.mjs::liveSymbol` and `engine/real.mjs::deadSymbol`"',
      '  more: "`liveSymbol()` in engine/real.mjs and `goneSymbol()` in engine/real.mjs"',
      '  prose: "modules/kernel/fixture.yaml is fine, engine/nope.yaml is not"',
      '',
    ].join('\n'),
  });
  try {
    const report = checkContractCites(root);
    const at = (target, symbol) => report.dead.find((d) => d.target === target && (symbol === undefined || d.symbol === symbol));
    assert.ok(at('engine/ghost.mjs'), 'a cited file that does not exist');
    assert.ok(at('engine/nope.yaml'), 'a prose path that does not exist');
    assert.ok(at('engine/real.mjs', 'deadSymbol'), 'file::symbol with no such symbol');
    assert.ok(at('engine/real.mjs', 'goneSymbol'), '`symbol()` in file with no such symbol');
    assert.equal(at('engine/real.mjs', 'liveSymbol'), undefined, 'a live symbol is not dead');
    assert.ok(at('kinds.yaml'), 'a bare filename never names one authority');
    assert.equal(report.ok, false);
    const result = checkContractCitesMain(['--root', root]);
    assert.equal(result.exitCode, 1);
    assert.match(result.text, /modules\/kernel\/fixture\.yaml:2\s+engine\/ghost\.mjs/);
    const run = spawnSync(process.execPath, [path.join(repoRoot, 'scripts/checks/check-contract-cites.mjs'), '--root', root], { encoding: 'utf8' });
    assert.equal(run.status, 1, run.stdout + run.stderr);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('canonical host prompts are verifiable while local project runtime state remains exempt', () => {
  const root = fixtureTree({
    '.starci/host/startup.md': '# Native host startup\n',
    'modules/kernel/fixture.yaml': 'source: .starci/host/startup.md\nmissing:\n  source: .starci/host/maintenance.md\nstate:\n  source: .starciwork/runtime.sqlite\n',
  });
  try {
    assert.equal(isUnverifiable('.starci/host/startup.md'), false);
    assert.equal(isUnverifiable('.starciwork/runtime.sqlite'), true);
    const report = checkContractCites(root);
    assert.equal(report.ok, false);
    assert.deepEqual(report.dead.map(({target}) => target), ['.starci/host/maintenance.md']);
    assert.equal(report.citesChecked, 2);
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
});

test('globs, placeholders and runtime state are skipped rather than reported dead', () => {
  const root = fixtureTree({
    'modules/kernel/fixture.yaml': [
      'a:',
      '  citation: "scripts/checks/spec/*.mjs; modules/ops/ops/<opId>.yaml; .starciwork/runtime.sqlite"',
      '  prose: "evidence lands at evidence/manifest.yaml inside the record"',
      '',
    ].join('\n'),
  });
  try {
    assert.deepEqual(checkContractCites(root).dead, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  assert.equal(isUnverifiable('scripts/checks/*.mjs'), true);
  assert.equal(isUnverifiable('modules/ops/ops/<opId>.yaml'), true);
  assert.equal(isUnverifiable('engine/config.mjs'), false);
});

test('a {braced} group expands and a {skillRoot} template resolves to the tree', () => {
  const cites = citesIn('  citation: "modules/kernel/{api,dispatch}.yaml; {skillRoot}/engine/config.mjs"\n');
  assert.deepEqual(cites.map((c) => c.target).sort(),
    ['engine/config.mjs', 'modules/kernel/api.yaml', 'modules/kernel/dispatch.yaml']);
});

test('an unscannable target and a bad flag are usage errors', () => {
  assert.equal(checkContractCitesMain(['--root', repoRoot, '--scan', 'does/not/exist']).exitCode, 2);
  assert.equal(checkContractCitesMain(['--nope']).exitCode, 2);
  assert.equal(checkContractCitesMain(['--root']).exitCode, 2);
});

test('every cite under modules/goal and modules/ops resolves in the real tree', () => {
  const report = checkContractCites(repoRoot, ['modules/goal', 'modules/ops']);
  assert.deepEqual(report.dead, [], 'dead cites in modules/goal or modules/ops');
  assert.ok(report.citesChecked > 100, `expected a real scan, checked ${report.citesChecked}`);
});

test('a retired path is valid history in a contract-change entry, and dead in live text — owner-rulings.yaml included', () => {
  const root = fixtureTree({
    'modules/kernel/retired-paths.yaml': 'schema: starci/retired-paths@1\nretired:\n  - {path: scripts/old/loop.mjs, retiredAt: 2026-09-28}\n',
    'modules/kernel/contract-changes/old.yaml': 'id: old\nsummary: "`scripts/old/loop.mjs` did it once"\n',
    'modules/kernel/owner-rulings.yaml': 'r:\n  citation: scripts/old/loop.mjs\n',
    'modules/kernel/live.yaml': 'a:\n  note: "run `scripts/old/loop.mjs`"\n',
    'scripts/old/.keep': '',
  });
  try {
    const report = checkContractCites(root);
    assert.deepEqual(report.dead.map((d) => d.file), ['modules/kernel/live.yaml', 'modules/kernel/owner-rulings.yaml'], JSON.stringify(report.dead));
    assert.equal(report.retiredCites, 2, 'the contract-change entry and the registry itself keep the cite as history');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a moved path is valid history and dead in live text, named with where it went (moved[])', () => {
  const root = fixtureTree({
    'modules/kernel/retired-paths.yaml': 'schema: starci/retired-paths@2\nretired: []\nmoved:\n  - {from: scripts/old/gate.mjs, to: scripts/gates/gate.mjs, movedIn: C4, quiesced: false}\n  - {from: scripts/kernel/gone-verbs/, to: scripts/kernel/verbs/, movedIn: C6, quiesced: false}\n',
    'modules/kernel/contract-changes/old.yaml': 'id: old\nsummary: "`scripts/old/gate.mjs` ran the gate"\n',
    'modules/kernel/contract-changes/verb.yaml': 'id: verb\nsummary: "`scripts/kernel/gone-verbs/settle.mjs` settled"\n',
    'modules/kernel/contract-changes/copy.yaml': 'id: copy\nsummary: "`packages/hfs/runtime/scripts/old/gate.mjs` was bundled"\n',
    'knowledge/hfs/runtime-slots.yaml': 'ruleParams:\n  runtime:\n    generated:\n      - {root: packages/hfs/runtime, generatedBy: x.mjs}\n',
    'packages/hfs/runtime/.keep': '',
    'modules/kernel/live.yaml': 'a:\n  note: "run `scripts/old/gate.mjs`"\n',
    'scripts/gates/gate.mjs': '',
  });
  try {
    const report = checkContractCites(root);
    assert.deepEqual(report.dead.map((d) => [d.file, d.why]), [['modules/kernel/live.yaml', 'moved to scripts/gates/gate.mjs']]);
    assert.equal(report.retiredCites, 4, 'the contract changes and the registry itself cite old paths as history, a file below a moved directory and a generated copy of a moved file included');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('RT_CITED_PATH_MISSING: the widened scan reads every tracked doc, yaml and source comment, never history', () => {
  const root = fixtureTree({
    'modules/kernel/live.yaml': 'a: 1\n',
    'docs/guide.md': 'Run `scripts/missing/tool.mjs` first.\n',
    'knowledge/patterns/fe/x.yaml': 'note: "scripts/missing/tool.mjs did it"\n',
    'scripts/run.mjs': '// runs `scripts/missing/tool.mjs` next\nexport const codePath = "scripts/missing/in-data.mjs";\n',
    'modules/kernel/contract-changes/old.yaml': 'id: old\nsummary: "`scripts/missing/tool.mjs` did it once"\n',
    'CHANGELOG.md': '# old\n\n`scripts/missing/tool.mjs` was here.\n',
    'benchmark/note.md': 'a finding: `scripts/missing/tool.mjs`\n',
    'scripts/present.mjs': '',
  });
  try {
    const findings = citedPathFindings(root);
    assert.deepEqual(
      findings.map((f) => f.path).sort(),
      ['docs/guide.md', 'knowledge/patterns/fe/x.yaml', 'scripts/run.mjs'],
      'a doc, a knowledge yaml and a source comment are scanned; a string literal, contract history, a changelog and a benchmark are not',
    );
    assert.ok(findings.every((f) => f.code === CITED_PATH_MISSING && f.message.includes('scripts/missing/tool.mjs')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('RT_CITED_PATH_MISSING: live prose whose every runtime path exists has no finding', () => {
  const root = fixtureTree({
    'modules/kernel/live.yaml': 'a:\n  note: "run `scripts/present.mjs`"\n',
    'docs/guide.md': 'Run `scripts/present.mjs` first.\n',
    'scripts/present.mjs': '',
  });
  try {
    assert.deepEqual(citedPathFindings(root).filter((f) => f.code === 'RT_CITED_PATH_MISSING'), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
