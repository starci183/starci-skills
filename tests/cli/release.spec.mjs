import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from '../../scripts/cli/catalog.mjs';
import { main } from '../../scripts/cli/main.mjs';
import { flagsOfUsage } from '../../scripts/checks/check-cli-parity.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const loaded = loadCatalog(repoRoot);
const catalog = { global: loaded.global.flags, groups: Object.fromEntries(loaded.groups.map((group) => [group.group,
  { ...group, verbs: Object.fromEntries(group.verbs.map((verb) => [verb.verb, verb])) }])) };
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
  cut: { script: 'scripts/supervisor/release-cut-cli.mjs', usage: (s) => matching(s, '/** Parse'), flags: ['branch', 'plan', 'remote', 'repo', 'tag'] },
  'clean-test': { script: 'scripts/gates/package-clean-test.mjs', usage: (s) => declaration(s), flags: ['base', 'changed'] },
  'launch-smoke': { script: 'scripts/kernel/launch-smoke.mjs', usage: (s) => matching(s, 'starci release launch-smoke'), flags: ['app-repo', 'as', 'entry', 'out', 'timeout-ms'] },
  proof: { script: 'scripts/gates/release-proof.mjs', usage: (s) => declaration(s), flags: ['base', 'main', 'out', 'repo'] },
};

test('release catalog resolves every implementation and exactly declares its parsed flags', () => {
  const scriptVerbs = Object.keys(group.verbs).filter((name) => group.verbs[name].impl.script);
  assert.deepEqual(scriptVerbs.sort(), Object.keys(specs).sort());
  assert.deepEqual(Object.keys(group.verbs).filter((name) => group.verbs[name].impl.module).sort(), ['images', 'notes', 'publish', 'sync-runtime']);
  for (const [verb, spec] of Object.entries(specs)) {
    const command = group.verbs[verb];
    assert.equal(command.impl.script, spec.script, verb);
    assert.ok(fs.existsSync(path.join(repoRoot, command.impl.script)), `${verb} implementation exists`);
    const source = read(spec.script);
    assert.deepEqual(flagsOfUsage(spec.usage(source)).sort(), [...spec.flags].sort(), `${verb} usage reflects its parser`);
    assert.deepEqual(command.flags.map((flag) => flag.name).sort(), [...spec.flags].sort(), `${verb} catalog flags`);
  }
  const sync = group.verbs['sync-runtime'];
  assert.deepEqual(sync.impl, { module: 'scripts/supervisor/release-sync-runtime.mjs', export: 'releaseSyncRuntime' });
  assert.deepEqual(flagsOfUsage(declaration(read(sync.impl.module))).sort(), ['check', 'prepare-grammar']);
  assert.deepEqual(sync.flags.map((flag) => flag.name).sort(), ['check', 'prepare-grammar']);
  assert.equal(sync.effect, 'host');
});

test('release sync-runtime dispatches preparation and read-only checking through its owning module', async () => {
  const calls = [];
  const out = [];
  const io = { catalog, env: {}, stdout: (text) => out.push(text), stderr: () => {}, importModule: async (url) => {
    assert.ok(url.endsWith('/scripts/supervisor/release-sync-runtime.mjs'));
    return { releaseSyncRuntime: (ctx) => { calls.push(ctx); return { code: 0, text: 'synced', data: { prepared: !!ctx.args['prepare-grammar'] } }; } };
  } };
  assert.equal(await main(['release', 'sync-runtime', '--prepare-grammar', '--json'], io), 0);
  assert.equal(JSON.parse(out[0]).prepared, true);
  assert.equal(calls[0].args['prepare-grammar'], true);
  assert.equal(await main(['release', 'sync-runtime', '--check'], io), 0);
  assert.equal(calls[1].args.check, true);
  assert.equal(main(['release', 'sync-runtime', '--invented'], io), 2);
  assert.equal(calls.length, 2);
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
