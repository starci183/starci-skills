import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { CATALOG as catalog } from '../../packages/cli/src/catalog.generated.mjs';
import { main } from '../../scripts/cli/main.mjs';
import { flagsOfUsage } from '../../scripts/checks/check-cli-parity.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const group = catalog.groups.gate;
const read = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');
const declaration = (source, name = 'USAGE') => {
  const start = source.indexOf(`const ${name}`);
  assert.notEqual(start, -1, `${name} declaration exists`);
  const equals = source.indexOf('=', start);
  const open = source.slice(equals + 1).search(/['"`]/) + equals + 1;
  const quote = source[open];
  let close = open + 1;
  for (; close < source.length; close += 1) {
    if (source[close] === quote && source[close - 1] !== '\\') break;
  }
  assert.ok(close < source.length, `${name} string literal closes`);
  return source.slice(open + 1, close);
};
const between = (source, from, to) => {
  const start = source.indexOf(from);
  assert.notEqual(start, -1, `usage starts with ${from}`);
  const end = source.indexOf(to, start);
  return source.slice(start, end < 0 ? source.length : end);
};
const matching = (source, needle) => source.split(/\r?\n/).filter((line) => line.includes(needle)).join('\n');

const specs = {
  'canon-scan': { script: 'scripts/gates/canon-scan.mjs', usage: (s) => declaration(s), flags: ['blob', 'exclude', 'families', 'fix', 'machines', 'out', 'paths', 'root', 'stack-kind'] },
  'custody-exec': { script: 'scripts/gates/custody-exec.mjs', usage: (s) => between(s, '//   starci gate custody-exec', '// WHY'), flags: ['get', 'input-type', 'keys'] },
  'env-health': { script: 'scripts/uat/env-health.mjs', usage: (s) => between(s, '//   starci gate env-health check', '//\n// The JSON'), flags: ['env', 'paths', 'probe-timeout-ms', 'ready-timeout-ms', 'repo', 'restart', 'service', 'url'] },
  'hfs-sync': { script: 'scripts/gates/hfs-sync.mjs', usage: (s) => matching(s, '//   starci gate hfs-sync'), flags: ['repo'] },
  read: { script: 'scripts/gates/read-digest.mjs', usage: (s) => declaration(s), flags: ['knowledge', 'out', 'read', 'root', 'touch'] },
  'reference-conventions': { script: 'scripts/gates/probe-reference-conventions.mjs', usage: () => [], flags: [] },
  'repo-presentation': { script: 'scripts/gates/repo-presentation.mjs', usage: (s) => matching(s, '//   starci gate repo-presentation'), flags: ['root', 'runtime'] },
  'install-sandbox': { script: 'scripts/gates/install-sandbox.mjs', usage: (s) => matching(s, '//   starci gate install-sandbox'), flags: ['docker', 'keep', 'out', 'tarball', 'tools'] },
  'runtime-artifact': { script: 'scripts/gates/runtime-artifact.mjs', usage: (s) => matching(s, '//   starci gate runtime-artifact'), flags: ['dir', 'out', 'pack', 'root'] },
  'runtime-coverage': { script: 'scripts/gates/runtime-coverage.mjs', usage: (s) => matching(s, '//   starci gate runtime-coverage'), flags: [] },
  run: { script: 'scripts/cli/gate-run.mjs', usage: () => declaration(read('scripts/gates/gate.mjs')), flags: ['base', 'changed', 'main', 'out', 'root', 'scope', 'tests', 'tree'] },
  sonar: { script: 'scripts/gates/sonar-local.mjs', usage: (s) => declaration(s, 'HELP'), flags: ['base', 'blob', 'declaration', 'host', 'isolate', 'keep-slice-project', 'key', 'log', 'name', 'no-ensure', 'out', 'paths', 'project-gate', 'stack', 'timeout', 'token-ref', 'wait', 'wait-timeout', 'with-token'] },
  starcistacks: { script: 'scripts/gates/starcistacks.mjs', usage: (s) => declaration(s), flags: ['new'] },
  'test-world': { script: 'scripts/gates/test-world-run.mjs', usage: (s) => declaration(s), flags: ['out', 'project', 'root', 'tests'] },
  unit: { script: 'scripts/gates/unit-run.mjs', usage: (s) => declaration(s), flags: ['out', 'root'] },
};

test('gate catalog resolves every implementation and exactly declares its parsed flags', () => {
  assert.deepEqual(Object.keys(group.verbs).sort(), Object.keys(specs).sort());
  for (const [verb, spec] of Object.entries(specs)) {
    const command = group.verbs[verb];
    assert.equal(command.impl.script, spec.script, verb);
    assert.ok(fs.existsSync(path.join(repoRoot, command.impl.script)), `${verb} implementation exists`);
    const source = read(spec.script);
    assert.deepEqual(flagsOfUsage(spec.usage(source)).sort(), [...spec.flags].sort(), `${verb} usage reflects its parser`);
    assert.deepEqual(command.flags.map((flag) => flag.name).sort(), [...spec.flags].sort(), `${verb} catalog flags`);
  }
});

test('gate dispatch resolves through the injected script seam', () => {
  const calls = [];
  assert.equal(main(['gate', 'unit', '--root', 'app', '--out', 'unit.json'], {
    catalog,
    runScript: (script, args, options) => { calls.push({ script, args, options }); return 0; },
  }), 0);
  assert.equal(path.relative(repoRoot, calls[0].script).replaceAll(path.sep, '/'), 'scripts/gates/unit-run.mjs');
  assert.deepEqual(calls[0].args, ['--root', 'app', '--out', 'unit.json']);
});
