import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkContractCites, checkContractCitesMain, citesIn, isUnverifiable } from '../scripts/checks/check-contract-cites.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');

const fixtureTree = (files) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-cites-'));
  for (const [rel, body] of Object.entries(files)) {
    const target = path.join(root, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
  }
  return root;
};

test('every cite under modules/kernel resolves in the real tree', () => {
  const report = checkContractCites(repoRoot);
  assert.deepEqual(report.dead, [], 'dead cites in modules/kernel');
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

test('globs, placeholders and runtime state are skipped rather than reported dead', () => {
  const root = fixtureTree({
    'modules/kernel/fixture.yaml': [
      'a:',
      '  citation: "scripts/checks/spec/*.mjs; modules/ops/ops/<opId>.yaml; .starciwork/runtime.sqlite"',
      '  prose: "evidence lands at E/manifest.yaml inside the record"',
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
