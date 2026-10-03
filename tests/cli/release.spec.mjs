import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { CATALOG as catalog } from '../../packages/cli/src/catalog.generated.mjs';
import { main } from '../../scripts/cli/main.mjs';
import { flagsOfUsage } from '../../scripts/checks/check-cli-parity.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const group = catalog.groups.release;
const read = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');
const declaration = (source) => {
  const start = source.indexOf('const USAGE');
  assert.notEqual(start, -1, 'USAGE declaration exists');
  const equals = source.indexOf('=', start);
  const open = source.slice(equals + 1).search(/['"`]/) + equals + 1;
  const quote = source[open];
  let close = open + 1;
  for (; close < source.length; close += 1) {
    if (source[close] === quote && source[close - 1] !== '\\') break;
  }
  assert.ok(close < source.length, 'USAGE string literal closes');
  return source.slice(open + 1, close);
};
const matching = (source, needle) => source.split(/\r?\n/).filter((line) => line.includes(needle)).join('\n');

const specs = {
  'app-installs': { script: 'scripts/gates/release-app-installs.mjs', usage: (s) => matching(s, 'starci release app-installs'), flags: ['keep'] },
  check: { script: 'scripts/gates/release-check.mjs', usage: (s) => matching(s, '//   starci release check'), flags: ['final', 'only'] },
  cut: { script: 'scripts/supervisor/release-cut-cli.mjs', usage: (s) => matching(s, '/** Parse'), flags: ['branch', 'remote', 'repo', 'tag'] },
  'clean-test': { script: 'scripts/gates/package-clean-test.mjs', usage: (s) => declaration(s), flags: ['base', 'changed'] },
  'launch-smoke': { script: 'scripts/kernel/launch-smoke.mjs', usage: (s) => matching(s, 'starci release launch-smoke'), flags: ['app-repo', 'as', 'entry', 'out', 'timeout-ms'] },
  proof: { script: 'scripts/gates/release-proof.mjs', usage: (s) => declaration(s), flags: ['base', 'main', 'out', 'repo'] },
  'sync-runtime': { script: 'scripts/hfs/sync-runtime.mjs', usage: (s) => matching(s, 'starci release sync-runtime'), flags: ['check'] },
};

test('release catalog resolves every implementation and exactly declares its parsed flags', () => {
  const scriptVerbs = Object.keys(group.verbs).filter((name) => group.verbs[name].impl.script);
  assert.deepEqual(scriptVerbs.sort(), Object.keys(specs).sort());
  assert.deepEqual(Object.keys(group.verbs).filter((name) => group.verbs[name].impl.module).sort(), ['images', 'publish']);
  for (const [verb, spec] of Object.entries(specs)) {
    const command = group.verbs[verb];
    assert.equal(command.impl.script, spec.script, verb);
    assert.ok(fs.existsSync(path.join(repoRoot, command.impl.script)), `${verb} implementation exists`);
    const source = read(spec.script);
    assert.deepEqual(flagsOfUsage(spec.usage(source)).sort(), [...spec.flags].sort(), `${verb} usage reflects its parser`);
    assert.deepEqual(command.flags.map((flag) => flag.name).sort(), [...spec.flags].sort(), `${verb} catalog flags`);
  }
});

test('release dispatch resolves through the injected script seam', () => {
  const calls = [];
  assert.equal(main(['release', 'proof', '--repo', 'repo', '--base', 'main~1', '--out', 'proof.json'], {
    catalog,
    runScript: (script, args, options) => { calls.push({ script, args, options }); return 0; },
  }), 0);
  assert.equal(path.relative(repoRoot, calls[0].script).replaceAll(path.sep, '/'), 'scripts/gates/release-proof.mjs');
  assert.deepEqual(calls[0].args, ['--repo', 'repo', '--base', 'main~1', '--out', 'proof.json']);
});
